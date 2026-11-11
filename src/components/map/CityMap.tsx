
import { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';

import type { CityMapProps } from '../../types/location';

import 'leaflet/dist/leaflet.css';

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

function MapUpdater({
  latitude,
  longitude,
  zoom,
}: {
  latitude: number;
  longitude: number;
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([latitude, longitude], zoom, {
      duration: 1.2,
    });
  }, [latitude, longitude, zoom, map]);

  return null;
}

function MapClick({
  onMapClick,
}: {
  onMapClick?: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click(event) {
      onMapClick?.(
        event.latlng.lat,
        event.latlng.lng,
      );
    },
  });

  return null;
}

export default function CityMap({
  latitude,
  longitude,
  cityName,
  countryName,
  zoom = 5,
  onMapClick,
}: CityMapProps) {
  const center: [number, number] = [latitude, longitude];

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      className="earth-leaflet-map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapUpdater
        latitude={latitude}
        longitude={longitude}
        zoom={zoom}
      />

      <MapClick onMapClick={onMapClick} />

      <Marker position={center} icon={markerIcon}>
        <Popup>
          <strong>
            {cityName || 'Selected location'}
          </strong>
          {countryName && <div>{countryName}</div>}
          <div>
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
