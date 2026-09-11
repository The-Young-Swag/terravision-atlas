import { getAppDb, WEATHER_STORE } from '../../core/data/cache/db';
import type { CurrentConditions, Forecast } from './openMeteo';

export interface CachedWeather {
  id: string;
  current: CurrentConditions | null;
  forecast: Forecast | null;
  lat: number;
  lon: number;
  fetchedAt: string;
}

export function weatherCacheId(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export async function cacheWeather(entry: CachedWeather): Promise<void> {
  const db = await getAppDb();
  await db.put(WEATHER_STORE, entry);
}

export async function getCachedWeather(lat: number, lon: number): Promise<CachedWeather | undefined> {
  const db = await getAppDb();
  return db.get(WEATHER_STORE, weatherCacheId(lat, lon));
}
