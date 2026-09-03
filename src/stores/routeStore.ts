import { create } from 'zustand';

export interface EvacRoutePoint {
  lon: number;
  lat: number;
}

export interface EvacRoute {
  path: EvacRoutePoint[];
  distanceKm: number;
  durationMinutes: number;
  avoidsArea: boolean;
}

interface RouteState {
  route: EvacRoute | null;
  avoidRing: EvacRoutePoint[] | null; // closed lon/lat ring drawn on the map
  setEvacuationRoute: (route: EvacRoute, avoidRing: EvacRoutePoint[]) => void;
  clearEvacuationRoute: () => void;
}

export const useRouteStore = create<RouteState>((set) => ({
  route: null,
  avoidRing: null,
  setEvacuationRoute: (route, avoidRing) => set({ route, avoidRing }),
  clearEvacuationRoute: () => set({ route: null, avoidRing: null }),
}));
