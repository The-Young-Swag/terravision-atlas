import type { Shelter } from './overpass';

// Popup content for an emergency shelter marker (2D map). Mirrors the
// traffic-incident popup pattern: plain HTML string + companion CSS (Tailwind
// class detection does not reliably apply outside JSX). Every line comes
// from the Overpass response; absent fields are omitted, never fabricated —
// Overpass exposes no capacity, status, or contact fields, so none appear.
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function shelterPopupHtml(shelter: Shelter): string {
  const rows: string[] = [];
  rows.push(`<p class="shelter-meta">${escapeHtml(shelter.matchedTag)}</p>`);
  rows.push(
    `<p class="shelter-meta">${shelter.lat.toFixed(4)}, ${shelter.lon.toFixed(4)} · OSM ${escapeHtml(shelter.id)}</p>`,
  );
  return `<div class="shelter-popup"><p class="shelter-title">${escapeHtml(shelter.name ?? 'Unnamed shelter')}</p>${rows.join('')}</div>`;
}
