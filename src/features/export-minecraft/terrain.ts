// Real-elevation sampler for the Minecraft export: reads the AWS Terrain
// Tiles dataset (Terrarium PNG, no key, no auth) and converts one 512x512 m
// area into surface heights, one meter per block. Roads, buildings and
// vegetation are NOT included — no open dataset provides them in a form this
// client-side exporter can consume, and inventing them would violate the
// no-fake-data rule. The UI states exactly this.

export const REGION_BLOCKS = 512;
const SAMPLE_ZOOM = 15;
const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const FETCH_TIMEOUT_MS = 15000;

export interface SampledTerrain {
  heights: Int16Array; // REGION_BLOCKS^2 surface Y values, row-major (bz * 512 + bx)
  minHeight: number;
  maxHeight: number;
}

export function lonToTileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

export function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 2 ** zoom);
}

export function tileXToLon(x: number, zoom: number): number {
  return (x / 2 ** zoom) * 360 - 180;
}

export function tileYToLat(y: number, zoom: number): number {
  const n = Math.PI * (1 - (2 * y) / 2 ** zoom);
  return (Math.atan((Math.E ** n - Math.E ** -n) / 2) * 180) / Math.PI;
}

/** Lon/lat of a block column inside the exported region. */
export function blockLonLat(
  centerLon: number,
  centerLat: number,
  blockX: number,
  blockZ: number,
): { lon: number; lat: number } {
  const metersPerDegLon = 111320 * Math.cos((centerLat * Math.PI) / 180);
  return {
    lon: centerLon + (blockX - (REGION_BLOCKS - 1) / 2) / metersPerDegLon,
    lat: centerLat - (blockZ - (REGION_BLOCKS - 1) / 2) / 110540,
  };
}

function decodeTerrarium(data: Uint8ClampedArray): Float32Array {
  const heights = new Float32Array((data.length / 4) | 0);
  for (let i = 0; i < heights.length; i++) {
    heights[i] = data[i * 4] * 256 + data[i * 4 + 1] + data[i * 4 + 2] / 256 - 32768;
  }
  return heights;
}

async function fetchTilePixels(x: number, y: number): Promise<{ heights: Float32Array; size: number }> {
  const url = TERRARIUM_URL.replace('{z}', String(SAMPLE_ZOOM)).replace('{x}', String(x)).replace('{y}', String(y));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    const wrapped = new Error(`Elevation tile ${SAMPLE_ZOOM}/${x}/${y} did not load`);
    (wrapped as { cause?: unknown }).cause = error;
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(`Elevation tile ${SAMPLE_ZOOM}/${x}/${y} returned HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Elevation tile ${SAMPLE_ZOOM}/${x}/${y} is not a decodable image`));
      img.src = objectUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('2D canvas is unavailable, cannot decode elevation tiles');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    return { heights: decodeTerrarium(pixels.data), size: canvas.width };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Sample surface heights for a REGION_BLOCKSxREGION_BLOCKS meter area
 * centered on (centerLon, centerLat). Throws with a plain-language message
 * when tiles cannot be fetched or decoded — callers show the failure, never
 * a fabricated fallback.
 */
export async function sampleTerrain(centerLon: number, centerLat: number): Promise<SampledTerrain> {
  const corners = [
    blockLonLat(centerLon, centerLat, 0, 0),
    blockLonLat(centerLon, centerLat, REGION_BLOCKS - 1, REGION_BLOCKS - 1),
  ];
  const minLon = Math.min(corners[0].lon, corners[1].lon);
  const maxLon = Math.max(corners[0].lon, corners[1].lon);
  const minLat = Math.min(corners[0].lat, corners[1].lat);
  const maxLat = Math.max(corners[0].lat, corners[1].lat);

  const x0 = lonToTileX(minLon, SAMPLE_ZOOM);
  const x1 = lonToTileX(maxLon, SAMPLE_ZOOM);
  const y0 = latToTileY(maxLat, SAMPLE_ZOOM);
  const y1 = latToTileY(minLat, SAMPLE_ZOOM);

  const tiles = new Map<string, { heights: Float32Array; size: number }>();
  await Promise.all(
    Array.from({ length: x1 - x0 + 1 }, (_, dx) =>
      Array.from({ length: y1 - y0 + 1 }, async (_, dy) => {
        tiles.set(`${x0 + dx}/${y0 + dy}`, await fetchTilePixels(x0 + dx, y0 + dy));
      }),
    ).flat(),
  );

  const heights = new Int16Array(REGION_BLOCKS * REGION_BLOCKS);
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  for (let bz = 0; bz < REGION_BLOCKS; bz++) {
    for (let bx = 0; bx < REGION_BLOCKS; bx++) {
      const { lon, lat } = blockLonLat(centerLon, centerLat, bx, bz);
      const tx = lonToTileX(lon, SAMPLE_ZOOM);
      const ty = latToTileY(lat, SAMPLE_ZOOM);
      const tile = tiles.get(`${tx}/${ty}`);
      if (!tile) throw new Error(`No elevation tile covers block (${bx}, ${bz})`);
      const west = tileXToLon(tx, SAMPLE_ZOOM);
      const east = tileXToLon(tx + 1, SAMPLE_ZOOM);
      const north = tileYToLat(ty, SAMPLE_ZOOM);
      const south = tileYToLat(ty + 1, SAMPLE_ZOOM);
      const px = Math.min(tile.size - 1, Math.max(0, Math.floor(((lon - west) / (east - west)) * tile.size)));
      const py = Math.min(tile.size - 1, Math.max(0, Math.floor(((north - lat) / (north - south)) * tile.size)));
      const elevation = Math.round(tile.heights[py * tile.size + px]);
      const clamped = Math.min(319, Math.max(-63, elevation));
      heights[bz * REGION_BLOCKS + bx] = clamped;
      if (clamped < minHeight) minHeight = clamped;
      if (clamped > maxHeight) maxHeight = clamped;
    }
  }
  return { heights, minHeight, maxHeight };
}
