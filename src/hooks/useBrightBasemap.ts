import { useMapStore } from '../stores/mapStore';

// Centralized bright-basemap check: Vector is a Map Type with a light style,
// Streets and Terrain are bright Base Maps.
// Used to dynamically adjust only foreground text/icon color for legibility
// while preserving glassmorphism, borders, and backgrounds.
export function useBrightBasemap(): boolean {
  const basemap = useMapStore((s) => s.basemap);
  const viewMode = useMapStore((s) => s.viewMode);
  return viewMode === 'vector' || ['streets', 'terrain'].includes(basemap);
}
