import { create } from 'zustand';

export type BasemapId = 'satellite' | 'streets' | 'terrain' | 'dark';
export type MapViewMode = '2d' | 'vector' | '3d';

interface MapState {
  center: [number, number]; // [lon, lat]
  zoom: number;
  basemap: BasemapId;
  viewMode: MapViewMode;
  showHazards: boolean;
  showTraffic: boolean;
  showTerrainContours: boolean;
  snapToGrid: boolean;
  measureActive: boolean;
  measurePoints: [number, number][];
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setBasemap: (basemap: BasemapId) => void;
  setViewMode: (mode: MapViewMode) => void;
  setShowHazards: (show: boolean) => void;
  setShowTraffic: (show: boolean) => void;
  setShowTerrainContours: (show: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  setMeasureActive: (active: boolean) => void;
  pushMeasurePoint: (point: [number, number]) => void;
  clearMeasure: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: [120.5887, 15.145], // Pampanga, PH
  zoom: 11,
  basemap: 'satellite',
  viewMode: '2d',
  showHazards: true,
  showTraffic: false,
  showTerrainContours: false,
  snapToGrid: false,
  measureActive: false,
  measurePoints: [],
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setBasemap: (basemap) => set({ basemap }),
  setViewMode: (viewMode) => set({ viewMode }),
  setShowHazards: (showHazards) => set({ showHazards }),
  setShowTraffic: (showTraffic) => set({ showTraffic }),
  setShowTerrainContours: (showTerrainContours) => set({ showTerrainContours }),
  setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
  setMeasureActive: (measureActive) =>
    set((state) => ({ measureActive, measurePoints: measureActive ? state.measurePoints : [] })),
  pushMeasurePoint: (point) =>
    set((state) => ({
      measurePoints: state.measurePoints.length >= 2 ? [point] : [...state.measurePoints, point],
    })),
  clearMeasure: () => set({ measurePoints: [] }),
}));
