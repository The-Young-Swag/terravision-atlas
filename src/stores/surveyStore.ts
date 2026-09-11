import { create } from 'zustand';
import { useMapStore } from '../features/map/store';
import type { BasemapId, MapViewMode, MeasureMode } from '../features/map/store';
import type { SatelliteSourceId } from '../features/map/gibs';

export type SurveyProjection = 'WGS84' | 'UTM' | 'PRS92' | 'NAD83' | 'ETRS89' | 'OSGB36';

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

  setGpsTracking: (tracking) =>
    // Stopping preserves a pending error message (the error callback stops
    // tracking AND reports — clearing the message here would swallow it and
    // leave the button looking dead instead of showing "GPS error").
    set((state) => ({ gpsTracking: tracking, gpsError: tracking ? null : state.gpsError })),
  setGpsPosition: (position, accuracy = null) => set({ gpsPosition: position, gpsAccuracy: accuracy }),  setGpsError: (error) => set({ gpsError: error, gpsTracking: false }),
  clearGps: () => set({ gpsTracking: false, gpsPosition: null, gpsAccuracy: null, gpsError: null }),

  generateSessionId: () => set({ sessionId: generateId() }),

  encodeSessionToUrl: (baseUrl) => {
    const mapState = useMapStore.getState();
    const state = get();
    const sessionState: SurveySessionState = {
      center: mapState.center,
      zoom: mapState.zoom,
      basemap: mapState.basemap,
      satelliteSource: mapState.satelliteSource,
      viewMode: mapState.viewMode,
      measurePoints: mapState.measurePoints,
      measureMode: mapState.measureMode,
      measureClosed: mapState.measureClosed,
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
    mapStore.setMeasureActive(sessionState.measurePoints.length > 0);
    mapStore.clearMeasure();
    mapStore.setMeasureMode(sessionState.measureMode ?? 'distance');
    for (const pt of sessionState.measurePoints) {
      mapStore.pushMeasurePoint(pt);
    }
    if (sessionState.measureClosed) mapStore.setMeasureClosed(true);
    mapStore.setSnapToGrid(sessionState.snapToGrid);
    set({ datumVizOpen: sessionState.datumVizOpen });
  },

  setDatumVizOpen: (open) => set({ datumVizOpen: open }),
}));
