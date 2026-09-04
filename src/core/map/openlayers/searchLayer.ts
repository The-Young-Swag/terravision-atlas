import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Style, Circle, Fill, Stroke } from 'ol/style';
import type { SearchMarker } from '../../../stores/searchStore';

// Temporary search-result pin (2D map). Replaced on every new search and
// cleared with the query — it never pretends to be saved data.
export function createSearchMarkerLayer(marker: SearchMarker): VectorLayer<VectorSource> {
  const feature = new Feature({ geometry: new Point(fromLonLat([marker.lon, marker.lat])) });
  feature.setStyle(
    new Style({
      image: new Circle({
        radius: 7,
        fill: new Fill({ color: '#5500a4' }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
    }),
  );

  return new VectorLayer({
    source: new VectorSource({ features: [feature] }),
    properties: { layerId: 'search-marker' },
  });
}
