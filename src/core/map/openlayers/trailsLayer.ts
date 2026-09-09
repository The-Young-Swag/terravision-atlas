import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

// Waymarked Trails hiking overlay: named hiking routes rendered from live
// OpenStreetMap data (free, keyless; attribution required). Transparent
// PNGs designed to sit on top of any basemap — complements the Navigation
// panel's Jogging Loop with real trail routes instead of
// routing-engine-only paths. Blank where OSM has no mapped routes (honest
// empty, not an error). Max zoom 17 per the provider's documented range.
export const HIKING_TRAILS_ATTRIBUTION =
  'Hiking routes © waymarkedtrails.org (CC-BY-SA) · © OpenStreetMap contributors';

export function createHikingTrailsLayer(): TileLayer<XYZ> {
  const layer = new TileLayer({
    source: new XYZ({
      url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
      maxZoom: 17,
      attributions: HIKING_TRAILS_ATTRIBUTION,
    }),
    properties: { overlay: 'hiking-trails' },
  });
  return layer;
}
