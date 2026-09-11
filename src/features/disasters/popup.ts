import type { DisasterEvent } from '../../shared/types';

// Popup content for a disaster marker (Vector map). Same outside-JSX
// HTML-string pattern as the other popups; reuses the weather popup CSS
// classes (identical glass treatment, no new stylesheet).
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function disasterPopupHtml(event: DisasterEvent): string {
  return (
    `<div class="weather-popup">` +
    `<p class="weather-title">${escapeHtml(event.title)}</p>` +
    `<p class="weather-meta">${escapeHtml(event.type)} · ${escapeHtml(event.severity)} · ${escapeHtml(event.source)}</p>` +
    `</div>`
  );
}
