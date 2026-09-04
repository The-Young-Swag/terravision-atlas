import type { Map as MapLibreMap } from 'maplibre-gl';
import { circlePolygon, type EvacCircle } from '../../../features/routing/avoidZone';

// Standalone avoid-zone overlay for the Vector map: hatched red fill plus
// outline, rendered whenever an avoid circle exists, with or without a
// route. The hatch marks the area as excluded rather than selected.
export const AVOID_SOURCE_ID = 'evac-avoid';
export const AVOID_FILL_LAYER_ID = 'evac-avoid-fill';
export const AVOID_LINE_LAYER_ID = 'evac-avoid-line';
const AVOID_HATCH_IMAGE_ID = 'evac-hatch';

function ensureHatchImage(map: MapLibreMap): void {
  if (map.hasImage(AVOID_HATCH_IMAGE_ID)) return;
  const size = 12;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.strokeStyle = 'rgba(230, 57, 70, 0.9)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-2, size + 2);
  context.lineTo(size + 2, -2);
  context.moveTo(-2, 2);
  context.lineTo(2, -2);
  context.moveTo(size - 2, size + 2);
  context.lineTo(size + 2, size - 2);
  context.stroke();
  map.addImage(AVOID_HATCH_IMAGE_ID, context.getImageData(0, 0, size, size));
}

export function setAvoidVisible(map: MapLibreMap, circle: EvacCircle | null): void {
  removeAvoidLayers(map);
  if (!circle) return;
  ensureHatchImage(map);
  if (!map.hasImage(AVOID_HATCH_IMAGE_ID)) return;
  map.addSource(AVOID_SOURCE_ID, {
    type: 'geojson',
    data: circlePolygon(circle),
  });
  map.addLayer({
    id: AVOID_FILL_LAYER_ID,
    type: 'fill',
    source: AVOID_SOURCE_ID,
    paint: {
      'fill-pattern': AVOID_HATCH_IMAGE_ID,
      'fill-opacity': 0.55,
    },
  });
  map.addLayer({
    id: AVOID_LINE_LAYER_ID,
    type: 'line',
    source: AVOID_SOURCE_ID,
    paint: {
      'line-color': '#E63946',
      'line-width': 2,
      'line-dasharray': [3, 2],
    },
  });
}

export const AVOID_PREVIEW_SOURCE_ID = 'evac-avoid-preview';
export const AVOID_PREVIEW_LAYER_ID = 'evac-avoid-preview-layer';

/** Ephemeral drag preview: dashed outline, no hatch (the hatch marks final zones). */
export function setAvoidPreview(map: MapLibreMap, circle: EvacCircle | null): void {
  if (map.getLayer(AVOID_PREVIEW_LAYER_ID)) {
    map.removeLayer(AVOID_PREVIEW_LAYER_ID);
  }
  if (map.getSource(AVOID_PREVIEW_SOURCE_ID)) {
    map.removeSource(AVOID_PREVIEW_SOURCE_ID);
  }
  if (!circle) return;
  map.addSource(AVOID_PREVIEW_SOURCE_ID, {
    type: 'geojson',
    data: circlePolygon(circle),
  });
  map.addLayer({
    id: AVOID_PREVIEW_LAYER_ID,
    type: 'line',
    source: AVOID_PREVIEW_SOURCE_ID,
    paint: {
      'line-color': '#E63946',
      'line-width': 2,
      'line-dasharray': [2, 2],
    },
  });
}

export function removeAvoidLayers(map: MapLibreMap): void {
  setAvoidPreview(map, null);
  if (map.getLayer(AVOID_LINE_LAYER_ID)) {
    map.removeLayer(AVOID_LINE_LAYER_ID);
  }
  if (map.getLayer(AVOID_FILL_LAYER_ID)) {
    map.removeLayer(AVOID_FILL_LAYER_ID);
  }
  if (map.getSource(AVOID_SOURCE_ID)) {
    map.removeSource(AVOID_SOURCE_ID);
  }
}
