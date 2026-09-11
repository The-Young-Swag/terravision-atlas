import { create } from 'zustand';
import type { CurrentConditions, Forecast } from './openMeteo';

export interface WeatherLocation {
  lat: number;
  lon: number;
  label: string;
}

interface WeatherState {
  current: CurrentConditions | null;
  forecast: Forecast | null;
  historical: Forecast | null;
  historicalDate: string | null;
  location: WeatherLocation | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  stale: boolean;
  setCurrent: (current: CurrentConditions | null) => void;
  setForecast: (forecast: Forecast | null) => void;
  setHistorical: (historical: Forecast | null, date: string | null) => void;
  setLocation: (location: WeatherLocation) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLastUpdated: (iso: string) => void;
  setStale: (stale: boolean) => void;
}

export const useWeatherStore = create<WeatherState>((set) => ({
  current: null,
  forecast: null,
  historical: null,
  historicalDate: null,
  location: null,
  loading: false,
  error: null,
  lastUpdated: null,
  stale: false,
  setCurrent: (current) => set({ current }),
  setForecast: (forecast) => set({ forecast }),
  setHistorical: (historical, historicalDate) => set({ historical, historicalDate }),
  setLocation: (location) => set({ location }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setLastUpdated: (lastUpdated) => set({ lastUpdated }),
  setStale: (stale) => set({ stale }),
}));
