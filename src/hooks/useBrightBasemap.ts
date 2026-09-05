import { useMapStore } from '../stores/mapStore';

// THE shared dynamic font-color utility for every floating/modal panel in
// the app (Layers, Live Alerts, Traffic legend, Navigation/Evacuation incl.
// the Jogging Loop disclosure collapsed + expanded, Fuel calculator, Survey
// geodetic panels, Storytelling, Minecraft Export, and TopBar/StatusBar/
// ModeDocks chrome).
//
// Rule: panels keep their glass backgrounds, borders, and layout untouched
// and switch ONLY foreground text/icon color on this boolean — dark slate
// on bright backgrounds, light slate on dark ones. It subscribes to the map
// store, so every consumer re-renders automatically when the basemap or map
// type changes; no per-panel listeners. Do NOT inline an equivalent
// `basemap === ...` check or duplicate these pairs per panel — call this
// hook. (In-map canvas overlays use useMapOverlayContrast instead: separate
// concern with different background semantics.)
//
// Standard pairs: primary text-slate-800 / text-slate-200, secondary
// text-slate-600 / text-slate-300, faint text-slate-500 / text-slate-400.
// Fixed-background elements (solid purple buttons, dark bubbles, native
// option lists, semantic accents) keep static colors — only variable-glass
// text adapts.
export function useBrightBasemap(): boolean {
  const basemap = useMapStore((s) => s.basemap);
  const viewMode = useMapStore((s) => s.viewMode);
  return viewMode === 'vector' || ['streets', 'terrain'].includes(basemap);
}
