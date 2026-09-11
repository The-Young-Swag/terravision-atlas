// Public API of the shelters feature: the locator panel, its store,
// and the OpenLayers adapter consumed by the map view. (Shelter
// rendering is OpenLayers-only as things stand — no MapLibre or Cesium
// equivalent exists.) Import through this index only.
export { ShelterPanel } from './components/ShelterPanel';
export { useShelterStore } from './store';
export { createShelterLayer } from './map/openlayers';
export { shelterPopupHtml } from './shelterPopup';
export type { Shelter } from './overpass';
