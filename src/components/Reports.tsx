
import { useEffect, useMemo, useState } from 'react';
import {
  FileJson,
  FileText,
  Globe2,
  Printer,
  Search,
  Table2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import AccessibilityTools from './AccessibilityTools';
import LanguageSelector from './LanguageSelector';
import './Reports.css';

type Parameter = {
  code: string;
  label: string;
  unit: string;
  group: string;
};

type Country = {
  id: string;
  name: string;
  officialName?: string;
  code: string;
  iso2: string;
  iso3?: string;
  capital?: string;
  latitude: number | null;
  longitude: number | null;
  flag?: string;
};

type Place = {
  id?: string;
  name: string;
  countryCode?: string;
  countryName?: string;
  state?: string | null;
  stateCode?: string | null;
  latitude: number;
  longitude: number;
  population?: number | null;
};

type DataRow = {
  date: string;
  [key: string]: string | number | null;
};

type ReportsProps = {
  user: { role?: string } | null;
};

const FALLBACK_PARAMETERS: Parameter[] = [
  { code: 'T2M', label: 'Temperatura média do ar', unit: '°C', group: 'Temperatura do ar' },
  { code: 'T2M_MAX', label: 'Temperatura máxima do ar', unit: '°C', group: 'Temperatura do ar' },
  { code: 'T2M_MIN', label: 'Temperatura mínima do ar', unit: '°C', group: 'Temperatura do ar' },
  { code: 'T2M_RANGE', label: 'Amplitude da temperatura do ar', unit: '°C', group: 'Temperatura do ar' },
  { code: 'TS', label: 'Temperatura da superfície do modelo', unit: '°C', group: 'Superfície' },
  { code: 'T2MDEW', label: 'Temperatura do ponto de orvalho', unit: '°C', group: 'Umidade' },
  { code: 'T2MWET', label: 'Temperatura de bulbo úmido', unit: '°C', group: 'Umidade' },
  { code: 'RH2M', label: 'Umidade relativa do ar', unit: '%', group: 'Umidade' },
  { code: 'QV2M', label: 'Umidade específica', unit: 'g/kg', group: 'Umidade' },
  { code: 'PS', label: 'Pressão atmosférica', unit: 'kPa', group: 'Atmosfera' },
  { code: 'PRECTOTCORR', label: 'Precipitação corrigida', unit: 'mm/dia', group: 'Precipitação' },
  { code: 'WS2M', label: 'Velocidade do vento a 2 metros', unit: 'm/s', group: 'Vento' },
  { code: 'WS10M', label: 'Velocidade do vento a 10 metros', unit: 'm/s', group: 'Vento' },
  { code: 'WD2M', label: 'Direção do vento a 2 metros', unit: '°', group: 'Vento' },
  { code: 'WD10M', label: 'Direção do vento a 10 metros', unit: '°', group: 'Vento' },
  { code: 'ALLSKY_SFC_SW_DWN', label: 'Radiação solar incidente', unit: 'kWh/m²/dia', group: 'Radiação solar' },
  { code: 'CLRSKY_SFC_SW_DWN', label: 'Radiação solar em céu limpo', unit: 'kWh/m²/dia', group: 'Radiação solar' },
  { code: 'ALLSKY_KT', label: 'Índice de claridade', unit: '', group: 'Radiação solar' },
  { code: 'ALLSKY_SFC_PAR_TOT', label: 'Radiação fotossinteticamente ativa', unit: 'W/m²', group: 'Radiação solar' },
  { code: 'GWETTOP', label: 'Umidade superficial do solo', unit: 'm³/m³', group: 'Solo' },
  { code: 'GWETROOT', label: 'Umidade da zona das raízes', unit: 'm³/m³', group: 'Solo' },
];

const PARAMETER_GROUPS: Record<string, string> = {
  T2M: 'airTemperature',
  T2M_MAX: 'airTemperature',
  T2M_MIN: 'airTemperature',
  T2M_RANGE: 'airTemperature',
  TS: 'surface',
  T2MDEW: 'humidity',
  T2MWET: 'humidity',
  RH2M: 'humidity',
  QV2M: 'humidity',
  PS: 'atmosphere',
  PRECTOTCORR: 'precipitation',
  WS2M: 'wind',
  WS10M: 'wind',
  WD2M: 'wind',
  WD10M: 'wind',
  ALLSKY_SFC_SW_DWN: 'solar',
  CLRSKY_SFC_SW_DWN: 'solar',
  ALLSKY_KT: 'solar',
  ALLSKY_SFC_PAR_TOT: 'solar',
  GWETTOP: 'soil',
  GWETROOT: 'soil',
};

function toApiDate(date: string) {
  return date.replaceAll('-', '');
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function formatValue(value: number | null, decimals = 2) {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toFixed(decimals);
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Reports({ user: _user }: ReportsProps) {
  const { t, i18n } = useTranslation();

  const [countries, setCountries] = useState<Country[]>([]);
  const [parameters, setParameters] = useState<Parameter[]>(FALLBACK_PARAMETERS);

  const [placeQuery, setPlaceQuery] = useState('Rio de Janeiro');
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState('Rio de Janeiro');

  const [countryCode, setCountryCode] = useState('BR');
  const [latitude, setLatitude] = useState('-22.9068');
  const [longitude, setLongitude] = useState('-43.1729');

  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-01-07');
  const [community, setCommunity] = useState('AG');

  const [selectedParameters, setSelectedParameters] = useState<string[]>([
    'T2M', 'T2M_MAX', 'T2M_MIN', 'RH2M', 'PRECTOTCORR', 'WS2M',
  ]);

  const [results, setResults] = useState<DataRow[]>([]);
  const [sourceUrl, setSourceUrl] = useState('https://power.larc.nasa.gov/');
  const [loading, setLoading] = useState(false);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const locale =
    i18n.resolvedLanguage?.startsWith('es') ? 'es-ES' :
    i18n.resolvedLanguage?.startsWith('pt') ? 'pt-BR' : 'en-US';

  const translate = (key: string, fallback = '') =>
    t(`reports.${key}`, { defaultValue: fallback });

  useEffect(() => {
    async function loadInitialData() {
      try {
        const response = await api.get('/locations/countries');
        const data = response.data;
        setCountries(Array.isArray(data) ? data : data?.data ?? []);
      } catch {
        setNotice(translate('countryError'));
      }

      try {
        const response = await api.get('/nasa/parameters');
        const data = response.data;
        const list = Array.isArray(data) ? data : data?.data ?? [];

        if (list.length > 0) {
          setParameters(list);
        }
      } catch {
        setParameters(FALLBACK_PARAMETERS);
      }
    }

    loadInitialData();
  }, []);

  const translatedParameters = useMemo(() => {
    return parameters.map((parameter) => ({
      ...parameter,
      label: translate(
        `parametersNames.${parameter.code}`,
        parameter.label,
      ),
      group: translate(
        `groups.${PARAMETER_GROUPS[parameter.code] || 'other'}`,
        parameter.group || 'Outros',
      ),
    }));
  }, [parameters, i18n.resolvedLanguage]);

  const groupedParameters = useMemo(() => {
    return translatedParameters.reduce<Record<string, Parameter[]>>(
      (groups, parameter) => {
        const group = parameter.group || translate('groups.other', 'Outros');
        if (!groups[group]) groups[group] = [];
        groups[group].push(parameter);
        return groups;
      },
      {},
    );
  }, [translatedParameters]);

  const selectedCountry = countries.find(
    (country) => country.code === countryCode,
  );

  async function searchPlaces() {
    const query = placeQuery.trim();

    if (query.length < 2) {
      setError(translate('invalidSearch'));
      return;
    }

    setSearchingPlace(true);
    setError('');
    setPlaces([]);

    try {
      const response = await api.get('/locations/cities', {
        params: { countryCode, search: query },
      });

      const data = response.data;
      const list = Array.isArray(data) ? data : data?.data ?? [];

      setPlaces(list);

      if (list.length === 0) {
        setNotice(translate('noPlaces'));
      } else {
        setNotice('');
      }
    } catch {
      setError(translate('searchError'));
    } finally {
      setSearchingPlace(false);
    }
  }

  function choosePlace(place: Place) {
    setLatitude(String(place.latitude));
    setLongitude(String(place.longitude));
    setSelectedPlace(place.name);
    setPlaceQuery(place.name);
    setPlaces([]);

    if (place.countryCode) setCountryCode(place.countryCode);

    setNotice(translate('selectedPlace', 'Localização selecionada: {{name}}')
      .replace('{{name}}', place.name));
  }

  function chooseCountry(code: string) {
    setCountryCode(code);

    const country = countries.find((item) => item.code === code);

    if (!country) return;

    const placeName = country.capital || country.name;
    setSelectedPlace(placeName);
    setPlaceQuery(placeName);

    if (country.latitude !== null && country.longitude !== null) {
      setLatitude(String(country.latitude));
      setLongitude(String(country.longitude));
      setNotice(translate('selectedCountryNotice', 'País selecionado: {{name}}')
        .replace('{{name}}', country.name));
    } else {
      setNotice(translate(
        'countryCoordinatesNotice',
        'País selecionado: {{name}}. Informe as coordenadas manualmente ou pesquise uma cidade.',
      ).replace('{{name}}', country.name));
    }
  }

  function toggleParameter(code: string) {
    setSelectedParameters((current) => {
      if (current.includes(code)) {
        return current.filter((item) => item !== code);
      }

      if (current.length >= 20) {
        setError(translate('parameterLimit'));
        return current;
      }

      setError('');
      return [...current, code];
    });
  }

  async function runQuery() {
    setError('');
    setNotice('');

    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setError(translate('invalidLatitude'));
      return;
    }

    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      setError(translate('invalidLongitude'));
      return;
    }

    if (!startDate || !endDate || startDate > endDate) {
      setError(translate('invalidPeriod'));
      return;
    }

    if (selectedParameters.length === 0) {
      setError(translate('noParameter'));
      return;
    }

    setLoading(true);

    try {
      const response = await api.get('/nasa/power', {
        params: {
          latitude: lat,
          longitude: lon,
          start: toApiDate(startDate),
          end: toApiDate(endDate),
          parameters: selectedParameters.join(','),
          community,
        },
      });

      const payload = response.data;
      const rawData = payload?.data ?? payload?.dados ?? {};
      const dates = new Set<string>();

      Object.values(rawData).forEach((parameterData: any) => {
        if (parameterData && typeof parameterData === 'object') {
          Object.keys(parameterData).forEach((date) => dates.add(date));
        }
      });

      const rows: DataRow[] = Array.from(dates)
        .sort()
        .map((date) => {
          const row: DataRow = { date };

          selectedParameters.forEach((parameter) => {
            const value = rawData?.[parameter]?.[date];
            row[parameter] =
              typeof value === 'number' && value < -900
                ? null
                : value ?? null;
          });

          return row;
        });

      setResults(rows);
      setSourceUrl(payload?.sourceUrl || 'https://power.larc.nasa.gov/');

      if (rows.length === 0) {
        setNotice(translate('emptyResults'));
      } else {
        setNotice(
          translate('resultsFound', '{{count}} registros encontrados para {{place}}.')
            .replace('{{count}}', String(rows.length))
            .replace('{{place}}', selectedPlace || 'a localização selecionada'),
        );
      }
    } catch (err) {
      console.error('NASA POWER query error:', err);
      setResults([]);
      setError(translate('queryError'));
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    if (results.length === 0) return;

    const headers = [translate('date', 'Data'), ...selectedParameters];

    const lines = [
      headers.map(csvCell).join(','),
      ...results.map((row) =>
        [row.date, ...selectedParameters.map((parameter) => row[parameter] ?? '')]
          .map(csvCell)
          .join(','),
      ),
    ];

    const blob = new Blob(['\uFEFF' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });

    downloadFile(blob, `earthscope-report-${startDate}-${endDate}.csv`);
  }

  function exportJSON() {
    if (results.length === 0) return;

    const report = {
      project: 'EARTHSCOPE',
      source: 'NASA POWER',
      sourceUrl,
      location: {
        name: selectedPlace,
        latitude: Number(latitude),
        longitude: Number(longitude),
      },
      period: { start: startDate, end: endDate },
      community,
      parameters: selectedParameters,
      data: results,
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });

    downloadFile(blob, `earthscope-report-${startDate}-${endDate}.json`);
  }

  const summaries = useMemo(() => {
    return selectedParameters.map((code) => {
      const values = results
        .map((row) => row[code])
        .filter(
          (value): value is number =>
            typeof value === 'number' && Number.isFinite(value),
        );

      const parameter = translatedParameters.find((item) => item.code === code);

      if (values.length === 0) {
        return {
          code,
          label: parameter?.label || code,
          unit: parameter?.unit || '',
          mean: null,
          min: null,
          max: null,
          count: 0,
        };
      }

      const sum = values.reduce((total, value) => total + value, 0);

      return {
        code,
        label: parameter?.label || code,
        unit: parameter?.unit || '',
        mean: sum / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      };
    });
  }, [results, selectedParameters, translatedParameters]);

  return (
    <div className="page-content reports-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">{translate('eyebrow')}</span>
          <h2>{translate('title')}</h2>
          <p className="muted report-intro">{translate('description')}</p>
        </div>

        <div className="reports-header-actions">
          <LanguageSelector />
          <span className="unit-pill">
            <Globe2 size={15} />
            NASA POWER
          </span>
        </div>
      </header>

      <div className="demo-banner">
        <Globe2 size={20} />
        <div>
          <strong>{translate('nasaTitle')}</strong>
          <p>{translate('nasaDescription')}</p>
        </div>
      </div>

      {notice && <div className="notice-banner" role="status">{notice}</div>}
      {error && <div className="error-banner" role="alert">{error}</div>}

      <section className="filters-card">
        <div className="filter-title">
          <div>
            <span className="eyebrow">{translate('configuration')}</span>
            <h3>{translate('locationPeriod')}</h3>
          </div>
        </div>

        <div className="field">
          <label htmlFor="report-place">{translate('searchPlace')}</label>
          <div className="city-search-row">
            <input
              id="report-place"
              type="text"
              value={placeQuery}
              onChange={(event) => setPlaceQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') searchPlaces();
              }}
              placeholder={translate('placePlaceholder')}
            />

            <button
              type="button"
              className="secondary-button"
              onClick={searchPlaces}
              disabled={searchingPlace}
            >
              <Search size={17} />
              {searchingPlace ? translate('searching') : translate('search')}
            </button>
          </div>

          {places.length > 0 && (
            <div className="place-results">
              {places.map((place, index) => (
                <button
                  type="button"
                  key={`${place.name}-${place.latitude}-${index}`}
                  onClick={() => choosePlace(place)}
                >
                  <strong>{place.name}</strong>
                  <span>
                    {place.state ? `${place.state}, ` : ''}
                    {place.countryName || ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="filters-grid report-location-grid">
          <div className="field">
            <label htmlFor="report-country">{translate('country')}</label>
            <select
              id="report-country"
              value={countryCode}
              onChange={(event) => chooseCountry(event.target.value)}
            >
              <option value="">{translate('selectCountry')}</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="report-latitude">{translate('latitude')}</label>
            <input
              id="report-latitude"
              type="number"
              step="any"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="report-longitude">{translate('longitude')}</label>
            <input
              id="report-longitude"
              type="number"
              step="any"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
            />
          </div>
        </div>

        <p className="small-note report-country-note">
          {selectedCountry
            ? translate('selectedCountry', 'País selecionado: {{name}}')
                .replace('{{name}}', selectedCountry.name)
            : translate('manualCoordinates')}
        </p>

        <div className="filters-grid">
          <div className="field">
            <label htmlFor="report-start">{translate('startDate')}</label>
            <input
              id="report-start"
              type="date"
              value={startDate}
              max={endDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="report-end">{translate('endDate')}</label>
            <input
              id="report-end"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="report-community">{translate('community')}</label>
            <select
              id="report-community"
              value={community}
              onChange={(event) => setCommunity(event.target.value)}
            >
              <option value="AG">{translate('agriculture')}</option>
              <option value="RE">{translate('renewable')}</option>
              <option value="SB">{translate('buildings')}</option>
            </select>
          </div>
        </div>
      </section>

      <section className="filters-card parameter-card">
        <div className="filter-title">
          <div>
            <span className="eyebrow">{translate('variables')}</span>
            <h3>{translate('parameters')}</h3>
            <p className="muted">{translate('selectUpTo')}</p>
          </div>

          <span className="unit-pill">
            {translate('selectedCount', '{{count}}/20 selecionados')
              .replace('{{count}}', String(selectedParameters.length))}
          </span>
        </div>

        <div className="parameter-groups">
          {Object.entries(groupedParameters).map(([group, items]) => (
            <div className="parameter-group" key={group}>
              <h4>{group}</h4>

              <div className="parameter-options">
                {items.map((parameter) => (
                  <label
                    className={`parameter-option ${
                      selectedParameters.includes(parameter.code) ? 'selected' : ''
                    }`}
                    key={parameter.code}
                  >
                    <input
                      type="checkbox"
                      checked={selectedParameters.includes(parameter.code)}
                      onChange={() => toggleParameter(parameter.code)}
                    />

                    <span>
                      <strong>{parameter.label}</strong>
                      <small>
                        {parameter.code}
                        {parameter.unit ? ` · ${parameter.unit}` : ''}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="report-actions">
          <button
            type="button"
            className="primary-button"
            onClick={runQuery}
            disabled={loading}
          >
            <Search size={18} />
            {loading ? translate('querying') : translate('queryData')}
          </button>
        </div>
      </section>

      {results.length > 0 && (
        <>
          <section className="report-summary-grid">
            {summaries.map((summary) => (
              <article className="stat-card" key={summary.code}>
                <div className="stat-top">
                  <span>{summary.label}</span>
                  <span className="unit-pill">{summary.code}</span>
                </div>

                <strong className="stat-value">
                  {formatValue(summary.mean)}
                  {summary.unit ? ` ${summary.unit}` : ''}
                </strong>

                <span className="stat-note">
                  {translate('averagePeriod')} · {translate('records', '{{count}} registros')
                    .replace('{{count}}', String(summary.count))}
                </span>

                <div className="stat-details">
                  <span>{translate('minimum')} {formatValue(summary.min)}</span>
                  <span>{translate('maximum')} {formatValue(summary.max)}</span>
                </div>
              </article>
            ))}
          </section>

          <section className="panel report-output">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">{translate('queryResult')}</span>
                <h3>{translate('dataFound')}</h3>
                <p className="muted">
                  {selectedPlace} · {startDate} até {endDate}
                </p>
              </div>

              <div className="report-export-actions">
                <button type="button" className="secondary-button" onClick={exportCSV}>
                  <Table2 size={16} />
                  CSV
                </button>

                <button type="button" className="secondary-button" onClick={exportJSON}>
                  <FileJson size={16} />
                  JSON
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => window.print()}
                >
                  <Printer size={16} />
                  {translate('print')}
                </button>
              </div>
            </div>

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{translate('date')}</th>
                    {selectedParameters.map((code) => (
                      <th key={code}>{code}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {results.slice(0, 200).map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>

                      {selectedParameters.map((code) => {
                        const parameter = translatedParameters.find(
                          (item) => item.code === code,
                        );

                        return (
                          <td key={code}>
                            {typeof row[code] === 'number'
                              ? `${formatValue(row[code] as number)} ${parameter?.unit || ''}`
                              : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {results.length > 200 && (
              <p className="chart-footnote">{translate('showFirst')}</p>
            )}

            <div className="report-disclaimer">
              <FileText size={17} />
              <p>
                <strong>{translate('aboutDataTitle')}</strong>{' '}
                {translate('aboutData')}
              </p>
            </div>

            <p className="chart-footnote">
              {translate('source')}{' '}
              <a href={sourceUrl} target="_blank" rel="noreferrer">
                NASA POWER
              </a>
            </p>
          </section>
        </>
      )}

      <AccessibilityTools />
    </div>
  );
}
