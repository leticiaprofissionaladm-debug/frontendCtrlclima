import { api } from './api';
import type { Country, StateRegion, City } from '../types/location';

export async function buscarPaises(): Promise<Country[]> {
  const response = await api.get<Country[]>('/locations/countries');
  return response.data;
}

export async function buscarEstados(
  countryCode: string,
): Promise<StateRegion[]> {
  const response = await api.get<StateRegion[]>('/locations/states', {
    params: { countryCode },
  });

  return response.data;
}

export async function buscarCidades(
  countryCode: string,
  state: string,
  search: string,
): Promise<City[]> {
  const response = await api.get<City[]>('/locations/cities', {
    params: { countryCode, state, search },
  });

  return response.data;
}
