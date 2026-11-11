import { useEffect, useMemo, useState } from 'react';

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Database,
  Download,
  Globe2,
  Search,
  Sparkles,
  Thermometer,
  Waves,
  Wind,
  Droplets,
  CloudRain,
  FileText,
  RefreshCw,
} from 'lucide-react';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { useTranslation } from 'react-i18next';

import './styles/global.css';
import './App.css';

import LocationFilter from './components/map/LocationFilter';
import CityMap from './components/map/CityMap';
import AccessibilityTools from './components/AccessibilityTools';
import LanguageSelector from './components/LanguageSelector';

import type { SelectedLocation } from './types/location';

import {
  buscarDadosNasa,
  type NasaPowerResponse,
} from './services/nasaService';

type Granularidade = 'daily' | 'monthly' | 'yearly';

interface HistoricoItem {
  label: string;
  temperature: number;
  maximum: number | null;
  minimum: number | null;
  precipitation: number | null;
  humidity: number | null;
  wind: number | null;
  count: number;
}

const CURRENT_YEAR = new Date().getFullYear();
const FIRST_YEAR = 1981;

const PARAMETERS = [
  'T2M',
  'T2M_MAX',
  'T2M_MIN',
  'RH2M',
  'PRECTOTCORR',
  'WS2M',
];

function calcularMedia(
  values?: Record<string, number>,
): number | null {
  if (!values) return null;

  const validValues = Object.values(values).filter(
    (value) =>
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value !== -999,
  );

  if (validValues.length === 0) return null;

  return (
    validValues.reduce((total, value) => total + value, 0) /
    validValues.length
  );
}

function formatarValor(
  value: number | null,
  decimals = 1,
  noDataText = 'No data',
): string {
  if (value === null || !Number.isFinite(value)) {
    return noDataText;
  }

  return value.toFixed(decimals);
}

function converterData(data: string): Date | null {
  if (!/^\d{8}$/.test(data)) return null;

  const ano = Number(data.slice(0, 4));
  const mes = Number(data.slice(4, 6)) - 1;
  const dia = Number(data.slice(6, 8));

  const date = new Date(Date.UTC(ano, mes, dia));

  if (
    date.getUTCFullYear() !== ano ||
    date.getUTCMonth() !== mes ||
    date.getUTCDate() !== dia
  ) {
    return null;
  }

  return date;
}

function obterValor(
  dados: Record<string, Record<string, number>>,
  parametro: string,
  data: string,
): number | null {
  const value = dados[parametro]?.[data];

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value === -999
  ) {
    return null;
  }

  return value;
}

function mediaLista(values: number[]): number | null {
  if (values.length === 0) return null;

  return (
    values.reduce((total, value) => total + value, 0) /
    values.length
  );
}

function gerarHistorico(
  dados: Record<string, Record<string, number>>,
  granularidade: Granularidade,
): HistoricoItem[] {
  const temperaturas = dados.T2M ?? {};

  const datas = Object.keys(temperaturas)
    .filter((data) => converterData(data) !== null)
    .sort();

  const grupos = new Map<
    string,
    {
      temperature: number[];
      maximum: number[];
      minimum: number[];
      precipitation: number[];
      humidity: number[];
      wind: number[];
    }
  >();

  for (const data of datas) {
    const date = converterData(data);

    if (!date) continue;

    let label: string;

    if (granularidade === 'daily') {
      label = `${data.slice(6, 8)}/${data.slice(4, 6)}/${data.slice(0, 4)}`;
    } else if (granularidade === 'monthly') {
      label = `${data.slice(4, 6)}/${data.slice(0, 4)}`;
    } else {
      label = String(date.getUTCFullYear());
    }

    if (!grupos.has(label)) {
      grupos.set(label, {
        temperature: [],
        maximum: [],
        minimum: [],
        precipitation: [],
        humidity: [],
        wind: [],
      });
    }

    const grupo = grupos.get(label)!;

    const temperature = obterValor(dados, 'T2M', data);
    const maximum = obterValor(dados, 'T2M_MAX', data);
    const minimum = obterValor(dados, 'T2M_MIN', data);
    const precipitation = obterValor(dados, 'PRECTOTCORR', data);
    const humidity = obterValor(dados, 'RH2M', data);
    const wind = obterValor(dados, 'WS2M', data);

    if (temperature !== null) grupo.temperature.push(temperature);
    if (maximum !== null) grupo.maximum.push(maximum);
    if (minimum !== null) grupo.minimum.push(minimum);
    if (precipitation !== null) grupo.precipitation.push(precipitation);
    if (humidity !== null) grupo.humidity.push(humidity);
    if (wind !== null) grupo.wind.push(wind);
  }

  return Array.from(grupos.entries()).map(([label, grupo]) => ({
    label,
    temperature: mediaLista(grupo.temperature) ?? 0,
    maximum: mediaLista(grupo.maximum),
    minimum: mediaLista(grupo.minimum),
    precipitation: mediaLista(grupo.precipitation),
    humidity: mediaLista(grupo.humidity),
    wind: mediaLista(grupo.wind),
    count: grupo.temperature.length,
  }));
}

function escaparHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return entities[char];
  });
}

function App() {
  const { t, i18n } = useTranslation();

  const noData = String(t('earthscope.indicators.noData', 'No data'));

  const [location, setLocation] =
    useState<SelectedLocation | null>(null);

  const [coordinates, setCoordinates] = useState({
    latitude: -14.235,
    longitude: -51.9253,
  });

  const [startYear, setStartYear] = useState(2020);
  const [endYear, setEndYear] = useState(2025);

  const [granularidade, setGranularidade] =
    useState<Granularidade>('monthly');

  const [selectedParameter, setSelectedParameter] =
    useState('T2M');

  const [nasaData, setNasaData] =
    useState<NasaPowerResponse | null>(null);

  const [nasaLoading, setNasaLoading] = useState(false);
  const [nasaError, setNasaError] = useState('');

  const startDate = `${startYear}0101`;
  const endDate = `${endYear}1231`;


  const direcaoTraduzida = (direction: string) => {
    const traducoes: Record<string, string> = {
      increasing: String(t('earthscope.insights.increasing', 'Aumentando')),
      decreasing: String(t('earthscope.insights.decreasing', 'Diminuindo')),
      'relatively stable': String(t('earthscope.insights.stable', 'Relativamente estável')),
      AUMENTO: String(t('earthscope.insights.increasing', 'Aumentando')),
      DIMINUICAO: String(t('earthscope.insights.decreasing', 'Diminuindo')),
      ESTAVEL: String(t('earthscope.insights.stable', 'Relativamente estável')),
      INDETERMINADA: String(t('earthscope.insights.undetermined', 'Indeterminada')),
    };

    return traducoes[direction] ?? direction;
  };


  useEffect(() => {
    let cancelled = false;

    async function carregarDadosNasa() {
      if (startYear > endYear) {
        setNasaError(
          String(t('earthscope.nasa.errorInvalidYears', 'Ano inicial não pode ser maior que o final.')),
        );
        return;
      }

      setNasaLoading(true);
      setNasaError('');
      setNasaData(null);

      try {
        const result = await buscarDadosNasa(
          coordinates.latitude,
          coordinates.longitude,
          startDate,
          endDate,
        );

        if (!cancelled) {
          setNasaData(result);
        }
      } catch (error) {
        console.error('Erro NASA POWER:', error);

        if (!cancelled) {
          setNasaError(
            String(t('earthscope.nasa.errorLoading', 'Erro ao carregar dados da NASA POWER.')),
          );
        }
      } finally {
        if (!cancelled) {
          setNasaLoading(false);
        }
      }
    }

    carregarDadosNasa();

    return () => {
      cancelled = true;
    };
  }, [
    coordinates.latitude,
    coordinates.longitude,
    startYear,
    endYear,
  ]);

  function handleLocationChange(
    selected: SelectedLocation | null,
  ) {
    setLocation(selected);

    if (selected) {
      setCoordinates({
        latitude: selected.latitude,
        longitude: selected.longitude,
      });
    }
  }

  function handleMapClick(
    latitude: number,
    longitude: number,
  ) {
    setLocation(null);
    setCoordinates({ latitude, longitude });
  }

  const nasaValues = nasaData?.data;
  const historicalAnalysis = nasaData?.historicalAnalysis ?? null;
  const temperature = calcularMedia(nasaValues?.T2M);
  const maximumTemperature = calcularMedia(nasaValues?.T2M_MAX);
  const minimumTemperature = calcularMedia(nasaValues?.T2M_MIN);
  const humidity = calcularMedia(nasaValues?.RH2M);
  const precipitation = calcularMedia(nasaValues?.PRECTOTCORR);
  const windSpeed = calcularMedia(nasaValues?.WS2M);

  const windSpeedKmh =
    windSpeed === null ? null : windSpeed * 3.6;

  const historicalData = useMemo(
    () =>
      nasaData
        ? gerarHistorico(nasaData.data, granularidade)
        : [],
    [nasaData, granularidade],
  );

  const chartData = useMemo(() => {
    if (!nasaData) return [];

    const dates = Object.keys(
      nasaData.data[selectedParameter] ?? {},
    ).sort();

    if (granularidade === 'daily') {
      return dates
        .map((date) => {
          const value = obterValor(
            nasaData.data,
            selectedParameter,
            date,
          );

          if (value === null) return null;

          return {
            label: `${date.slice(6, 8)}/${date.slice(4, 6)}/${date.slice(0, 4)}`,
            value,
          };
        })
        .filter((item) => item !== null);
    }

    const agrupados = new Map<string, number[]>();

    dates.forEach((date) => {
      const value = obterValor(
        nasaData.data,
        selectedParameter,
        date,
      );

      if (value === null) return;

      const label =
        granularidade === 'monthly'
          ? `${date.slice(4, 6)}/${date.slice(0, 4)}`
          : date.slice(0, 4);

      if (!agrupados.has(label)) {
        agrupados.set(label, []);
      }

      agrupados.get(label)!.push(value);
    });

    return Array.from(agrupados.entries()).map(
      ([label, values]) => ({
        label,
        value: mediaLista(values) ?? 0,
      }),
    );
  }, [nasaData, selectedParameter, granularidade]);

  const nasaIndicators = [
    {
      label: String(t('earthscope.indicators.averageTemperature', 'Temperatura Média do Ar')),
      value: temperature,
      unit: '°C',
      icon: Thermometer,
      parameter: 'T2M',
    },
    {
      label: String(t('earthscope.indicators.maximumTemperature', 'Temperatura Máxima')),
      value: maximumTemperature,
      unit: '°C',
      icon: Thermometer,
      parameter: 'T2M_MAX',
    },
    {
      label: String(t('earthscope.indicators.minimumTemperature', 'Temperatura Mínima')),
      value: minimumTemperature,
      unit: '°C',
      icon: Thermometer,
      parameter: 'T2M_MIN',
    },
    {
      label: String(t('earthscope.indicators.humidity', 'Umidade Relativa')),
      value: humidity,
      unit: '%',
      icon: Droplets,
      parameter: 'RH2M',
    },
    {
      label: String(t('earthscope.indicators.averagePrecipitation', 'Precipitação Média')),
      value: precipitation,
      unit: 'mm/day',
      icon: CloudRain,
      parameter: 'PRECTOTCORR',
    },
    {
      label: String(t('earthscope.indicators.wind', 'Velocidade do Vento')),
      value: windSpeed,
      unit: 'm/s',
      icon: Wind,
      parameter: 'WS2M',
    },
  ];

  const climateInsights = useMemo(() => {
    if (!historicalData.length) return null;

    const valid = historicalData.filter(
      (item) => item.count > 0,
    );

    if (valid.length < 2) return null;

    const middle = Math.floor(valid.length / 2);

    const firstHalf = valid.slice(0, middle);
    const secondHalf = valid.slice(middle);

    const firstAverage = mediaLista(
      firstHalf.map((item) => item.temperature),
    );

    const secondAverage = mediaLista(
      secondHalf.map((item) => item.temperature),
    );

    if (firstAverage === null || secondAverage === null) {
      return null;
    }

    const difference = secondAverage - firstAverage;

    const direction =
      Math.abs(difference) < 0.1
        ? 'relatively stable'
        : difference > 0
          ? 'increasing'
          : 'decreasing';

    const mean = mediaLista(valid.map((item) => item.temperature)) ?? 0;

    const variance =
      valid.reduce(
        (total, item) =>
          total + Math.pow(item.temperature - mean, 2),
        0,
      ) / valid.length;

    const standardDeviation = Math.sqrt(variance);

    const possibleAnomalies =
      standardDeviation > 0
        ? valid.filter(
          (item) =>
            Math.abs(item.temperature - mean) >
            2 * standardDeviation,
        )
        : [];

    return {
      firstAverage,
      secondAverage,
      difference,
      direction,
      possibleAnomalies,
      mean,
    };
  }, [historicalData]);

  function exportarCSV() {
    if (!nasaData) return;

    const dates = Object.keys(nasaData.data.T2M ?? {}).sort();

    const headers = [
      'Date',
      ...PARAMETERS,
    ];

    const rows = dates.map((date) => [
      `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      ...PARAMETERS.map((parameter) => {
        const value = obterValor(nasaData.data, parameter, date);
        return value === null ? '' : String(value);
      }),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob(
      ['\uFEFF' + csv],
      { type: 'text/csv;charset=utf-8;' },
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `earthscope-${startYear}-${endYear}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  function gerarPDF() {
    if (!nasaData) return;

    const nomeLocal = location
      ? `${location.city?.name || location.country.name}`
      : String(t('earthscope.report.selectedCoordinates', 'Coordenadas Selecionadas'));

    const chartPoints = chartData;

    const maxValue = Math.max(
      ...chartPoints.map((item) => item.value),
      1,
    );

    const minValue = Math.min(
      ...chartPoints.map((item) => item.value),
      0,
    );

    const chartWidth = 900;
    const chartHeight = 260;
    const padding = 35;

    const points = chartPoints.map((item, index) => {
      const x =
        padding +
        (index / Math.max(chartPoints.length - 1, 1)) *
        (chartWidth - padding * 2);

      const y =
        chartHeight -
        padding -
        ((item.value - minValue) /
          Math.max(maxValue - minValue, 1)) *
        (chartHeight - padding * 2);

      return `${x},${y}`;
    });

    const svg = `
      <svg viewBox="0 0 ${chartWidth} ${chartHeight}" width="100%" role="img">
        <polyline
          points="${points.join(' ')}"
          fill="none"
          stroke="#087F8C"
          stroke-width="4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;

    const indicadores = nasaIndicators
      .map(
        (item) => `
          <tr>
            <td>${escaparHtml(item.label)}</td>
            <td>${formatarValor(item.value, 1, noData)} ${item.unit}</td>
            <td>${item.parameter}</td>
          </tr>
        `,
      )
      .join('');

    const tabela = chartData
      .map(
        (item) => `
          <tr>
            <td>${escaparHtml(item.label)}</td>
            <td>${item.value.toFixed(2)}</td>
          </tr>
        `,
      )
      .join('');

    const insights = climateInsights
      ? `
        <p>${t('earthscope.report.firstAverage', 'Primeira metade')}: ${climateInsights.firstAverage.toFixed(2)} °C</p>
        <p>${t('earthscope.report.secondAverage', 'Segunda metade')}: ${climateInsights.secondAverage.toFixed(2)} °C</p>
        <p>${t('earthscope.report.difference', 'Diferença')}: ${climateInsights.difference.toFixed(2)} °C</p>
        <p>${t('earthscope.report.observedDirection', 'Tendência')}: ${escaparHtml(direcaoTraduzida(climateInsights.direction))}</p>
        <p>${t('earthscope.report.possibleAnomalies', 'Anomalias')}: ${climateInsights.possibleAnomalies.length}</p>
      `
      : `<p>${t('earthscope.report.insufficient', 'Dados insuficientes')}</p>`;

    const idiomaPDF = i18n.language.startsWith('pt')
      ? 'pt-BR'
      : i18n.language.startsWith('es')
        ? 'es'
        : 'en';

    const reportWindow = window.open('', '_blank');

    if (!reportWindow) {
      alert(String(t('earthscope.nasa.allowPopups', 'Por favor, permita pop-ups para gerar o relatório.')));
      return;
    }

    reportWindow.document.write(`
      <!DOCTYPE html>
      <html lang="${idiomaPDF}">
      <head>
        <meta charset="UTF-8" />
        <title>${t('earthscope.report.title', 'Relatório Climático CTRLCLIMA')}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #18364A;
            padding: 35px;
            line-height: 1.6;
          }

          h1, h2 {
            color: #087F8C;
          }

          .header {
            border-bottom: 3px solid #35C6B0;
            padding-bottom: 15px;
            margin-bottom: 25px;
          }

          .metadata {
            background: #eef6f6;
            padding: 15px;
            border-radius: 8px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0 30px;
          }

          th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
          }

          th {
            background: #eaf4f3;
          }

          svg {
            margin: 20px 0;
            border: 1px solid #ddd;
          }

          .note {
            font-size: 12px;
            color: #657987;
          }

          @media print {
            body { padding: 10px; }
          }
        </style>
      </head>

      <body>
        <div class="header">
          <h1>CTRLCLIMA</h1>
          <p>${t('earthscope.report.subtitle', 'Relatório do Sistema Terrestre')}</p>
        </div>

        <div class="metadata">
          <p><strong>${t('earthscope.report.location', 'Local')}:</strong> ${escaparHtml(nomeLocal)}</p>
          <p><strong>${t('earthscope.report.latitude', 'Latitude')}:</strong> ${nasaData.coordinates.latitude}</p>
          <p><strong>${t('earthscope.report.longitude', 'Longitude')}:</strong> ${nasaData.coordinates.longitude}</p>
          <p><strong>${t('earthscope.report.period', 'Período')}:</strong> ${startYear} – ${endYear}</p>
          <p><strong>${t('earthscope.report.dataSource', 'Fonte')}:</strong> NASA POWER</p>
          <p><strong>${t('earthscope.report.generated', 'Gerado em')}:</strong> ${new Date().toLocaleString(i18n.language)}</p>
        </div>

        <h2>${t('earthscope.report.indicators', 'Indicadores')}</h2>

        <table>
          <thead>
            <tr>
              <th>${t('earthscope.report.parameter', 'Parâmetro')}</th>
              <th>${t('earthscope.report.average', 'Média')}</th>
              <th>NASA</th>
            </tr>
          </thead>
          <tbody>${indicadores}</tbody>
        </table>

        <h2>${t('earthscope.report.history', 'Histórico')}</h2>
        <p>${t('earthscope.report.selectedVariable', 'Variável')}: ${selectedParameter}</p>
        <p>${t('earthscope.report.aggregation', 'Agregação')}: ${t(`earthscope.history.${granularidade}`, granularidade)}</p>

        ${svg}

        <table>
          <thead>
            <tr>
              <th>${t('earthscope.records.period', 'Período')}</th>
              <th>${t('earthscope.report.average', 'Média')}</th>
            </tr>
          </thead>
          <tbody>${tabela}</tbody>
        </table>

        <h2>${t('earthscope.report.climateInsights', 'Insights Climáticos')}</h2>
        ${insights}

        <p class="note">
          ${t('earthscope.report.note', 'Nota: Dados gerados por estimativas da NASA POWER.')}
        </p>

        <p class="note">
          ${t('earthscope.report.source', 'Fonte')}: NASA POWER — https://power.larc.nasa.gov/
        </p>

        <script>
          window.onload = () => window.print();
        </script>
      </body>
      </html>
    `);

    reportWindow.document.close();
  }

  const anosDisponiveis = Array.from(
    { length: CURRENT_YEAR - FIRST_YEAR + 1 },
    (_, index) => CURRENT_YEAR - index,
  );

  return (
    <div className="app">
      <AccessibilityTools />

      <header className="site-header">
        <a className="brand" href="#inicio">
          <div className="brand-icon">
            <Globe2 size={23} />
          </div>

          <div className="brand-copy">
            <strong>CTRLCLIMA</strong>
            <span>CTRLCLIMA</span>
          </div>
        </a>

        <nav
          className="main-nav"
          aria-label={t('navigation.aria', 'Navegação principal')}
        >
          <a className="nav-active" href="#inicio">
            {t('navigation.overview', 'Visão Geral')}
          </a>

          <a href="#explorer">
            {t('navigation.explorer', 'Explorador')}
          </a>

          <a href="#trends">
            {t('navigation.trends', 'Tendências')}
          </a>

          <a href="#data">
            {t('navigation.dataSources', 'Fontes de Dados')}
          </a>
        </nav>

        <div className="header-actions">
          <LanguageSelector />

          <button
            className="header-icon"
            aria-label={t('navigation.search', 'Pesquisar')}
            type="button"
          >
            <Search size={18} />
          </button>

          <span className="header-divider" />

          <div className="profile-mark">LA</div>
        </div>
      </header>

      <main id="inicio" className="main">
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span className="live-dot" />
              {t('hero.kicker', 'SISTEMA DE INTELIGÊNCIA TERRESTRE')}
            </div>

            <h1>
              {t('hero.titleLine1', 'Monitoramento')}
              <br />
              {t('hero.titleLine2', 'climático global em')}{' '}
              <em>{t('hero.titleHighlight', 'tempo real')}</em>
            </h1>

            <p>{t('hero.subtitle', 'Acesse dados avançados da NASA POWER para análise aprofundada de indicadores ambientais.')}</p>

            <div className="hero-actions">
              <a className="button-primary" href="#explorer">
                {t('hero.startExploring', 'Começar a Explorar')}
                <ArrowRight size={17} />
              </a>

              <a className="button-text" href="#trends">
                {t('hero.discoverTrends', 'Descobrir Tendências')}
                <ArrowDownRight size={16} />
              </a>
            </div>

            <div className="hero-footnote">
              <span>01</span>
              {t('hero.footnote', 'Plataforma oficial de observação integrada')}
            </div>
          </div>

          <div
            className="planet-scene"
            aria-label={t('planet.aria', 'Visualização do planeta Terra')}
          >
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="planet-glow" />

            <div className="planet">
              <div className="planet-texture" />
            </div>

            <div className="planet-label label-top">
              <span className="label-line" />

              <div>
                <small>{t('planet.system', 'SISTEMA')}</small>
                <strong>{t('planet.observation', 'Observação Atmosférica')}</strong>
              </div>
            </div>

            <div className="planet-label label-bottom">
              <span className="label-dot" />

              <div>
                <small>{t('planet.exploration', 'EXPLORAÇÃO')}</small>
                <strong>{t('planet.perspective', 'Perspectiva Global')}</strong>
              </div>
            </div>

            <div className="planet-coordinate">
              {coordinates.latitude.toFixed(2)}° /
              {' '}
              {coordinates.longitude.toFixed(2)}°
            </div>
          </div>

          <div className="hero-index">EARTH / 001</div>
        </section>

        <section className="intro-strip">
          <div>
            <span className="section-index">
              01 / {t('intro.index', 'VISÃO GERAL')}
            </span>

            <h2>{t('intro.title', 'Inteligência e monitoramento contínuo')}</h2>
          </div>

          <p>{t('intro.description', 'Explore dados consolidados sobre o clima, temperatura e variações atmosféricas com base em métricas científicas de alta precisão.')}</p>
        </section>

        <section
          className="indicators"
          aria-label={t('indicators.aria', 'Indicadores principais')}
        >
          <article className="indicator">
            <div className="indicator-icon">
              <Thermometer size={19} />
            </div>

            <div>
              <span>{t('earthscope.indicators.averageTemperature', 'Temperatura Média do Ar')}</span>

              <strong>
                {nasaLoading ? '...' : formatarValor(temperature, 1, noData)}
                <small> °C</small>
              </strong>

              <p>NASA POWER · T2M</p>
            </div>

            <ArrowUpRight className="indicator-arrow" size={17} />
          </article>

          <article className="indicator">
            <div className="indicator-icon">
              <Waves size={19} />
            </div>

            <div>
              <span>{t('earthscope.indicators.precipitation', 'Precipitação')}</span>

              <strong>
                {nasaLoading ? '...' : formatarValor(precipitation, 1, noData)}
                <small> mm/day</small>
              </strong>

              <p>NASA POWER · PRECTOTCORR</p>
            </div>

            <ArrowUpRight className="indicator-arrow" size={17} />
          </article>

          <article className="indicator">
            <div className="indicator-icon">
              <Wind size={19} />
            </div>

            <div>
              <span>{t('earthscope.indicators.wind', 'Velocidade do Vento')}</span>

              <strong>
                {nasaLoading ? '...' : formatarValor(windSpeedKmh, 1, noData)}
                <small> km/h</small>
              </strong>

              <p>NASA POWER · WS2M</p>
            </div>

            <ArrowUpRight className="indicator-arrow" size={17} />
          </article>

          <article className="indicator">
            <div className="indicator-icon">
              <Droplets size={19} />
            </div>

            <div>
              <span>{t('earthscope.indicators.humidity', 'Umidade Relativa')}</span>

              <strong>
                {nasaLoading ? '...' : formatarValor(humidity, 1, noData)}
                <small> %</small>
              </strong>

              <p>NASA POWER · RH2M</p>
            </div>

            <ArrowUpRight className="indicator-arrow" size={17} />
          </article>
        </section>

        {nasaError && (
          <div className="nasa-feedback nasa-error">
            {nasaError}
          </div>
        )}

        {/* EARTH EXPLORER */}
        <section
          id="explorer"
          className="exploration-section"
        >
          <div className="section-heading">
            <div>
              <span className="section-index">
                02 / {t('explorer.index', 'EXPLORADOR')}
              </span>

              <h2>{t('explorer.title', 'Mapa interativo e localização')}</h2>
            </div>

            <span className="demo-label">
              {t('earthscope.explorer.interactiveMap', 'Mapa Interativo')}
            </span>
          </div>

          <div className="earth-explorer-layout">
            <aside className="earth-explorer-sidebar">
              <span className="eyebrow">
                {t('earthscope.explorer.locationSearch', 'Busca de Localização')}
              </span>

              <h3>{t('earthscope.explorer.exploreRegion', 'Explore qualquer região')}</h3>

              <p>
                {t('earthscope.explorer.description', 'Selecione uma cidade ou clique diretamente no mapa para obter coordenadas exatas.')}
              </p>

              <LocationFilter
                onLocationChange={handleLocationChange}
              />

              <div className="earth-coordinates">
                <span>
                  {t('earthscope.explorer.selectedCoordinates', 'Coordenadas Selecionadas')}
                </span>

                <p>
                  {t('earthscope.explorer.latitude', 'Latitude')}:{' '}
                  {coordinates.latitude.toFixed(4)}°
                </p>

                <p>
                  {t('earthscope.explorer.longitude', 'Longitude')}:{' '}
                  {coordinates.longitude.toFixed(4)}°
                </p>
              </div>

              {location && (
                <div className="earth-location-name">
                  {location.city?.name || location.country.name}
                  {location.city && `, ${location.country.name}`}
                </div>
              )}
            </aside>

            <div className="earth-map-container">
              <div className="earth-map-heading">
                <strong>
                  {t('earthscope.explorer.mapTitle', 'Visualizador Geográfico')}
                </strong>

                <span>{t('earthscope.explorer.mapProvider', 'Leaflet / OpenStreetMap')}</span>
              </div>

              <div className="earth-map">
                <CityMap
                  latitude={coordinates.latitude}
                  longitude={coordinates.longitude}
                  cityName={location?.city?.name}
                  countryName={location?.country.name}
                  zoom={location?.city ? 10 : location ? 5 : 3}
                  onMapClick={handleMapClick}
                />
              </div>

              <div className="earth-map-caption">
                {t('earthscope.explorer.mapCaption', 'Clique em qualquer ponto do mapa para alterar a coordenada de análise.')}
              </div>
            </div>
          </div>
        </section>

        {/* NASA POWER */}
        <section className="nasa-live-section" id="nasa-data">
          <div className="section-heading">
            <div>
              <span className="section-index">
                03 / NASA POWER
              </span>

              <h2>Dados ambientais do espaço</h2>

              <p>
                Dados ambientais diários reais para a localização e o período selecionados.
              </p>
            </div>

            <span className="demo-label">
              {startYear} – {endYear}
            </span>
          </div>

          <div className="earthscope-filters">
            <div className="earthscope-filter-field">
              <label htmlFor="start-year">
                {t('earthscope.nasa.startYear', 'Ano Inicial')}
              </label>

              <select
                id="start-year"
                value={startYear}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setStartYear(value);

                  if (value > endYear) {
                    setEndYear(value);
                  }
                }}
              >
                {anosDisponiveis.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="earthscope-filter-field">
              <label htmlFor="end-year">
                {t('earthscope.nasa.endYear', 'Ano Final')}
              </label>

              <select
                id="end-year"
                value={endYear}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setEndYear(value);

                  if (value < startYear) {
                    setStartYear(value);
                  }
                }}
              >
                {anosDisponiveis
                  .filter((year) => year >= startYear)
                  .map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
              </select>
            </div>

            <div className="earthscope-filter-info">
              <span>
                {t('earthscope.nasa.selectedPeriod', 'Período Selecionado')}
              </span>

              <strong>{startYear} – {endYear}</strong>
            </div>
          </div>

          {nasaLoading && (
            <div className="nasa-feedback">
              <RefreshCw
                size={18}
                className="nasa-loading-icon"
              />

              {t('earthscope.nasa.loading', 'Carregando dados da NASA...')}
            </div>
          )}

          {!nasaLoading && nasaError && (
            <div className="nasa-feedback nasa-error">
              {nasaError}
            </div>
          )}

          {!nasaLoading && nasaData && (
            <>
              <div className="indicators nasa-live-indicators">
                {nasaIndicators.map((item) => {
                  const Icon = item.icon;

                  return (
                    <article
                      className="indicator"
                      key={item.parameter}
                    >
                      <div className="indicator-icon">
                        <Icon size={19} />
                      </div>

                      <div>
                        <span>{item.label}</span>

                        <strong>
                          {formatarValor(item.value, 1, noData)}
                          <small> {item.unit}</small>
                        </strong>

                        <p>NASA POWER · {item.parameter}</p>
                      </div>

                      <ArrowUpRight
                        className="indicator-arrow"
                        size={17}
                      />
                    </article>
                  );
                })}
              </div>

              <div className="nasa-source-note">
                <span>
                  {t('earthscope.nasa.source', 'Fonte')}:{' '}
                  <strong>{nasaData.source}</strong>
                </span>

                <span>
                  {t('earthscope.nasa.coordinates', 'Coordenadas')}:{' '}
                  {nasaData.coordinates.latitude.toFixed(4)},
                  {' '}
                  {nasaData.coordinates.longitude.toFixed(4)}
                </span>

                <span>
                  {t('earthscope.nasa.period', 'Período')}:{' '}
                  {nasaData.period.start} – {nasaData.period.end}
                </span>

                <p>
                  {t('earthscope.nasa.temperatureNote', 'Nota: Valores calculados com base nas médias diárias obtidas.')}
                </p>
              </div>

              <div className="earthscope-export-actions">
                <button
                  type="button"
                  className="button-primary"
                  onClick={exportarCSV}
                >
                  <Download size={17} />
                  {t('earthscope.nasa.exportCsv', 'Exportar CSV')}
                </button>

                <button
                  type="button"
                  className="button-text"
                  onClick={gerarPDF}
                >
                  <FileText size={17} />
                  {t('earthscope.nasa.generatePdf', 'Gerar Relatório PDF')}
                </button>
              </div>
            </>
          )}
        </section>

        {/* EXPLICAÇÃO DOS INDICADORES */}
        <section className="temperature-explanation">
          <div className="temperature-explanation-header">
            <span className="section-eyebrow">
              04 / GUIA DOS INDICADORES
            </span>

            <h2>
              Entenda os dados ambientais
            </h2>

            <p>
              Conheça os indicadores utilizados pelo EarthScope e entenda o que cada informação revela sobre as condições ambientais de uma região.
            </p>
          </div>

          <div className="temperature-explanation-grid">
            <article className="temperature-explanation-card">
              <span className="temperature-icon">🌡️</span>
              <div>
                <h3>{t('explainer.airTemperature.title')}</h3>
                <span className="temperature-code">T2M</span>
              </div>
              <p>
                {t('explainer.airTemperature.description')}
              </p>
            </article>

            <article className="temperature-explanation-card">
              <span className="temperature-icon">🔥</span>
              <div>
                <h3>{t('explainer.maximumTemperature.title')}</h3>
                <span className="temperature-code">T2M_MAX</span>
              </div>
              <p>
                {t('explainer.maximumTemperature.description')}
              </p>
            </article>

            <article className="temperature-explanation-card">
              <span className="temperature-icon">❄️</span>
              <div>
                <h3>{t('explainer.minimumTemperature.title')}</h3>
                <span className="temperature-code">T2M_MIN</span>
              </div>
              <p>
                {t('explainer.minimumTemperature.description')}
              </p>
            </article>

            <article className="temperature-explanation-card">
              <span className="temperature-icon">🌧️</span>
              <div>
                <h3>{t('explainer.precipitation.title')}</h3>
                <span className="temperature-code">PRECTOTCORR</span>
              </div>
              <p>
                {t('explainer.precipitation.description')}
              </p>
            </article>

            <article className="temperature-explanation-card">
              <span className="temperature-icon">💧</span>
              <div>
                <h3>{t('explainer.humidity.title')}</h3>
                <span className="temperature-code">RH2M</span>
              </div>
              <p>
                {t('explainer.humidity.description')}
              </p>
            </article>

            <article className="temperature-explanation-card">
              <span className="temperature-icon">💨</span>
              <div>
                <h3>{t('explainer.wind.title')}</h3>
                <span className="temperature-code">WS2M</span>
              </div>
              <p>
                {t('explainer.wind.description')}
              </p>
            </article>
          </div>

          {/* ATENÇÃO */}
          <div className="temperature-difference">
            <div className="temperature-difference-content">
              <span className="section-eyebrow">
                {t('explainer.difference.eyebrow')}
              </span>
              <h3>
                {t('explainer.difference.title')}
              </h3>
              <p>
                {t('explainer.difference.description')}
              </p>
            </div>
          </div>

          {/* COMO INTERPRETAR OS RELATÓRIOS */}
          <div className="report-guide">
            <div className="report-guide-heading">
              <span className="section-eyebrow">
                {t('earthscope.reportGuide.eyebrow')}
              </span>
              <h2>
                {t('earthscope.reportGuide.title')}
              </h2>
              <p>
                {t('earthscope.reportGuide.description')}
              </p>
            </div>

            <div className="report-guide-items">
              <div>
                <strong>{t('earthscope.reportGuide.periodTitle')}</strong>
                <p>{t('earthscope.reportGuide.period')}</p>
              </div>

              <div>
                <strong>{t('earthscope.reportGuide.locationTitle')}</strong>
                <p>{t('earthscope.reportGuide.location')}</p>
              </div>

              <div>
                <strong>{t('earthscope.reportGuide.indicatorsTitle')}</strong>
                <p>{t('earthscope.reportGuide.indicators')}</p>
              </div>

              <div>
                <strong>{t('earthscope.reportGuide.chartsTitle')}</strong>
                <p>{t('earthscope.reportGuide.charts')}</p>
              </div>

              <div>
                <strong>{t('earthscope.reportGuide.sourceTitle')}</strong>
                <p>{t('earthscope.reportGuide.source')}</p>
              </div>

              <div>
                <strong>{t('earthscope.reportGuide.exportTitle')}</strong>
                <p>{t('earthscope.reportGuide.export')}</p>
              </div>
            </div>

            <p className="report-guide-note">
              {t('earthscope.reportGuide.note')}
            </p>
          </div>
        </section>

        {/* HISTORICAL ANALYSIS */}
        <section id="trends" className="analysis-section">
          <div className="section-heading">
            <div>
              <span className="section-index">
                05 / {t('earthscope.history.title', 'Histórico Climático')}
              </span>

              <h2>{t('earthscope.history.title', 'Histórico Climático')}</h2>

              <p>
                {t('earthscope.history.description', 'Acompanhe a evolução histórica dos parâmetros ambientais ao longo do tempo.')}
              </p>
            </div>

            <span className="demo-label">
              NASA POWER DATA
            </span>
          </div>

          <div className="earthscope-chart-controls">
            <div className="earthscope-filter-field">
              <label htmlFor="granularity">
                {t('earthscope.history.timeInterval', 'Intervalo de Tempo')}
              </label>

              <select
                id="granularity"
                value={granularidade}
                onChange={(event) =>
                  setGranularidade(
                    event.target.value as Granularidade,
                  )
                }
              >
                <option value="daily">
                  {t('earthscope.history.daily', 'Diário')}
                </option>

                <option value="monthly">
                  {t('earthscope.history.monthly', 'Mensal')}
                </option>

                <option value="yearly">
                  {t('earthscope.history.yearly', 'Anual')}
                </option>
              </select>
            </div>

            <div className="earthscope-filter-field">
              <label htmlFor="parameter">
                {t('earthscope.history.variable', 'Variável Climática')}
              </label>

              <select
                id="parameter"
                value={selectedParameter}
                onChange={(event) =>
                  setSelectedParameter(event.target.value)
                }
              >
                <option value="T2M">
                  {t('earthscope.history.airTemperature', 'Temperatura do Ar')} (T2M)
                </option>

                <option value="T2M_MAX">
                  {t('earthscope.history.maximumTemperature', 'Temperatura Máxima')}
                </option>

                <option value="T2M_MIN">
                  {t('earthscope.history.minimumTemperature', 'Temperatura Mínima')}
                </option>

                <option value="RH2M">
                  {t('earthscope.history.humidity', 'Umidade Relativa')}
                </option>

                <option value="PRECTOTCORR">
                  {t('earthscope.history.precipitation', 'Precipitação')}
                </option>

                <option value="WS2M">
                  {t('earthscope.history.wind', 'Velocidade do Vento')}
                </option>
              </select>
            </div>
          </div>

          <div className="analysis-layout">
            <div className="chart-card">
              <div className="chart-heading">
                <div>
                  <span className="chart-overline">
                    NASA POWER · {selectedParameter}
                  </span>

                  <h3>
                    {granularidade === 'daily'
                      ? t('earthscope.history.dailyObservations', 'Observações Diárias')
                      : granularidade === 'monthly'
                        ? t('earthscope.history.monthlyAverages', 'Médias Mensais')
                        : t('earthscope.history.yearlyAverages', 'Médias Anuais')}
                  </h3>

                  <p>
                    {startYear} – {endYear} · {chartData.length}{' '}
                    {t('earthscope.history.dataPoints', 'pontos de dados')}
                  </p>
                </div>

                <div className="chart-unit">
                  {selectedParameter === 'RH2M'
                    ? '%'
                    : selectedParameter === 'PRECTOTCORR'
                      ? 'mm/day'
                      : selectedParameter === 'WS2M'
                        ? 'm/s'
                        : '°C'}
                </div>
              </div>

              <div className="chart">
                {nasaLoading ? (
                  <p className="nasa-feedback">
                    {t('earthscope.history.loading', 'Carregando gráfico...')}
                  </p>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{
                        top: 12,
                        right: 8,
                        left: -18,
                        bottom: 0,
                      }}
                    >
                      <defs>
                        <linearGradient
                          id="temperatureFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#35C6B0"
                            stopOpacity={0.28}
                          />

                          <stop
                            offset="100%"
                            stopColor="#35C6B0"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        stroke="#294252"
                        strokeDasharray="3 6"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="label"
                        stroke="#91A6B5"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                        minTickGap={30}
                      />

                      <YAxis
                        stroke="#91A6B5"
                        domain={['auto', 'auto']}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11 }}
                      />

                      <Tooltip
                        contentStyle={{
                          background: '#102536',
                          border: '1px solid #35C6B0',
                          borderRadius: '10px',
                          color: '#F3F6F8',
                        }}
                        formatter={(value) => [
                          `${Number(value).toFixed(2)}`,
                          selectedParameter,
                        ]}
                      />

                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#35C6B0"
                        strokeWidth={2.5}
                        fill="url(#temperatureFill)"
                        activeDot={{
                          r: 5,
                          fill: '#E4D49A',
                          stroke: '#0B1724',
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="nasa-feedback">
                    {t('earthscope.history.noData', 'Nenhum dado disponível para o período.')}
                  </p>
                )}
              </div>

              <div className="chart-foot">
                <span>
                  <i /> {t('earthscope.history.observations', 'Registros coletados')}
                </span>

                <span>{startYear} — {endYear}</span>
              </div>
            </div>


{/* CLIMATE INSIGHTS */}
<aside className="insight-card">
  <div className="insight-symbol">
    <Sparkles size={20} />
  </div>

  <span className="eyebrow">
    {t('earthscope.insights.title', 'ANÁLISE E INSIGHTS')}
  </span>

  <h3>
    {t('earthscope.insights.heading', 'Tendências Climáticas')}
  </h3>

  {nasaLoading ? (
    <p>Carregando análise histórica...</p>
  ) : historicalAnalysis?.status === 'SUCCESS' ? (
    <>
      <p>
        {historicalAnalysis.label || historicalAnalysis.parameter}
        {' · '}
        {historicalAnalysis.unit}
      </p>

      <div className="insight-divider" />

      <div className="insight-stat">
        <span>Tendência geral</span>

        <strong>
          {historicalAnalysis.trend.direction === 'AUMENTO' ? (
            <ArrowUpRight size={18} />
          ) : historicalAnalysis.trend.direction === 'DIMINUICAO' ? (
            <ArrowDownRight size={18} />
          ) : (
            <Activity size={18} />
          )}

          {direcaoTraduzida(historicalAnalysis.trend.direction)}
        </strong>
      </div>

      <div className="insight-stat">
        <span>Variação da tendência por ano</span>

        <strong>
          {historicalAnalysis.trend.slopePerYear !== null
            ? `${historicalAnalysis.trend.slopePerYear > 0 ? '+' : ''}${historicalAnalysis.trend.slopePerYear.toFixed(3)} ${historicalAnalysis.unit}/ano`
            : noData}
        </strong>
      </div>

      {historicalAnalysis.periodComparison && (
        <>
          <div className="insight-divider" />

          <div className="insight-stat">
            <span>Primeiro período</span>

            <strong>
              {historicalAnalysis.periodComparison.firstPeriod.average.toFixed(2)}
              {' '}
              {historicalAnalysis.unit}
            </strong>
          </div>

          <div className="insight-stat">
            <span>Último período</span>

            <strong>
              {historicalAnalysis.periodComparison.lastPeriod.average.toFixed(2)}
              {' '}
              {historicalAnalysis.unit}
            </strong>
          </div>

          <div className="insight-stat">
            <span>Diferença entre períodos</span>

            <strong>
              {historicalAnalysis.periodComparison.difference > 0 ? '+' : ''}
              {historicalAnalysis.periodComparison.difference.toFixed(2)}
              {' '}
              {historicalAnalysis.unit}
            </strong>
          </div>

          <p className="insight-disclaimer">
            {historicalAnalysis.periodComparison.description}
          </p>
        </>
      )}

      {historicalAnalysis.annualAverages.length > 0 && (
        <>
          <div className="insight-divider" />

          <strong>Médias anuais</strong>

          <div className="historical-annual-list">
            {historicalAnalysis.annualAverages.map((item) => (
              <div
                className="insight-stat"
                key={item.year}
              >
                <span>
                  {item.year}
                  {!item.isComplete && ' *'}
                </span>

                <strong>
                  {item.average.toFixed(2)} {historicalAnalysis.unit}
                </strong>
              </div>
            ))}
          </div>

          <p className="insight-disclaimer">
            Dias válidos analisados: {historicalAnalysis.totalValidDays ?? noData}
          </p>
        </>
      )}

      <p className="insight-disclaimer">
        {historicalAnalysis.trend.description}
      </p>
    </>
  ) : (
    <p>
      {historicalAnalysis?.message ||
        'Análise histórica indisponível. Verifique o retorno do backend.'}
    </p>
  )}
</aside>


          </div>
        </section>

        {/* HISTORICAL DATA TABLE */}
        <section className="earthscope-history-section">
          <div className="section-heading">
            <div>
              <span className="section-index">
                06 / {t('earthscope.records.title', 'Tabela de Registros')}
              </span>

              <h2>{t('earthscope.records.title', 'Tabela de Registros')}</h2>
            </div>
          </div>

          <div className="earthscope-table-wrapper">
            <table className="earthscope-table">
              <thead>
                <tr>
                  <th>{t('earthscope.records.period', 'Período')}</th>
                  <th>{t('earthscope.records.temperature', 'Temperatura')}</th>
                  <th>{t('earthscope.records.maximum', 'Máxima')}</th>
                  <th>{t('earthscope.records.minimum', 'Mínima')}</th>
                  <th>{t('earthscope.records.precipitation', 'Precipitação')}</th>
                  <th>{t('earthscope.records.humidity', 'Umidade')}</th>
                  <th>{t('earthscope.records.wind', 'Vento')}</th>
                </tr>
              </thead>

              <tbody>
                {historicalData.map((item) => (
                  <tr key={item.label}>
                    <td>{item.label}</td>
                    <td>{formatarValor(item.temperature, 2, noData)}</td>
                    <td>{formatarValor(item.maximum, 2, noData)}</td>
                    <td>{formatarValor(item.minimum, 2, noData)}</td>
                    <td>{formatarValor(item.precipitation, 2, noData)}</td>
                    <td>{formatarValor(item.humidity, 2, noData)}</td>
                    <td>{formatarValor(item.wind, 2, noData)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>


        {/* DATA SOURCES */}
        <section id="data" className="data-section">
          <div className="data-copy">
            <span className="section-index">
              07 / {t('sources.index', 'FONTES')}
            </span>

            <h2>
              {t('sources.title', 'Fontes de Dados Oficiais')}
            </h2>

            <p>
              {t(
                'sources.description',
                'Utilizamos infraestruturas globais de observação espacial e terrestre.',
              )}
            </p>
          </div>

          <div className="data-sources-links">
            <a
              className="data-source"
              href={
                nasaData?.sourceUrl ||
                nasaData?.homeUrl ||
                'https://power.larc.nasa.gov/'
              }
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Acessar os dados utilizados da NASA POWER"
            >
              <div className="source-icon">
                <Database size={22} />
              </div>

              <div>
                <span>
                  {t('sources.infrastructure', 'Infraestrutura')}
                </span>

                <strong>NASA & Earth observation</strong>

                <small>
                  {nasaData
                    ? t(
                      'earthscope.sources.success',
                      'Conectado com sucesso',
                    )
                    : nasaLoading
                      ? t(
                        'earthscope.sources.loading',
                        'Carregando dados...',
                      )
                      : nasaError
                        ? t(
                          'earthscope.sources.unavailable',
                          'Serviço indisponível',
                        )
                        : t('sources.status', 'Online')}
                </small>
              </div>

              <ArrowUpRight size={19} />
            </a>

            <a
              className="source-documentation-link"
              href={
                nasaData?.documentationUrl ||
                'https://power.larc.nasa.gov/docs/'
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText size={16} />
              Documentação oficial da NASA POWER
              <ArrowUpRight size={15} />
            </a>
          </div>
        </section>



        <footer className="site-footer">
          <a className="footer-brand" href="#inicio">
            <Globe2 size={17} />
            CTRLCLIMA
          </a>

          <span>{t('footer.tagline', 'Sistema de Inteligência do Sistema Terrestre')}</span>

          <span>CTRLCLIMA · 2026</span>
        </footer>
      </main>
    </div>
  );
}

export default App;