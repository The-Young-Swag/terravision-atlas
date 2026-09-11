// Public API of the traffic feature: TomTom flow/incident data, the
// refresh entry point, ETA adjustment, status bands, the legend, and
// the per-engine map adapters. Import through this index only.
export { useTrafficStore } from './store';
export { refreshTraffic } from './refresh';
export { tomtomApiKey, type TrafficIncident, type TrafficStatus, type TrafficBBox } from './tomtom';
export { trafficAdjustedMinutes, type FlowSample } from './flowEta';
export { flowStatusColor, routeStatusSegments } from './flowStatus';
export { TrafficLegend } from './components/TrafficLegend';
export { createTrafficFlowLayer, createTrafficIncidentLayer } from './map/openlayers';
export {
  TRAFFIC_LAYER_ID,
  TRAFFIC_INCIDENT_LAYER_ID,
  addIncidentLayers,
  removeIncidentLayers,
  setTrafficVisible,
} from './map/maplibre';
export { incidentPopupHtml } from './incidentPopup';
