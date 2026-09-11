import { useMapStore } from '../store';

// Map overlay contrast for in-map UI (markers, labels, badges, legends, icons on the canvas)
// This is separate from panel/sidebar contrast which has its own fixed background
// Returns colors for foreground text/icons on the map itself

export type MapOverlayTheme = 'light' | 'dark' | 'variable';

export interface MapOverlayContrast {
  theme: MapOverlayTheme;
  // Foreground colors for map overlays
  textPrimary: string;      // Primary text (labels, badges)
  textSecondary: string;    // Secondary text (sub-labels, values)
  iconPrimary: string;      // Primary icons (markers, symbols)
  iconSecondary: string;    // Secondary icons (strokes, outlines)
  markerStroke: string;     // Stroke for circle markers
  legendText: string;       // Legend text
  attributionText: string;  // Attribution text
  // Background is NOT touched — glassmorphism/panels handled separately
}

export function useMapOverlayContrast(): MapOverlayContrast {
  const basemap = useMapStore((s) => s.basemap);

  // Determine if the current base map is light/bright
  // Vector is a Map Type, not a Base Map — it inherits the base map's brightness
  const isBrightBasemap = ['streets', 'terrain'].includes(basemap);
  const isVariableBasemap = basemap === 'satellite'; // brightness varies by region

  let theme: MapOverlayTheme;
  if (isVariableBasemap) theme = 'variable';
  else if (isBrightBasemap) theme = 'light';
  else theme = 'dark';

  // Color scheme per theme
  // These are foreground-only colors for map overlays
  if (theme === 'light') {
    // Bright basemaps (Streets, Terrain) → dark foreground
    return {
      theme,
      textPrimary: '#1e293b',      // slate-800
      textSecondary: '#475569',    // slate-600
      iconPrimary: '#1e293b',      // slate-800
      iconSecondary: '#475569',    // slate-600
      markerStroke: '#1e293b',     // dark stroke for markers
      legendText: '#334155',       // slate-700
      attributionText: '#475569',  // slate-600
    };
  }

  if (theme === 'dark') {
    // Dark basemap → light foreground
    return {
      theme,
      textPrimary: '#f8fafc',      // slate-50
      textSecondary: '#cbd5e1',    // slate-300
      iconPrimary: '#f8fafc',      // slate-50
      iconSecondary: '#cbd5e1',    // slate-300
      markerStroke: '#f8fafc',     // light stroke for markers
      legendText: '#e2e8f0',       // slate-200
      attributionText: '#cbd5e1',  // slate-300
    };
  }

  // Variable (Satellite) → use middle-ground that works on both
  // Default to light foreground since satellite is often dark overall
  // but flag as variable so callers can do per-pixel checks if needed
  return {
    theme,
    textPrimary: '#f8fafc',        // slate-50
    textSecondary: '#cbd5e1',      // slate-300
    iconPrimary: '#f8fafc',        // slate-50
    iconSecondary: '#cbd5e1',      // slate-300
    markerStroke: '#f8fafc',       // light stroke
    legendText: '#e2e8f0',         // slate-200
    attributionText: '#cbd5e1',    // slate-300
  };
}

export function isBrightBasemap(basemap: string): boolean {
  return ['streets', 'terrain'].includes(basemap);
}

export function isDarkBasemap(basemap: string): boolean {
  return basemap === 'dark';
}

export function isVariableBasemap(basemap: string): boolean {
  return basemap === 'satellite';
}