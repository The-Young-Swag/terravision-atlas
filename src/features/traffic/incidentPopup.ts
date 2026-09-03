import dayjs from 'dayjs';
import type { TrafficIncident } from './tomtom';

// Popup content for a traffic incident, OpenLayers and MapLibre alike.
// Every line comes from the TomTom Incident Details response; absent fields
// are omitted, never fabricated.
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDelay(seconds: number): string | null {
  if (seconds <= 0) return null;
  if (seconds < 60) return `${seconds}s delay`;
  return `${Math.round(seconds / 60)} min delay`;
}

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = dayjs(iso);
  return parsed.isValid() ? parsed.format('MMM D, HH:mm') : null;
}

export function incidentPopupHtml(incident: TrafficIncident): string {
  const rows: string[] = [];
  if (incident.description) {
    rows.push(`<p class="incident-desc">${escapeHtml(incident.description)}</p>`);
  }
  const delay = formatDelay(incident.delaySeconds);
  const meta: string[] = [];
  if (delay) meta.push(escapeHtml(delay));
  if (incident.severity) meta.push(escapeHtml(incident.severity));
  if (incident.lengthMeters !== null) meta.push(`${Math.round(incident.lengthMeters)} m`);
  if (meta.length > 0) {
    rows.push(`<p class="incident-meta">${meta.join(' · ')}</p>`);
  }
  const route = [incident.from, incident.to].filter((part): part is string => part !== null);
  if (route.length > 0) {
    rows.push(`<p class="incident-meta">${escapeHtml(route.join(' → '))}</p>`);
  }
  const times = [formatTime(incident.startTime), formatTime(incident.endTime)].filter(
    (part): part is string => part !== null,
  );
  if (times.length > 0) {
    rows.push(`<p class="incident-meta">${times.map(escapeHtml).join(' → ')}</p>`);
  }
  return `<div class="incident-popup"><p class="incident-title">${escapeHtml(incident.category)}</p>${rows.join('')}</div>`;
}
