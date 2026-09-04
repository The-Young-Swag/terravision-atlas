import { create } from 'zustand';

export interface SearchMarker {
  lon: number;
  lat: number;
  label: string;
}

interface SearchState {
  marker: SearchMarker | null;
  setMarker: (marker: SearchMarker) => void;
  clearMarker: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  marker: null,
  setMarker: (marker) => set({ marker }),
  clearMarker: () => set({ marker: null }),
}));
