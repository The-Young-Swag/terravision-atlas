import { create } from 'zustand';
import type { SatelliteSourceId } from '../core/map/gibs';

export type BasemapId = 'satellite' | 'streets' | 'terrain' | 'dark';
export type MapViewMode = '2d' | 'vector' | '3d';
export type MeasureMode = 'distance' | 'area';

/** Click tolerance in pixels for closing an area polygon on its first vertex. */
export const MEASURE_CLOSE_TOLERANCE_PX = 12;

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
  measureMode: MeasureMode;
  setMeasureMode: (mode: MeasureMode) => void;
  measureClosed: boolean;
  setMeasureClosed: (closed: boolean) => void;
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
  measureMode: 'distance',
  setMeasureMode: (measureMode) => set({ measureMode, measurePoints: [], measureClosed: false }),
  measureClosed: false,
  setMeasureClosed: (measureClosed) => set({ measureClosed }),
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
    // Unbounded: distance mode sums every segment via turf.length on the
    // full path; area mode collects vertices until explicitly closed, and a
    // click after closing starts a fresh shape. (The old two-point cap also
    // truncated shared session restores.)
    set((state) => ({
      measurePoints: state.measureClosed ? [point] : [...state.measurePoints, point],
      measureClosed: false,
    })),
  clearMeasure: () => set({ measurePoints: [], measureClosed: false }),
  setShowDatumViz: (showDatumViz) => set({ showDatumViz }),
}));
