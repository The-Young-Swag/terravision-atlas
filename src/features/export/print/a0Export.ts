import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat } from 'ol/proj';
import { createBasemapLayer } from '../../../core/map/openlayers/basemapLayers';
import type { BasemapId, StreetsSourceId } from '../../../stores/mapStore';
import type { SatelliteSourceId } from '../../../core/map/gibs';

// Large-format map export: re-renders the current 2D view offscreen at A0
// portrait size (150 dpi) with real map tiles — not an upscale of the
// viewport — then downloads it as a PNG with a title strip. Follows the
// official OpenLayers export pattern (hidden map + rendercomplete +
// canvas composition). 2D only: only OpenLayers exposes its render
// canvases for composition.

export const A0_WIDTH_PX = 4961; // A0 portrait at 150 dpi
export const A0_HEIGHT_PX = 7016;
const RENDER_TIMEOUT_MS = 90000;

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG encoding failed'));
    }, 'image/png');
  });
}

export async function exportA0Png(
  centerLon: number,
  centerLat: number,
  zoom: number,
  basemap: BasemapId,
  satelliteSource: SatelliteSourceId = 'esri',
  streetsSource: StreetsSourceId = 'osm',
  onProgress?: (stage: string) => void,
): Promise<Blob> {
  onProgress?.('Preparing A0 canvas…');
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-20000px';
  container.style.top = '0';
  container.style.width = `${A0_WIDTH_PX}px`;
  container.style.height = `${A0_HEIGHT_PX}px`;
  document.body.appendChild(container);

  const printMap = new Map({
    layers: [createBasemapLayer(basemap, 'anonymous', satelliteSource, streetsSource)],
    target: container,
    view: new View({ center: fromLonLat([centerLon, centerLat]), zoom }),
  });
  printMap.setSize([A0_WIDTH_PX, A0_HEIGHT_PX]);

  try {
    onProgress?.('Rendering map tiles…');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Tile rendering timed out — check connection and retry')), RENDER_TIMEOUT_MS);
      printMap.once('rendercomplete', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    onProgress?.('Composing PNG…');
    const composed = document.createElement('canvas');
    composed.width = A0_WIDTH_PX;
    composed.height = A0_HEIGHT_PX;
    const context = composed.getContext('2d');
    if (!context) throw new Error('2D canvas is unavailable');
    container.querySelectorAll('.ol-layer canvas').forEach((layerCanvas) => {
      context.drawImage(layerCanvas as HTMLCanvasElement, 0, 0);
    });

    const stripHeight = 120;
    context.fillStyle = 'rgba(13, 27, 42, 0.92)';
    context.fillRect(0, A0_HEIGHT_PX - stripHeight, A0_WIDTH_PX, stripHeight);
    context.fillStyle = '#f8fafc';
    context.font = '48px monospace';
    context.fillText(
      `TerraVision Atlas · ${Math.abs(centerLat).toFixed(4)}°${centerLat >= 0 ? 'N' : 'S'}, ${Math.abs(centerLon).toFixed(4)}°${centerLon >= 0 ? 'E' : 'W'} · zoom ${zoom.toFixed(1)} · ${basemap} · ${new Date().toISOString().slice(0, 10)}`,
      48,
      A0_HEIGHT_PX - 48,
    );

    return await canvasToBlob(composed);
  } finally {
    printMap.setTarget(undefined);
    container.remove();
  }
}

export function downloadA0Png(blob: Blob, basemap: BasemapId, zoom: number): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `terravision-a0-${basemap}-z${zoom.toFixed(1)}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
