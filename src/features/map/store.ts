import { create } from 'zustand';
import type { SatelliteSourceId } from './gibs';

export type BasemapId = 'satellite' | 'streets' | 'terrain' | 'dark';
/** Tile provider for the 'streets' basemap slot. 'osm' (default) is the
 *  community OpenStreetMap standard style; 'esri' is Esri World Street Map. */
export type StreetsSourceId = 'osm' | 'esri';
export type MapViewMode = '2d' | 'vector' | '3d';

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
  setShowDatumViz: (showDatumViz) => set({ showDatumViz }),
  myLocation: null,
  setMyLocation: (myLocation) => set({ myLocation }),
}));
