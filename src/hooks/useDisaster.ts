import { useCallback, useEffect } from 'react';
import { useDisasterStore } from '../stores/disasterStore';
import { useMapStore } from '../stores/mapStore';
import { fetchUsgsEarthquakes } from '../core/data/fetchers/usgsFetcher';
import { fetchEonetEvents } from '../core/data/fetchers/eonetFetcher';
import { fetchFirmsHotspots } from '../core/data/fetchers/firmsFetcher';
import { cacheDisasterEvents, getCachedDisasterEvents } from '../core/data/cache/disasterCache';
import type { DisasterEvent } from '../types';

// Aggregates USGS + EONET + FIRMS hotspots, caches to IndexedDB, shows real
// data only. FIRMS is view-centered (map center bbox) and key-gated —
// without VITE_NASA_FIRMS_MAP_KEY it contributes nothing and EONET stays
// the wildfire source. No fake fallback — if APIs fail and cache is empty,
// UI shows empty/error state.
export function useDisaster() {
  const { events, loading, lastUpdated, error, setEvents, setLoading, setError, setLastUpdated } =
    useDisasterStore();
  const mapCenter = useMapStore((s) => s.center);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [usgsResult, eonetResult, firmsResult] = await Promise.allSettled([
        fetchUsgsEarthquakes(),
        fetchEonetEvents(),
        fetchFirmsHotspots(mapCenter[0], mapCenter[1]),
      ]);

      const usgs = usgsResult.status === 'fulfilled' ? usgsResult.value : [];
      const eonet = eonetResult.status === 'fulfilled' ? eonetResult.value : [];
      const firms = firmsResult.status === 'fulfilled' ? firmsResult.value : [];

      // Collect errors for UI if both fail
      if (usgsResult.status === 'rejected' && eonetResult.status === 'rejected') {
        const msg = 'Live disaster feeds unavailable — showing cached data if available';
        setError(msg);
      } else if (
        usgsResult.status === 'rejected' ||
        eonetResult.status === 'rejected' ||
        firmsResult.status === 'rejected'
      ) {
        setError('One or more disaster feeds temporarily unavailable');
      }

      const combined: DisasterEvent[] = [...usgs, ...eonet, ...firms]
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 30);

      if (combined.length === 0) {
        const cached = await getCachedDisasterEvents();
        if (cached.length > 0) {
          setEvents(cached);
          setLastUpdated(new Date().toISOString());
          return;
        }
        // No fake data — show empty state, keep error visible
        setEvents([]);
      } else {
        setEvents(combined);
        await cacheDisasterEvents(combined);
      }

      setLastUpdated(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch disaster data';
      setError(message);
      try {
        const cached = await getCachedDisasterEvents();
        if (cached.length > 0) setEvents(cached);
        else setEvents([]);
      } catch {
        setEvents([]);
      }
    } finally {
      setLoading(false);
    }
  }, [mapCenter, setEvents, setError, setLastUpdated, setLoading]);

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
