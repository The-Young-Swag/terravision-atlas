import { create } from 'zustand';
import type { TravelCosting } from './valhalla';
import type { FlowSample } from '../traffic';

export interface EvacRoutePoint {
  lon: number;
  lat: number;
}

/** The avoid zone is a single circle {center, radiusKm} everywhere in the
 *  app. Defined alongside the store that owns it (avoids an
 *  avoidZone<->store import cycle); geometry helpers stay in avoidZone. */
export interface EvacCircle {
  lon: number;
  lat: number;
  radiusKm: number;
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

export interface JogLoop {
  path: { lon: number; lat: number }[];
  distanceKm: number;
  durationMinutes: number;
  targetKm: number;
  hilliness: 'flat' | 'hilly';
}

export interface TrafficAdjustment {
  /** Multiplicative factor applied to the base duration (>= 1 when slowed). */
  factor: number;
  adjustedMinutes: number;
  /** Per-sample speeds with path positions — drives route status coloring. */
  samples: FlowSample[];
}

interface RouteState {
  route: EvacRoute | null;
  start: EvacPin | null;
  destination: EvacPin | null;
  avoidCircle: EvacCircle | null;
  pickMode: EvacPickMode;
  drawAvoidArmed: boolean;
  /** Travel costing for the shared navigation surface (Explore + Monitor). */
  travelMode: TravelCosting;
  /** Jogging/running loop result (shares the route line rendering). */
  jogLoop: JogLoop | null;
  /** Deterministic traffic adjustment of the current route ETA, if sampled. */
  trafficAdjustment: TrafficAdjustment | null;
  setEvacuationRoute: (route: EvacRoute) => void;
  setDrawAvoidArmed: (armed: boolean) => void;
  setStart: (pin: EvacPin) => void;
  clearStart: () => void;
  setDestination: (pin: EvacPin) => void;
  clearDestination: () => void;
  setAvoidCircle: (circle: EvacCircle | null) => void;
  clearAvoidCircle: () => void;
  setPickMode: (mode: EvacPickMode) => void;
  clearEvacuationRoute: () => void;
  setTravelMode: (mode: TravelCosting) => void;
  setJogLoop: (loop: JogLoop | null) => void;
  setTrafficAdjustment: (adjustment: TrafficAdjustment | null) => void;
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
  travelMode: 'auto',
  jogLoop: null,
  trafficAdjustment: null,
  setEvacuationRoute: (route) => set({ route }),
  setPickMode: (pickMode) => set({ pickMode }),
  setDrawAvoidArmed: (drawAvoidArmed) => set({ drawAvoidArmed }),
  setStart: (start) => set({ start, route: null, jogLoop: null, trafficAdjustment: null }),
  clearStart: () => set({ start: null, destination: null, route: null, jogLoop: null, trafficAdjustment: null }),
  setDestination: (destination) => set({ destination, route: null, jogLoop: null, trafficAdjustment: null }),
  clearDestination: () => set({ destination: null, route: null, jogLoop: null, trafficAdjustment: null }),
  setAvoidCircle: (avoidCircle) => set({ avoidCircle, route: null }),
  clearAvoidCircle: () => set({ avoidCircle: null, route: null }),
  clearEvacuationRoute: () => set({ route: null, trafficAdjustment: null }),
  setTravelMode: (travelMode) => set({ travelMode, route: null, trafficAdjustment: null, jogLoop: null }),
  setJogLoop: (jogLoop) => set({ jogLoop }),
  setTrafficAdjustment: (trafficAdjustment) => set({ trafficAdjustment }),
}));
