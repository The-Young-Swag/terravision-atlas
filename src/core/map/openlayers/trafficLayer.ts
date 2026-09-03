import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Style, Circle, Fill, Stroke } from 'ol/style';
import { flowTileUrl } from '../../../features/traffic/tomtom';
import type { TrafficIncident } from '../../../features/traffic/tomtom';

// TomTom traffic flow raster overlay (2D map). Tile requests are cached by
// OpenLayers' tile cache and the browser HTTP cache — the same area is not
// re-fetched while panning. Attribution is required by TomTom's terms.
export function createTrafficFlowLayer(apiKey: string): TileLayer<XYZ> {
  return new TileLayer({
    source: new XYZ({
      url: flowTileUrl(apiKey),
      attributions: '© TomTom',
      maxZoom: 18,
    }),
    properties: { layerId: 'traffic-flow' },
  });
}

// Traffic incident markers (2D map).
export function createTrafficIncidentLayer(incidents: TrafficIncident[]): VectorLayer<VectorSource> {
  const features = incidents.map((incident) => {
    const feature = new Feature({
      geometry: new Point(fromLonLat([incident.lon, incident.lat])),
      incidentId: incident.id,
    });
    feature.setStyle(
      new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({ color: '#FF9F1C' }),
          stroke: new Stroke({ color: '#f8fafc', width: 2 }),
        }),
      }),
    );
    return feature;
  });

  return new VectorLayer({
    source: new VectorSource({ features }),
    properties: { layerId: 'traffic-incidents' },
  });
}
