import axios from 'axios';
import type { DisasterEvent } from '../../../types';
import { nanoid } from 'nanoid';

// USGS Earthquake feed — public, no key, real-time
// Docs: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
const USGS_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

interface UsgsFeature {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    title: string;
  };
  geometry: {
    coordinates: [number, number, number]; // [lon, lat, depth]
  };
}

function classifyEarthquakeSeverity(mag: number | null): DisasterEvent['severity'] {
  if (mag === null) return 'low';
  if (mag >= 6) return 'high';
  if (mag >= 5) return 'medium';
  return 'low';
}

export async function fetchUsgsEarthquakes(): Promise<DisasterEvent[]> {
  const { data } = await axios.get<{ features: UsgsFeature[] }>(USGS_URL, {
    timeout: 8000,
  });

  return data.features.slice(0, 20).map((feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    const mag = feature.properties.mag;
    return {
      id: `usgs-${feature.id}`,
      type: 'earthquake' as const,
      severity: classifyEarthquakeSeverity(mag),
      title: feature.properties.title ?? `M${mag ?? '?'} — ${feature.properties.place ?? 'Unknown'}`,
      description: feature.properties.place ?? 'Earthquake detected by USGS',
      latitude: lat,
      longitude: lon,
      occurredAt: new Date(feature.properties.time).toISOString(),
      source: 'USGS',
    };
  });
}

// Fallback mock when offline or API fails — keeps UI alive
export function mockEarthquakes(): DisasterEvent[] {
  return [
    {
      id: nanoid(),
      type: 'earthquake',
      severity: 'high',
      title: 'M6.1 — 40km NE of Baguio City',
      description: 'Mock — USGS offline',
      latitude: 15.145,
      longitude: 120.5887,
      occurredAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      source: 'USGS (mock)',
    },
    {
      id: nanoid(),
      type: 'earthquake',
      severity: 'medium',
      title: 'M5.2 — 12km S of Zambales',
      description: 'Mock — aftershock',
      latitude: 15.02,
      longitude: 119.93,
      occurredAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      source: 'USGS (mock)',
    },
  ];
}
