import { create } from 'zustand';
import type { DisasterEvent } from '../types';

interface DisasterState {
  events: DisasterEvent[];
  loading: boolean;
  lastUpdated: string | null;
  error: string | null;
  setEvents: (events: DisasterEvent[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLastUpdated: (iso: string) => void;
}

export const useDisasterStore = create<DisasterState>((set) => ({
  events: [],
  loading: false,
  lastUpdated: null,
  error: null,
  setEvents: (events) => set({ events }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setLastUpdated: (lastUpdated) => set({ lastUpdated }),
}));
