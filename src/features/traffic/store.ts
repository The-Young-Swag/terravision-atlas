import { create } from 'zustand';
import type { TrafficIncident, TrafficStatus } from './tomtom';

interface TrafficState {
  status: TrafficStatus;
  incidents: TrafficIncident[];
  setStatus: (status: TrafficStatus) => void;
  setIncidents: (incidents: TrafficIncident[]) => void;
  clearTraffic: () => void;
}

export const useTrafficStore = create<TrafficState>((set) => ({
  status: 'idle',
  incidents: [],
  setStatus: (status) => set({ status }),
  setIncidents: (incidents) => set({ incidents }),
  clearTraffic: () => set({ incidents: [] }),
}));
