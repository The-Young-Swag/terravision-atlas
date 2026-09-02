import { useCallback, useEffect } from 'react';
import { useDisasterStore } from '../stores/disasterStore';
import { fetchUsgsEarthquakes, mockEarthquakes } from '../core/data/fetchers/usgsFetcher';
import { fetchEonetEvents, mockEonetEvents } from '../core/data/fetchers/eonetFetcher';
import { cacheDisasterEvents, getCachedDisasterEvents } from '../core/data/cache/disasterCache';
import type { DisasterEvent } from '../types';

// Aggregates USGS + EONET, caches to IndexedDB, falls back to mocks + cache when offline.
export function useDisaster() {
  const { events, loading, lastUpdated, error, setEvents, setLoading, setError, setLastUpdated } =
    useDisasterStore();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [usgs, eonet] = await Promise.all([
        fetchUsgsEarthquakes().catch(() => mockEarthquakes()),
        fetchEonetEvents().catch(() => mockEonetEvents()),
      ]);

      const combined: DisasterEvent[] = [...usgs, ...eonet]
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 30);

      // If both sources fell back to mocks and returned empty, try cache
      if (combined.length === 0) {
        const cached = await getCachedDisasterEvents();
        if (cached.length > 0) {
          setEvents(cached);
          setLastUpdated(new Date().toISOString());
          return;
        }
        // Final fallback: mocks
        const mocks = [...mockEarthquakes(), ...mockEonetEvents()];
        setEvents(mocks);
      } else {
        setEvents(combined);
        await cacheDisasterEvents(combined);
      }

      setLastUpdated(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch disaster data';
      setError(message);
      // Try cache on error
      try {
        const cached = await getCachedDisasterEvents();
        if (cached.length > 0) setEvents(cached);
        else setEvents([...mockEarthquakes(), ...mockEonetEvents()]);
      } catch {
        setEvents([...mockEarthquakes(), ...mockEonetEvents()]);
      }
    } finally {
      setLoading(false);
    }
  }, [setEvents, setError, setLastUpdated, setLoading]);

  // Auto-refresh on mount and every 5 minutes
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      // Try cache first for instant UI
      try {
        const cached = await getCachedDisasterEvents();
        if (cached.length > 0 && !cancelled) {
          setEvents(cached);
        }
      } catch {
        // ignore
      }
      await refresh();
    };

    load();

    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refresh, setEvents]);

  return { events, loading, lastUpdated, error, refresh };
}
