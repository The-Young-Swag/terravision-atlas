import { create } from 'zustand';

// Read-only view of the active map instance (Item 17). The map components
// publish themselves here; the Layers panel slider reads from the same
// store to stay in sync with the middle-click-drag gesture. Writes are
// gated to the map components (they know their own dispose/refresh rules).
interface TiltState {
  cesium: unknown | null;
  maplibre: unknown | null;
  setCesium: (viewer: unknown | null) => void;
  setMapLibre: (map: unknown | null) => void;
}

export const useTiltStore = create<TiltState>((set) => ({
  cesium: null,
  maplibre: null,
  setCesium: (cesium) => set({ cesium }),
  setMapLibre: (maplibre) => set({ maplibre }),
}));
