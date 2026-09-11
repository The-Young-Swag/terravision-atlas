import { describeWeatherCode, weatherColorForCode, type CurrentConditions } from './openMeteo';

// Popup content for the weather marker, OpenLayers and MapLibre alike.
// Same outside-JSX HTML-string pattern as the incident/shelter popups.
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function weatherPopupHtml(current: CurrentConditions, label: string): string {
  const rows = [
    `<p class="weather-meta"><span style="color:${weatherColorForCode(current.weatherCode)}">${escapeHtml(describeWeatherCode(current.weatherCode))}</span> · ${current.isDay ? 'Day' : 'Night'}</p>`,
    `<p class="weather-meta">Wind ${current.windSpeedKmh.toFixed(0)} km/h</p>`,
  ];
  return `<div class="weather-popup"><p class="weather-title">${current.temperatureC.toFixed(1)}°C · ${escapeHtml(label)}</p>${rows.join('')}</div>`;
}
