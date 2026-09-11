import axios from 'axios';
import type { DisasterEvent } from '../../../types';

// NASA FIRMS active-fire hotspots — direct near-real-time detections.
// Docs: https://www.earthdata.nasa.gov/faq/firms-faq (API area/csv path)
// Path shape: /api/area/csv/{MAP_KEY}/{SOURCE}/{west,south,east,north}/{days}
// Uses the .env MAP_KEY (VITE_NASA_FIRMS_MAP_KEY); EONET remains the primary
// wildfire source — FIRMS only adds higher-frequency hotspot points when the
// key is present. One transaction per poll cycle, far inside the 5,000
// transactions-per-10-minutes MAP_KEY limit.
const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
const FIRMS_SOURCE = 'VIIRS_SNPP_NRT';
const FIRMS_DAY_RANGE = 1;
const REQUEST_TIMEOUT_MS = 15000;

/** Half-span in degrees of the view-centered FIRMS query window (~550 km). */
export const FIRMS_HALF_SPAN_DEG = 2.5;
/** Cap so hotspot points enrich rather than flood the merged feed. */
export const FIRMS_MAX_POINTS = 20;

export interface FirmsBBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export function firmsApiKey(): string | null {
  const key = import.meta.env.VITE_NASA_FIRMS_MAP_KEY as string | undefined;
  return key && key.length > 0 ? key : null;
}

export function buildFirmsUrl(bbox: FirmsBBox, key: string): string {
  const area = `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`;
  return `${FIRMS_BASE}/${key}/${FIRMS_SOURCE}/${area}/${FIRMS_DAY_RANGE}`;
}

export function firmsQueryBBox(centerLon: number, centerLat: number): FirmsBBox {
  return {
    minLon: centerLon - FIRMS_HALF_SPAN_DEG,
    minLat: Math.max(-90, centerLat - FIRMS_HALF_SPAN_DEG),
    maxLon: centerLon + FIRMS_HALF_SPAN_DEG,
    maxLat: Math.min(90, centerLat + FIRMS_HALF_SPAN_DEG),
  };
}

interface FirmsRow {
  latitude: number;
  longitude: number;
  bright_ti4: number;
  confidence: string;
  acq_date: string;
  acq_time: string;
}

/** Pure CSV transform, exported for unit tests. */
export function parseFirmsCsv(csv: string): FirmsRow[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const header = (lines[0] ?? '').split(',');
  const idx = (name: string) => header.indexOf(name);
  const latI = idx('latitude');
  const lonI = idx('longitude');
  const brightI = idx('bright_ti4');
  const confI = idx('confidence');
  const dateI = idx('acq_date');
  const timeI = idx('acq_time');
  if (latI < 0 || lonI < 0) return [];
  const rows: FirmsRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    const lat = Number(cols[latI]);
    const lon = Number(cols[lonI]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    rows.push({
      latitude: lat,
      longitude: lon,
      bright_ti4: Number(cols[brightI] ?? NaN),
      confidence: (cols[confI] ?? '').trim().toLowerCase(),
      acq_date: (cols[dateI] ?? '').trim(),
      acq_time: (cols[timeI] ?? '').trim().padStart(4, '0'),
    });
  }
  return rows;
}

// FIRMS rows are raw detections, not assessed events: high-confidence
// hotspots read as medium severity, everything else low. Never high —
// only assessed sources (USGS magnitude) assign high.
function classifyFirmsSeverity(confidence: string): DisasterEvent['severity'] {
  return confidence === 'h' ? 'medium' : 'low';
}

function firmsOccurredAt(row: FirmsRow): string {
  const time = row.acq_time;
  const iso = `${row.acq_date}T${time.slice(0, 2)}:${time.slice(2, 4)}:00Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

/** Pure row mapping, exported for unit tests. */
export function firmsRowsToEvents(rows: FirmsRow[]): DisasterEvent[] {
  return rows.slice(0, FIRMS_MAX_POINTS).map((row) => ({
    id: `firms-${row.latitude.toFixed(3)}-${row.longitude.toFixed(3)}-${row.acq_date}`,
    type: 'wildfire' as const,
    severity: classifyFirmsSeverity(row.confidence),
    title: `FIRMS hotspot ${row.latitude.toFixed(2)}, ${row.longitude.toFixed(2)}`,
    description: 'VIIRS active-fire detection via NASA FIRMS',
    latitude: row.latitude,
    longitude: row.longitude,
    occurredAt: firmsOccurredAt(row),
    source: 'NASA FIRMS',
  }));
}

/**
 * Fetch active-fire hotspots around a center point. Returns [] when no key
 * is configured (EONET stays the wildfire source) — never throws for a
 * missing key. Throws with a plain message on network failure so callers
 * can report partial-feed status honestly.
 */
export async function fetchFirmsHotspots(centerLon: number, centerLat: number): Promise<DisasterEvent[]> {
  const key = firmsApiKey();
  if (!key) return [];
  const url = buildFirmsUrl(firmsQueryBBox(centerLon, centerLat), key);
  try {
    const { data } = await axios.get<string>(url, {
      timeout: REQUEST_TIMEOUT_MS,
      responseType: 'text',
    });
    return firmsRowsToEvents(parseFirmsCsv(data));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const failed = new Error(
        status !== undefined ? `FIRMS request failed (HTTP ${status})` : `FIRMS unreachable: ${error.message}`,
      );
      (failed as { cause?: unknown }).cause = error;
      throw failed;
    }
    throw error;
  }
}
