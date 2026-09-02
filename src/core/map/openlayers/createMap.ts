import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat } from 'ol/proj';
import { createBasemapLayer } from './basemapLayers';
import type { BasemapId } from '../../../stores/mapStore';

export interface CreateMapOptions {
  target: HTMLElement;
  center: [number, number]; // [lon, lat]
  zoom: number;
  basemap: BasemapId;
}

// Creates an OpenLayers map with a single basemap layer.
// The caller owns lifecycle (setTarget(null) on unmount).
export function createMap(options: CreateMapOptions): Map {
  const { target, center, zoom, basemap } = options;

  const basemapLayer = createBasemapLayer(basemap);

  const map = new Map({
    target,
    layers: [basemapLayer],
    view: new View({
      center: fromLonLat(center),
      zoom,
      maxZoom: 19,
      minZoom: 2,
    }),
    controls: [],
  });

  return map;
}

// Helper to swap basemap without recreating the whole map.
export function updateBasemap(map: Map, basemap: BasemapId): void {
  const layers = map.getLayers();
  const oldBasemap = layers.item(0);
  if (oldBasemap) {
    map.removeLayer(oldBasemap);
  }
  const newLayer = createBasemapLayer(basemap);
  layers.insertAt(0, newLayer);
}
