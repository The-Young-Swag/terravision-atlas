import { create } from 'zustand';

export type BasemapId = 'satellite' | 'streets' | 'terrain' | 'dark';
export type MapViewMode = '2d' | '3d';

interface MapState {
  center: [number, number]; // [lon, lat]
  zoom: number;
  basemap: BasemapId;
  viewMode: MapViewMode;
  showHazards: boolean;
  showTraffic: boolean;
  showTerrainContours: boolean;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setBasemap: (basemap: BasemapId) => void;
  setViewMode: (mode: MapViewMode) => void;
  setShowHazards: (show: boolean) => void;
  setShowTraffic: (show: boolean) => void;
  setShowTerrainContours: (show: boolean) => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: [120.5887, 15.145], // Pampanga, PH
  zoom: 11,
  basemap: 'satellite',
  viewMode: '2d',
  showHazards: true,
  showTraffic: false,
  showTerrainContours: false,
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setBasemap: (basemap) => set({ basemap }),
  setViewMode: (viewMode) => set({ viewMode }),
  setShowHazards: (showHazards) => set({ showHazards }),
  setShowTraffic: (showTraffic) => set({ showTraffic }),
  setShowTerrainContours: (showTerrainContours) => set({ showTerrainContours }),
}));
