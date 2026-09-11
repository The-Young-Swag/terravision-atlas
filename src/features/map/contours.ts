import { addProtocol } from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import mlcontour from 'maplibre-contour';

// Terrain contour lines for the Vector (MapLibre) map.
//
// Elevation comes from the AWS Terrain Tiles dataset (Terrarium PNG, no key,
// no auth). Contour isolines are generated client-side from those tiles by
// maplibre-contour, which registers a custom tile protocol with MapLibre —
// no pre-generated contour tiles are fetched anywhere.
//
// Why `worker: false`: maplibre-contour's web-worker mode requires the host
// app to bundle and serve the package's worker file itself. Computing on the
// main thread needs no worker bundling and generated tiles are cached, so
// each tile is only computed once.
//
// Why lines only, no elevation labels: label layers need a glyph source in
// the map style and this style is a plain OSM raster with none. The lines
// carry the elevation data; labels would need hosted fonts.

export const CONTOUR_SOURCE_ID = 'terrain-contours';
export const CONTOUR_LINES_LAYER_ID = 'terrain-contour-lines';

const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const CONTOUR_ATTRIBUTION = '© AWS Terrain Tiles';

// Minor/major contour interval in meters per zoom level. Finer intervals at
// high zoom so flat lowlands stay clean while mountains show detail.
const CONTOUR_THRESHOLDS: Record<number, [number, number]> = {
  9: [500, 2000],
  10: [200, 1000],
  11: [100, 500],
  12: [50, 250],
  13: [20, 100],
  14: [10, 50],
  15: [10, 50],
};

type DemSourceInstance = InstanceType<typeof mlcontour.DemSource>;

let demSource: DemSourceInstance | null = null;
let protocolRegistered = false;

function getDemSource(): DemSourceInstance {
  if (!demSource) {
    demSource = new mlcontour.DemSource({
      url: TERRARIUM_URL,
      encoding: 'terrarium',
      maxzoom: 15,
      worker: false,
    });
  }
  if (!protocolRegistered) {
    demSource.setupMaplibre({ addProtocol });
    protocolRegistered = true;
  }
  return demSource;
}

export function addContourLayers(map: MapLibreMap): void {
  const source = getDemSource();
  if (!map.getSource(CONTOUR_SOURCE_ID)) {
    map.addSource(CONTOUR_SOURCE_ID, {
      type: 'vector',
      tiles: [
        source.contourProtocolUrl({
          thresholds: CONTOUR_THRESHOLDS,
          contourLayer: 'contours',
          elevationKey: 'ele',
          levelKey: 'level',
        }),
      ],
      maxzoom: 15,
      attribution: CONTOUR_ATTRIBUTION,
    });
  }
  if (!map.getLayer(CONTOUR_LINES_LAYER_ID)) {
    map.addLayer({
      id: CONTOUR_LINES_LAYER_ID,
      type: 'line',
      source: CONTOUR_SOURCE_ID,
      'source-layer': 'contours',
      paint: {
        'line-color': ['match', ['get', 'level'], 1, '#7c2d12', 'rgba(124, 45, 18, 0.55)'],
        'line-width': ['match', ['get', 'level'], 1, 1.5, 0.6],
        'line-opacity': 0.85,
      },
    });
  }
}

export function removeContourLayers(map: MapLibreMap): void {
  if (map.getLayer(CONTOUR_LINES_LAYER_ID)) {
    map.removeLayer(CONTOUR_LINES_LAYER_ID);
  }
  if (map.getSource(CONTOUR_SOURCE_ID)) {
    map.removeSource(CONTOUR_SOURCE_ID);
  }
}

export function setContoursVisible(map: MapLibreMap, visible: boolean): void {
  if (visible) {
    addContourLayers(map);
  } else {
    removeContourLayers(map);
  }
}
