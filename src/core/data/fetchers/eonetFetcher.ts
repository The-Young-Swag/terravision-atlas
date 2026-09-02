import axios from 'axios';
import type { DisasterEvent } from '../../../types';
import { nanoid } from 'nanoid';

// NASA EONET — open, no key, global disaster events
// Docs: https://eonet.gsfc.nasa.gov/docs/v3
const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?limit=20&status=open';

interface EonetEvent {
  id: string;
  title: string;
  description: string | null;
  categories: Array<{ id: string; title: string }>;
  geometry: Array<{ date: string; coordinates: [number, number] }>;
}

function mapEonetCategory(categoryId: string): DisasterEvent['type'] {
  switch (categoryId) {
    case 'wildfires':
      return 'wildfire';
    case 'floods':
      return 'flood';
    case 'severeStorms':
      return 'storm';
    case 'volcanoes':
      return 'volcano';
    case 'landslides':
      return 'landslide';
    default:
      return 'storm';
  }
}

function classifyEonetSeverity(categories: EonetEvent['categories']): DisasterEvent['severity'] {
  const title = categories[0]?.title?.toLowerCase() ?? '';
  if (title.includes('wildfire') || title.includes('volcano')) return 'medium';
  if (title.includes('flood') || title.includes('storm')) return 'low';
  return 'low';
}

export async function fetchEonetEvents(): Promise<DisasterEvent[]> {
  const { data } = await axios.get<{ events: EonetEvent[] }>(EONET_URL, {
    timeout: 8000,
  });

  return data.events
    .filter((event) => event.geometry.length > 0)
    .map((event) => {
      const latestGeometry = event.geometry[event.geometry.length - 1];
      const [lon, lat] = latestGeometry.coordinates;
      return {
        id: `eonet-${event.id}`,
        type: mapEonetCategory(event.categories[0]?.id ?? 'severeStorms'),
        severity: classifyEonetSeverity(event.categories),
        title: event.title,
        description: event.description ?? event.categories[0]?.title ?? 'EONET event',
        latitude: lat,
        longitude: lon,
        occurredAt: latestGeometry.date,
        source: 'NASA EONET',
      };
    });
}

export function mockEonetEvents(): DisasterEvent[] {
  return [
    {
      id: nanoid(),
      type: 'wildfire',
      severity: 'medium',
      title: 'Wildfire — Zambales foothills (FIRMS)',
      description: 'Mock — NASA FIRMS offline',
      latitude: 15.35,
      longitude: 119.9,
      occurredAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      source: 'NASA FIRMS (mock)',
    },
    {
      id: nanoid(),
      type: 'flood',
      severity: 'low',
      title: 'Flood watch — Pampanga River basin',
      description: 'Mock — GloFAS forecast',
      latitude: 15.05,
      longitude: 120.7,
      occurredAt: new Date(Date.now() - 41 * 60 * 1000).toISOString(),
      source: 'GloFAS (mock)',
    },
  ];
}
