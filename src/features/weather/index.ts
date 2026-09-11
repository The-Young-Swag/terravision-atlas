// Public API of the weather feature: the current-conditions panel, its
// store, the Open-Meteo code helpers shared with the sidebar, the map
// popup, and the per-engine map adapters. (No Cesium adapter exists —
// see ARCHITECTURE.md.) Import through this index only.
export { WeatherPanel } from './components/WeatherPanel';
export { useWeatherStore } from './store';
export {
  describeWeatherCode,
  weatherColorForCode,
  type CurrentConditions,
  type HourlyPoint,
  type Forecast,
} from './openMeteo';
export { weatherPopupHtml } from './popup';
export { createWeatherLayer } from './map/openlayers';
export { setWeatherVisible, WEATHER_LAYER_ID } from './map/maplibre';
