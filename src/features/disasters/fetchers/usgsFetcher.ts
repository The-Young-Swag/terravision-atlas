import axios from 'axios';
import type { DisasterEvent } from '../../../types';

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


