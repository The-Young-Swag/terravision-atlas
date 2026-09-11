import { useCallback, useEffect, useRef } from 'react';
import { useWeatherStore } from '../store';
import { useMapStore } from '../../map/store';
import { fetchCurrentWeather, fetchForecast, fetchHistoricalWeather } from '../openMeteo';
import { cacheWeather, getCachedWeather } from '../cache';

// Open-Meteo weather with IndexedDB caching. Cache-first: cached data shows
// immediately with a stale flag, then the network refreshes. Offline or
// failed requests serve cache only and say so — never fabricated weather.
// Polls hourly; manual refresh via the returned function.
export const WEATHER_POLL_INTERVAL_MS = 60 * 60 * 1000;

function locationLabel(lat: number, lon: number): string {
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

export function useWeather() {
  const store = useWeatherStore();
  const mapCenter = useMapStore((s) => s.center);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    const { setCurrent, setForecast, setLoading, setError, setLastUpdated, setStale, setLocation } =
      useWeatherStore.getState();
    const lat = mapCenter[1];
    const lon = mapCenter[0];
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setLocation({ lat, lon, label: locationLabel(lat, lon) });

    try {
      const cached = await getCachedWeather(lat, lon).catch(() => undefined);
      if (cached && !controller.signal.aborted) {
        setCurrent(cached.current);
        setForecast(cached.forecast);
        setLastUpdated(cached.fetchedAt);
        setStale(true);
      }
      const [current, forecast] = await Promise.all([
        fetchCurrentWeather(lat, lon),
        fetchForecast(lat, lon),
      ]);
      if (controller.signal.aborted) return;
      setCurrent(current);
      setForecast(forecast);
      setLastUpdated(new Date().toISOString());
      setStale(false);
      await cacheWeather({
        id: `${lat.toFixed(2)},${lon.toFixed(2)}`,
        current,
        forecast,
        lat,
        lon,
        fetchedAt: new Date().toISOString(),
      }).catch(() => {});
    } catch (err) {
      if (controller.signal.aborted) return;
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      setError(
        offline
          ? 'Offline — showing cached weather if available'
          : err instanceof Error
            ? err.message
            : 'Weather request failed',
      );
      try {
        const cached = await getCachedWeather(lat, lon);
        if (cached && !controller.signal.aborted) {
          setCurrent(cached.current);
          setForecast(cached.forecast);
          setLastUpdated(cached.fetchedAt);
          setStale(true);
        }
      } catch {
        // Cache itself unreadable — leave prior state visible.
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [mapCenter]);

  const fetchHistorical = useCallback(
    async (date: Date) => {
      const { setHistorical, setLoading, setError } = useWeatherStore.getState();
      const lat = mapCenter[1];
      const lon = mapCenter[0];
      setLoading(true);
      setError(null);
      try {
        const historical = await fetchHistoricalWeather(lat, lon, date);
        setHistorical(historical, date.toISOString().slice(0, 10));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Historical weather request failed');
      } finally {
        setLoading(false);
      }
    },
    [mapCenter],
  );

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), WEATHER_POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [refresh]);

  return {
    current: store.current,
    forecast: store.forecast,
    historical: store.historical,
    historicalDate: store.historicalDate,
    location: store.location,
    loading: store.loading,
    error: store.error,
    lastUpdated: store.lastUpdated,
    stale: store.stale,
    refresh,
    fetchHistorical,
  };
}
