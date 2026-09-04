import { create } from 'zustand';
import type { EvacCircle } from '../features/routing/avoidZone';

export interface EvacRoutePoint {
  lon: number;
  lat: number;
}

export interface EvacPin extends EvacRoutePoint {
  label: string;
}

export interface EvacRoute {
  path: EvacRoutePoint[];
  distanceKm: number;
  durationMinutes: number;
  avoidsArea: boolean;
}

export type EvacPickMode = 'start' | 'destination' | null;

interface RouteState {
  route: EvacRoute | null;
  start: EvacPin | null;
  destination: EvacPin | null;
  avoidCircle: EvacCircle | null;
  pickMode: EvacPickMode;
  drawAvoidArmed: boolean;
  setEvacuationRoute: (route: EvacRoute) => void;
  setDrawAvoidArmed: (armed: boolean) => void;
  setStart: (pin: EvacPin) => void;
  clearStart: () => void;
  setDestination: (pin: EvacPin) => void;
  clearDestination: () => void;
  setAvoidCircle: (circle: EvacCircle) => void;
  clearAvoidCircle: () => void;
  setPickMode: (mode: EvacPickMode) => void;
  clearEvacuationRoute: () => void;
}

// Pin/avoid edits invalidate the computed route (it would be stale), so
// every setter below clears it. Clearing start also clears the destination:
// a destination without a start cannot route.
export const useRouteStore = create<RouteState>((set) => ({
  route: null,
  start: null,
  destination: null,
  avoidCircle: null,
  pickMode: null,
  drawAvoidArmed: false,
  setEvacuationRoute: (route) => set({ route }),
  setPickMode: (pickMode) => set({ pickMode }),
  setDrawAvoidArmed: (drawAvoidArmed) => set({ drawAvoidArmed }),
  setStart: (start) => set({ start, route: null }),
  clearStart: () => set({ start: null, destination: null, route: null }),
  setDestination: (destination) => set({ destination, route: null }),
  clearDestination: () => set({ destination: null, route: null }),
  setAvoidCircle: (avoidCircle) => set({ avoidCircle, route: null }),
  clearAvoidCircle: () => set({ avoidCircle: null, route: null }),
  clearEvacuationRoute: () => set({ route: null }),
}));
