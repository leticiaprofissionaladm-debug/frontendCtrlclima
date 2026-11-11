
import { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin,
  Globe2,
  Crosshair,
  Layers3,
  Thermometer,
  Droplets,
  CloudRain,
  Wind,
  RefreshCw,
} from 'lucide-react';

import LocationFilter from '../components/map/LocationFilter';
import type { SelectedLocation } from '../types/location';
import {
  buscarDadosNasa,
  type NasaPowerResponse,
} from '../services/nasaService.js';

import 'leaflet/dist/leaflet.css';
import '../components/map/map.css';

const markerIcon = new L.Icon({
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface MapClickHandlerProps {
  onSelect: (latitude: number, longitude: number) => void;
}

function MapClickHandler({ onSelect }: MapClickHandlerProps) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

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

function formatarValor(value: number | null, decimals = 1) {
  if (value === null) return 'No data';
  return value.toFixed(decimals);
}

export default function EarthExplorer() {
  const [location, setLocation] = useState<SelectedLocation | null>(null);

  const [coordinates, setCoordinates] = useState({
    latitude: -14.235,
    longitude: -51.9253,
  });

  const [nasaData, setNasaData] =
    useState<NasaPowerResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [nasaError, setNasaError] = useState('');

  // Período inicial de consulta: janeiro de 2025.
  const startDate = '20250101';
  const endDate = '20250107';

  useEffect(() => {
    let cancelled = false;

    async function carregarDados() {
      setLoading(true);
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
        console.error('NASA POWER error:', error);

        if (!cancelled) {
          setNasaError(
            'Unable to retrieve environmental data from NASA POWER. Please try again.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    carregarDados();

    return () => {
      cancelled = true;
    };
  }, [coordinates.latitude, coordinates.longitude]);

  function handleLocationChange(selected: SelectedLocation | null) {
    setLocation(selected);

    if (selected) {
      setCoordinates({
        latitude: selected.latitude,
        longitude: selected.longitude,
      });
    }
  }

  function handleMapClick(latitude: number, longitude: number) {
    setLocation(null);
    setCoordinates({ latitude, longitude });
  }

  const mapCenter: [number, number] = [
    coordinates.latitude,
    coordinates.longitude,
  ];

  const data = nasaData?.data;

  const averageTemperature = calcularMedia(data?.T2M);
  const maximumTemperature = calcularMedia(data?.T2M_MAX);
  const minimumTemperature = calcularMedia(data?.T2M_MIN);
  const averageHumidity = calcularMedia(data?.RH2M);
  const averagePrecipitation = calcularMedia(data?.PRECTOTCORR);
  const averageWind = calcularMedia(data?.WS2M);

  const indicators = [
    {
      label: 'Average air temperature',
      value: averageTemperature,
      unit: '°C',
      icon: Thermometer,
      parameter: 'T2M',
    },
    {
      label: 'Maximum temperature',
      value: maximumTemperature,
      unit: '°C',
      icon: Thermometer,
      parameter: 'T2M_MAX',
    },
    {
      label: 'Minimum temperature',
      value: minimumTemperature,
      unit: '°C',
      icon: Thermometer,
      parameter: 'T2M_MIN',
    },
    {
      label: 'Relative humidity',
      value: averageHumidity,
      unit: '%',
      icon: Droplets,
      parameter: 'RH2M',
    },
    {
      label: 'Daily average precipitation',
      value: averagePrecipitation,
      unit: 'mm/day',
      icon: CloudRain,
      parameter: 'PRECTOTCORR',
    },
    {
      label: 'Average wind speed',
      value: averageWind,
      unit: 'm/s',
      icon: Wind,
      parameter: 'WS2M',
    },
  ];

  return (
    <main className="earth-explorer-page">
      <section className="explorer-heading">
        <div>
          <span className="explorer-eyebrow">
            <Globe2 size={15} />
            EARTH SYSTEM OBSERVATION
          </span>

          <h1>
            Explore our <span>planet.</span>
          </h1>

          <p>
            Select a location and investigate environmental
            patterns across the Earth.
          </p>
        </div>
      </section>

      <section className="explorer-workspace">
        <aside className="explorer-sidebar">
          <div className="explorer-panel-heading">
            <MapPin size={19} />
            <h2>Location explorer</h2>
          </div>

          <p className="explorer-description">
            Choose a country and city to explore its
            environmental data.
          </p>

          <LocationFilter
            onLocationChange={handleLocationChange}
          />

          <div className="explorer-coordinates">
            <span>SELECTED COORDINATES</span>

            <div>
              <small>LATITUDE</small>
              <strong>{coordinates.latitude.toFixed(4)}°</strong>
            </div>

            <div>
              <small>LONGITUDE</small>
              <strong>{coordinates.longitude.toFixed(4)}°</strong>
            </div>
          </div>

          <div className="explorer-selected-location">
            <Crosshair size={17} />

            <span>
              {location?.city
                ? `${location.city.name}, ${location.country.name}`
                : location?.country.name ||
                  'Select a point on the map'}
            </span>
          </div>
        </aside>

        <div className="explorer-map-section">
          <div className="explorer-map-header">
            <div>
              <Layers3 size={18} />
              <strong>Interactive Earth Map</strong>
            </div>

            <span className="map-status">
              <span />
              OPENSTREETMAP
            </span>
          </div>

          <div className="explorer-map">
            <MapContainer
              center={mapCenter}
              zoom={location ? 10 : 3}
              scrollWheelZoom
              className="earth-leaflet-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapClickHandler onSelect={handleMapClick} />

              <Marker position={mapCenter} icon={markerIcon}>
                <Popup>
                  <strong>
                    {location?.city?.name ||
                      location?.country.name ||
                      'Selected location'}
                  </strong>
                  <br />
                  {coordinates.latitude.toFixed(4)},{' '}
                  {coordinates.longitude.toFixed(4)}
                </Popup>
              </Marker>

              <MapCenterUpdater center={mapCenter} />
            </MapContainer>
          </div>

          <div className="explorer-map-footer">
            <span>
              Click anywhere on the map to select coordinates.
            </span>

            <span>
              <MapPin size={14} />
              {coordinates.latitude.toFixed(2)}°,{' '}
              {coordinates.longitude.toFixed(2)}°
            </span>
          </div>
        </div>
      </section>

      <section className="nasa-data-section">
        <div className="nasa-data-heading">
          <div>
            <span className="explorer-eyebrow">
              <Globe2 size={15} />
              NASA POWER DATA
            </span>

            <h2>Environmental conditions</h2>

            <p>
              Daily environmental observations for the selected
              coordinates.
            </p>
          </div>

          <span className="nasa-period">
            JAN 01 – JAN 07, 2025
          </span>
        </div>

        {loading && (
          <div className="nasa-feedback">
            <RefreshCw size={18} className="nasa-loading-icon" />
            Retrieving environmental data from NASA...
          </div>
        )}

        {!loading && nasaError && (
          <div className="nasa-feedback nasa-error">
            {nasaError}
          </div>
        )}

        {!loading && nasaData && (
          <>
            <div className="nasa-indicators">
              {indicators.map((item) => {
                const Icon = item.icon;

                return (
                  <article
                    className="nasa-indicator-card"
                    key={item.parameter}
                  >
                    <div className="nasa-indicator-icon">
                      <Icon size={20} />
                    </div>

                    <span className="nasa-indicator-label">
                      {item.label}
                    </span>

                    <strong className="nasa-indicator-value">
                      {formatarValor(item.value)}
                      <small>{item.unit}</small>
                    </strong>

                    <span className="nasa-indicator-source">
                      {item.parameter}
                    </span>
                  </article>
                );
              })}
            </div>

            <div className="nasa-source-note">
              <span>
                Source: <strong>{nasaData.source}</strong>
              </span>

              <span>
                Coordinates:{' '}
                {nasaData.coordinates.latitude.toFixed(4)},{' '}
                {nasaData.coordinates.longitude.toFixed(4)}
              </span>

              <span>
                Air temperature at 2 meters. This is not land
                surface temperature (LST).
              </span>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function MapCenterUpdater({
  center,
}: {
  center: [number, number];
}) {
  const map = useMapEvents({});

  map.setView(center, map.getZoom(), {
    animate: true,
  });

  return null;
}
