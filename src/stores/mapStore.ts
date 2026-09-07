import { create } from 'zustand';
import type { SatelliteSourceId } from '../core/map/gibs';

export type BasemapId = 'satellite' | 'streets' | 'terrain' | 'dark';
export type MapViewMode = '2d' | 'vector' | '3d';

interface MapState {
  center: [number, number]; // [lon, lat]
  zoom: number;
  basemap: BasemapId;
  /** Satellite imagery source for the 'satellite' basemap slot. */
  satelliteSource: SatelliteSourceId;
  viewMode: MapViewMode;
  showHazards: boolean;
  showTraffic: boolean;
  showTerrainContours: boolean;
  snapToGrid: boolean;
  measureActive: boolean;
  measurePoints: [number, number][];
  showDatumViz: boolean;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setBasemap: (basemap: BasemapId) => void;
  setSatelliteSource: (source: SatelliteSourceId) => void;
  setViewMode: (mode: MapViewMode) => void;
  setShowHazards: (show: boolean) => void;
  setShowTraffic: (show: boolean) => void;
  setShowTerrainContours: (show: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  setMeasureActive: (active: boolean) => void;
  pushMeasurePoint: (point: [number, number]) => void;
  clearMeasure: () => void;
  setShowDatumViz: (show: boolean) => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: [120.5887, 15.145], // Pampanga, PH
  zoom: 11,
  basemap: 'satellite',
  satelliteSource: 'esri',
  viewMode: '2d',
  showHazards: true,
  showTraffic: false,
  showTerrainContours: false,
  snapToGrid: false,
  measureActive: false,
  measurePoints: [],
  showDatumViz: false,
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setBasemap: (basemap) => set({ basemap }),
  setSatelliteSource: (satelliteSource) => set({ satelliteSource }),
  setViewMode: (viewMode) => set({ viewMode }),
  setShowHazards: (showHazards) => set({ showHazards }),
  setShowTraffic: (showTraffic) => set({ showTraffic }),
  setShowTerrainContours: (showTerrainContours) => set({ showTerrainContours }),
  setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
  setMeasureActive: (measureActive) =>
    set((state) => ({ measureActive, measurePoints: measureActive ? state.measurePoints : [] })),
  pushMeasurePoint: (point) =>
    // Unbounded: every click appends a segment and turf.length totals the
    // full path. (The old two-point cap also truncated session restores.)
    set((state) => ({ measurePoints: [...state.measurePoints, point] })),
  clearMeasure: () => set({ measurePoints: [] }),
  setShowDatumViz: (showDatumViz) => set({ showDatumViz }),
}));
