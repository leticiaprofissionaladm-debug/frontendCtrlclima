export interface Country {
  id: string;
  name: string;
  code: string;
  iso2: string;
  iso3?: string;
  latitude?: number | null;
  longitude?: number | null;
  flag?: string;
}

export interface StateRegion {
  id: string;
  name: string;
  code: string | null;
  countryCode: string;
}

export interface City {
  id: string;
  name: string;
  countryCode: string;
  countryName?: string;
  state?: string | null;
  stateCode?: string | null;
  latitude: number | null;
  longitude: number | null;
  population?: number | null;
}

export interface SelectedLocation {
  country: Country;
  state?: StateRegion | null;
  city: City | null;
  latitude: number;
  longitude: number;
}

export interface MapCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationFilterProps {
  onLocationChange: (location: SelectedLocation | null) => void;
}

export interface CityMapProps {
  latitude: number;
  longitude: number;
  cityName?: string;
  countryName?: string;
  zoom?: number;
  onMapClick?: (latitude: number, longitude: number) => void;
}
