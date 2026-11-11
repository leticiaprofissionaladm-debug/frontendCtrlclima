
import { api } from './api';

// ==========================================
// TIPOS DA ANÁLISE HISTÓRICA
// ==========================================

export interface AnnualTemperature {
  year: number;
  average: number;
  validDays: number;
  isComplete: boolean;
  variationFromPreviousYear: number | null;
}

export type TrendDirection =
  | 'AUMENTO'
  | 'DIMINUICAO'
  | 'ESTAVEL'
  | 'INDETERMINADA';

export interface PeriodComparison {
  firstPeriod: {
    startYear: number;
    endYear: number;
    average: number;
    yearsCount: number;
  };

  lastPeriod: {
    startYear: number;
    endYear: number;
    average: number;
    yearsCount: number;
  };

  difference: number;
  direction: TrendDirection;
  description: string;
}

export interface HistoricalAnalysis {
  parameter: string;
  label?: string;
  unit: string;
  status: string;
  message?: string;

  period?: {
    start: string;
    end: string;
  };

  totalValidDays?: number;

  annualAverages: AnnualTemperature[];

  completeYearsCount?: number;

  periodComparison: PeriodComparison | null;

  trend: {
    direction: TrendDirection;
    slopePerYear: number | null;
    description: string;
  };

  methodology?: {
    annualAverage: string;
    periodComparison: string;
    trend: string;
    missingValues: string;
    minimumDaysForCompleteYear: number;
  };
}

// ==========================================
// TIPOS DA RESPOSTA NASA POWER
// ==========================================

export interface NasaPowerResponse {
  source: string;
  sourceUrl: string;
  homeUrl: string;
  documentationUrl: string;

  coordinates: {
    latitude: number;
    longitude: number;
  };

  period: {
    start: string;
    end: string;
  };

  community?: string;

  parameters: string[];

  unitMetadata: Record<
    string,
    {
      units?: string;
      longname?: string;
    }
  >;

  data: Record<string, Record<string, number>>;

  historicalAnalysis: HistoricalAnalysis | null;

  messages: string[];
}

// ==========================================
// RESPOSTA ORIGINAL DO BACKEND
// ==========================================

interface NasaPowerRawResponse {
  source: string;
  sourceUrl: string;

  homeUrl?: string;
  documentationUrl?: string;

  coordinates: {
    latitude: number;
    longitude: number;
  };

  period: {
    start: string;
    end: string;
  };

  community?: string;

  parameters: string[];

  unitMetadata?: NasaPowerResponse['unitMetadata'];

  data?: NasaPowerResponse['data'];
  dados?: NasaPowerResponse['data'];

  historicalAnalysis?: HistoricalAnalysis | null;

  messages?: string[];
  mensagens?: string[];
}

// ==========================================
// CONSULTA NASA POWER
// ==========================================

export async function buscarDadosNasa(
  latitude: number,
  longitude: number,
  start: string,
  end: string,
): Promise<NasaPowerResponse> {
  console.log('Iniciando solicitação NASA POWER...');

  try {
    const response = await api.get<NasaPowerRawResponse>(
      '/nasa/power',
      {
        params: {
          latitude,
          longitude,
          start,
          end,
          parameters: 'T2M,T2M_MAX,T2M_MIN,RH2M,PRECTOTCORR,WS2M',
        },
      },
    );

    const result = response.data;

    const dados = result.data ?? result.dados ?? {};

    const historicalAnalysis = result.historicalAnalysis ?? null;

    console.log('Resposta original da NASA:', result);
    console.log('Dados normalizados:', dados);
    console.log('Análise histórica:', historicalAnalysis);
    console.log('Parâmetros recebidos:', Object.keys(dados));

    return {
      source: result.source,
      sourceUrl: result.sourceUrl,

      homeUrl:
        result.homeUrl ??
        'https://power.larc.nasa.gov/',

      documentationUrl:
        result.documentationUrl ??
        'https://power.larc.nasa.gov/docs/',

      coordinates: result.coordinates,
      period: result.period,
      community: result.community,
      parameters: result.parameters,

      unitMetadata: result.unitMetadata ?? {},

      data: dados,

      historicalAnalysis,

      messages: result.messages ?? result.mensagens ?? [],
    };
  } catch (error) {
    console.error('Erro ao buscar dados da NASA POWER:', error);
    throw error;
  }
}
