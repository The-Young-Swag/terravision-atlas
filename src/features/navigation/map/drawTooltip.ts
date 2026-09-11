import type { EvacCircle } from '../store';

// Shared avoid-sketch tooltip chrome for both map engines: the live
// radius label that follows the cursor while drawing. Extracted so the
// OpenLayers and MapLibre adapters cannot drift apart.
export const AVOID_DRAW_TOOLTIP_CSS =
  'position:absolute;display:none;pointer-events:none;background:rgba(13,27,42,.92);' +
  'border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:4px 8px;' +
  'font:11px monospace;color:#f8fafc;white-space:nowrap;z-index:30;';

/** Live radius label shown beside the cursor while sketching. */
export function avoidDrawTooltipText(circle: EvacCircle, atCap: boolean): string {
  return atCap
    ? `${circle.radiusKm.toFixed(1)} km (max) — release to set`
    : `${circle.radiusKm.toFixed(1)} km — release to set`;
}
