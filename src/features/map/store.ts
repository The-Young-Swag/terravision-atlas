import { create } from 'zustand';
import type { SatelliteSourceId } from './gibs';

export type BasemapId = 'satellite' | 'streets' | 'terrain' | 'dark';
/** Tile provider for the 'streets' basemap slot. 'osm' (default) is the
 *  community OpenStreetMap standard style; 'esri' is Esri World Street Map. */
export type StreetsSourceId = 'osm' | 'esri';
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
  /** Tile provider for the 'streets' basemap slot. */
  streetsSource: StreetsSourceId;
  viewMode: MapViewMode;
  showHazards: boolean;
  showTraffic: boolean;
  showTerrainContours: boolean;
  /** Waymarked Trails hiking-route overlay (free, keyless OSM-data overlay). */
  showHikingTrails: boolean;
  snapToGrid: boolean;
  measureActive: boolean;
  measurePoints: [number, number][];
  showDatumViz: boolean;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setBasemap: (basemap: BasemapId) => void;
  setSatelliteSource: (source: SatelliteSourceId) => void;
  setStreetsSource: (source: StreetsSourceId) => void;
  setViewMode: (mode: MapViewMode) => void;
  setShowHazards: (show: boolean) => void;
  setShowTraffic: (show: boolean) => void;
  setShowTerrainContours: (show: boolean) => void;
  setShowHikingTrails: (show: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  setMeasureActive: (active: boolean) => void;
  measureMode: MeasureMode;
  setMeasureMode: (mode: MeasureMode) => void;
  measureClosed: boolean;
  setMeasureClosed: (closed: boolean) => void;
  pushMeasurePoint: (point: [number, number]) => void;
  setMeasurePoint: (index: number, point: [number, number]) => void;
  clearMeasure: () => void;
  setShowDatumViz: (show: boolean) => void;
  /** Last successful geolocation fix (real device position, not simulated).
   *  Shared so every My Location control reflects the same active state. */
  myLocation: { lon: number; lat: number } | null;
  setMyLocation: (loc: { lon: number; lat: number } | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: [120.5887, 15.145], // Pampanga, PH
  zoom: 11,
  basemap: 'satellite',
  satelliteSource: 'esri',
  streetsSource: 'osm',
  viewMode: '2d',
  showHazards: true,
  showTraffic: false,
  showTerrainContours: false,
  showHikingTrails: false,
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
  setStreetsSource: (streetsSource) => set({ streetsSource }),
  setViewMode: (viewMode) => set({ viewMode }),
  setShowHazards: (showHazards) => set({ showHazards }),
  setShowTraffic: (showTraffic) => set({ showTraffic }),
  setShowTerrainContours: (showTerrainContours) => set({ showTerrainContours }),
  setShowHikingTrails: (showHikingTrails) => set({ showHikingTrails }),
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
  setMeasurePoint: (index, point) =>
    // Vertex drag repositioning; out-of-range indices are a no-op so a
    // stale drag gesture can never corrupt the path.
    set((state) => {
      if (index < 0 || index >= state.measurePoints.length) return state;
      const measurePoints = [...state.measurePoints];
      measurePoints[index] = point;
      return { measurePoints };
    }),
  clearMeasure: () => set({ measurePoints: [], measureClosed: false }),
  setShowDatumViz: (showDatumViz) => set({ showDatumViz }),
  myLocation: null,
  setMyLocation: (myLocation) => set({ myLocation }),
}));
