import { create } from 'zustand';
import type { Shelter } from './overpass';

interface ShelterState {
  shelters: Shelter[];
  setShelters: (shelters: Shelter[]) => void;
  clearShelters: () => void;
}

export const useShelterStore = create<ShelterState>((set) => ({
  shelters: [],
  setShelters: (shelters) => set({ shelters }),
  clearShelters: () => set({ shelters: [] }),
}));
