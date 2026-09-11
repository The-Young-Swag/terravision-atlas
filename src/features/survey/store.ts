import { create } from 'zustand';
import { useMapStore } from '../map/store';
import type { BasemapId, MapViewMode } from '../map/store';
import type { SatelliteSourceId } from '../map/gibs';

export type SurveyProjection = 'WGS84' | 'UTM' | 'PRS92' | 'NAD83' | 'ETRS89' | 'OSGB36';
export type MeasureMode = 'distance' | 'area';

/** Click tolerance in pixels for closing an area polygon on its first vertex. */
export const MEASURE_CLOSE_TOLERANCE_PX = 12;

export interface SurveyState {
  // GPS tracking
  gpsTracking: boolean;
  gpsPosition: [number, number] | null; // [lon, lat]
  gpsAccuracy: number | null;
  gpsError: string | null;
  setGpsTracking: (tracking: boolean) => void;
  setGpsPosition: (position: [number, number] | null, accuracy?: number | null) => void;
  setGpsError: (error: string | null) => void;
  clearGps: () => void;

  // Shareable session state
  sessionId: string;
  generateSessionId: () => void;
  encodeSessionToUrl: (baseUrl: string) => string;
  decodeSessionFromUrl: (search: string) => SurveySessionState | null;
  applySessionState: (state: SurveySessionState) => void;

  // Survey-specific settings (persisted in URL)
  datumVizOpen: boolean;
  setDatumVizOpen: (open: boolean) => void;

  // Measure Geodesic (owned here; mirrored into shareable sessions below)
  measureActive: boolean;
  measureMode: MeasureMode;
  measurePoints: [number, number][];
  measureClosed: boolean;
  setMeasureActive: (active: boolean) => void;
  setMeasureMode: (mode: MeasureMode) => void;
  setMeasureClosed: (closed: boolean) => void;
  pushMeasurePoint: (point: [number, number]) => void;
  setMeasurePoint: (index: number, point: [number, number]) => void;
  clearMeasure: () => void;
}

export interface SurveySessionState {
  // View state
  center: [number, number];
  zoom: number;
  basemap: BasemapId;
  satelliteSource: SatelliteSourceId;
  viewMode: MapViewMode;

  // Survey tools state
  measurePoints: [number, number][];
  measureMode: MeasureMode;
  measureClosed: boolean;
  snapToGrid: boolean;
  datumVizOpen: boolean;
  targetProjection: string;
}

function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export const useSurveyStore = create<SurveyState>((set, get) => ({
  gpsTracking: false,
  gpsPosition: null,
  gpsAccuracy: null,
  gpsError: null,
  sessionId: generateId(),
  datumVizOpen: false,
  measureActive: false,
  measurePoints: [],
  measureMode: 'distance',
  measureClosed: false,

  setGpsTracking: (tracking) =>
    // Stopping preserves a pending error message (the error callback stops
    // tracking AND reports — clearing the message here would swallow it and
    // leave the button looking dead instead of showing "GPS error").
    set((state) => ({ gpsTracking: tracking, gpsError: tracking ? null : state.gpsError })),
  setGpsPosition: (position, accuracy = null) => set({ gpsPosition: position, gpsAccuracy: accuracy }),  setGpsError: (error) => set({ gpsError: error, gpsTracking: false }),
  clearGps: () => set({ gpsTracking: false, gpsPosition: null, gpsAccuracy: null, gpsError: null }),

  generateSessionId: () => set({ sessionId: generateId() }),

  setMeasureMode: (measureMode) => set({ measureMode, measurePoints: [], measureClosed: false }),
  setMeasureClosed: (measureClosed) => set({ measureClosed }),
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

  encodeSessionToUrl: (baseUrl) => {
    const mapState = useMapStore.getState();
    const state = get();
    const sessionState: SurveySessionState = {
      center: mapState.center,
      zoom: mapState.zoom,
      basemap: mapState.basemap,
      satelliteSource: mapState.satelliteSource,
      viewMode: mapState.viewMode,
      measurePoints: state.measurePoints,
      measureMode: state.measureMode,
      measureClosed: state.measureClosed,
      snapToGrid: mapState.snapToGrid,
      datumVizOpen: state.datumVizOpen,
      targetProjection: 'EPSG:32651',
    };
    const encoded = btoa(JSON.stringify(sessionState));
    return `${baseUrl}?survey=${encoded}`;
  },

  decodeSessionFromUrl: (search) => {
    const params = new URLSearchParams(search);
    const encoded = params.get('survey');
    if (!encoded) return null;
    try {
      const decoded = JSON.parse(atob(encoded));
      return decoded as SurveySessionState;
    } catch {
      return null;
    }
  },

  applySessionState: (sessionState) => {
    const mapStore = useMapStore.getState();
    mapStore.setCenter(sessionState.center);
    mapStore.setZoom(sessionState.zoom);
    mapStore.setBasemap(sessionState.basemap);
    mapStore.setSatelliteSource(sessionState.satelliteSource);
    mapStore.setViewMode(sessionState.viewMode);
    const surveyStore = get();
    surveyStore.setMeasureActive(sessionState.measurePoints.length > 0);
    surveyStore.clearMeasure();
    surveyStore.setMeasureMode(sessionState.measureMode ?? 'distance');
    for (const pt of sessionState.measurePoints) {
      surveyStore.pushMeasurePoint(pt);
    }
    if (sessionState.measureClosed) surveyStore.setMeasureClosed(true);
    mapStore.setSnapToGrid(sessionState.snapToGrid);
    set({ datumVizOpen: sessionState.datumVizOpen });
  },

  setDatumVizOpen: (open) => set({ datumVizOpen: open }),
}));
