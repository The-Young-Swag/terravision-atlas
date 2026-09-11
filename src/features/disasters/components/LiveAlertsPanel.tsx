import { useEffect, useMemo, useState } from 'react';
import { Search, AlertTriangle, Navigation, ShieldAlert, Globe, MapPin } from 'lucide-react';
import { FloatingPanel } from '../../../ui/components/common/FloatingPanel';
import { useDisaster } from '../hooks/useDisaster';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useMapStore } from '../../../features/map/store';
import { useRouteStore } from '../../../features/navigation/store';
import {
  reverseGeocode,
  getCachedHierarchy,
  deriveHierarchyFromTitle,
  type LocationHierarchy,
} from '../../../features/search';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import * as turf from '@turf/turf';
import type { AppMode } from '../../../types';

dayjs.extend(relativeTime);

const severityConfig = {
  high: { label: 'HIGH', color: '#E63946' },
  medium: { label: 'MEDIUM', color: '#FF9F1C' },
  low: { label: 'LOW', color: '#2EC4B6' },
} as const;

function formatTimeAgo(iso: string): string {
  return dayjs(iso).fromNow();
}

interface LiveAlertsPanelProps {
  activeMode: AppMode;
}

export function LiveAlertsPanel({ activeMode }: LiveAlertsPanelProps) {
  const [alertQuery, setAlertQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [alertScope, setAlertScope] = useState<'global' | 'country' | 'local'>('global');
  const [locationCache, setLocationCache] = useState<Map<string, LocationHierarchy>>(new Map());
  const [centerCountry, setCenterCountry] = useState<string | null>(null);
  const { events: disasterEvents, loading: disasterLoading, lastUpdated, error: disasterError, refresh: refreshDisasters } = useDisaster();
  const disasterCount = disasterEvents.length;
  const isBrightBasemap = useBrightBasemap();
  const mapCenter = useMapStore((s) => s.center);
  const setCenter = useMapStore((s) => s.setCenter);
  const setZoom = useMapStore((s) => s.setZoom);
  const setAvoidCircle = useRouteStore((s) => s.setAvoidCircle);

  // Reverse-geocode map center to get its country for Country-wide filter
  useEffect(() => {
    let cancelled = false;
    reverseGeocode(mapCenter[1], mapCenter[0])
      .then((h) => {
        if (!cancelled && h?.country) setCenterCountry(h.country);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [mapCenter]);

  // One-click event avoidance (Monitor): centers a 1.5 km avoid zone on the
  // event's real coordinates. The radius is the documented Valhalla
  // exclusion-polygon size cap — NOT derived from severity, which has no
  // documented real-world radius mapping. The shared navigation surface
  // (Monitor's evacuation context) picks the zone up from the route store.
  const routeAroundEvent = (event: { longitude: number; latitude: number }) => {
    setAvoidCircle({ lon: event.longitude, lat: event.latitude, radiusKm: 1.5 });
    setCenter([event.longitude, event.latitude]);
    if (useMapStore.getState().zoom < 12) setZoom(12);
  };

  // Local scope radius: 100 km — a reasonable "local" radius that captures
  // nearby events without being so large it effectively becomes country-wide.
  // Chosen as a balance between granularity and coverage for typical disaster
  // monitoring use cases.
  const LOCAL_RADIUS_KM = 100;

  const filteredDisasterEvents = useMemo(() => {
    let result = disasterEvents;

    // Search query filter
    if (alertQuery.trim()) {
      const q = alertQuery.toLowerCase();
      result = result.filter((e) => {
        if (e.title.toLowerCase().includes(q)) return true;
        const key = `${e.latitude},${e.longitude}`;
        const cached = locationCache.get(key) ?? getCachedHierarchy(e.latitude, e.longitude);
        if (cached?.hierarchy.toLowerCase().includes(q)) return true;
        if (cached?.country?.toLowerCase().includes(q)) return true;
        if (cached?.state?.toLowerCase().includes(q)) return true;
        if (cached?.city?.toLowerCase().includes(q)) return true;
        if (cached?.town?.toLowerCase().includes(q)) return true;
        const fallback = deriveHierarchyFromTitle(e.title);
        if (fallback?.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    // Severity filter
    if (selectedSeverity !== 'all') {
      result = result.filter((e) => e.severity === selectedSeverity);
    }

    // Scope filter (Global / Country-wide / Local)
    if (alertScope === 'country') {
      if (centerCountry) {
        result = result.filter((e) => {
          const key = `${e.latitude},${e.longitude}`;
          const cached = locationCache.get(key) ?? getCachedHierarchy(e.latitude, e.longitude);
          return cached?.country === centerCountry;
        });
      }
    } else if (alertScope === 'local') {
      const centerPoint = turf.point([mapCenter[0], mapCenter[1]]);
      result = result.filter((e) => {
        const eventPoint = turf.point([e.longitude, e.latitude]);
        const distanceKm = turf.distance(centerPoint, eventPoint, { units: 'kilometers' });
        return distanceKm <= LOCAL_RADIUS_KM;
      });
    }

    return result;
  }, [disasterEvents, alertQuery, locationCache, selectedSeverity, alertScope, centerCountry, mapCenter]);

  const displayEvents = useMemo(() => filteredDisasterEvents.slice(0, 5), [filteredDisasterEvents]);

  useEffect(() => {
    let cancelled = false;
    const toFetch = displayEvents.filter((e) => !getCachedHierarchy(e.latitude, e.longitude));
    if (toFetch.length === 0) return;
    (async () => {
      for (const e of toFetch) {
        if (cancelled) break;
        const h = await reverseGeocode(e.latitude, e.longitude);
        if (h && !cancelled) {
          setLocationCache((prev) => {
            const next = new Map(prev);
            next.set(`${e.latitude},${e.longitude}`, h);
            return next;
          });
        }
        await new Promise((r) => setTimeout(r, 1100));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [displayEvents]);

  return (
    <FloatingPanel
      id="alerts"
      title={activeMode === 'monitor' ? 'Incident center' : 'Live alerts'}
      icon={<AlertTriangle className="h-3.5 w-3.5" />}
      initialPosition={{ x: 900, y: 96 }}
      bubbleLabel={activeMode === 'monitor' ? 'Incident center' : 'Live alerts'}
      wide
    >
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className={`font-mono text-[10px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
            {disasterLoading ? 'updating…' : `${disasterCount} active`}
          </span>
        </div>

        <div className="relative mb-3">
          <Search
            className={`absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isBrightBasemap ? 'text-slate-500' : 'text-slate-300'}`}
            aria-hidden
          />
          <input
            value={alertQuery}
            onChange={(e) => setAlertQuery(e.target.value)}
            placeholder="Search by country, city, town…"
            aria-label="Search alerts by location"
            className={`w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-[12.5px] outline-none focus:border-[#5500a4]/50 ${isBrightBasemap ? 'text-slate-800 placeholder:text-slate-500' : 'text-slate-200 placeholder:text-slate-300'}`}
          />
        </div>

        {activeMode === 'monitor' && (
          <div className="mb-3 flex gap-1.5 flex-wrap">
            {(['All', 'High', 'Medium', 'Low'] as const).map((c) => {
              const severityKey = c.toLowerCase() as 'all' | 'high' | 'medium' | 'low';
              const isSelected = selectedSeverity === severityKey;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedSeverity(severityKey)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${isSelected
                    ? (isBrightBasemap ? 'border-[#5500a4] bg-[#5500a4] text-white' : 'border-[#5500a4] bg-[#5500a4] text-white')
                    : isBrightBasemap
                      ? 'border-white/10 bg-white/5 text-slate-700 hover:bg-white/10'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}

        {/* Alert Scope Selector — Global / Country-wide / Local */}
        <div className="mb-3 flex gap-1.5 flex-wrap">
          {(['Global', 'Country-wide', 'Local'] as const).map((s) => {
            const scopeKey = s.toLowerCase().replace('-', '') as 'global' | 'country' | 'local';
            const isSelected = alertScope === scopeKey;
            const icon = s === 'Global' ? <Globe className="h-3 w-3" /> : <MapPin className="h-3 w-3" />;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setAlertScope(scopeKey)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition flex items-center gap-1.5 ${isSelected
                  ? (isBrightBasemap ? 'border-[#5500a4] bg-[#5500a4] text-white' : 'border-[#5500a4] bg-[#5500a4] text-white')
                  : isBrightBasemap
                    ? 'border-white/10 bg-white/5 text-slate-700 hover:bg-white/10'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                title={s === 'Global' ? 'All events worldwide' : s === 'Country-wide' ? 'Events in the same country as the map center' : `Events within ${100} km of the map center`}
              >
                {icon}
                {s}
              </button>
            );
          })}
        </div>

        {alertQuery.trim() && filteredDisasterEvents.length > 0 && (
          <div className={`mb-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 ${isBrightBasemap ? 'text-slate-700' : 'text-slate-300'}`}>
            <p className="truncate text-[11px] font-medium">
              {filteredDisasterEvents.length} result{filteredDisasterEvents.length !== 1 ? 's' : ''} for &ldquo;{alertQuery}&rdquo;
              {(() => {
                const first = filteredDisasterEvents[0];
                const h = getCachedHierarchy(first.latitude, first.longitude)?.hierarchy ?? deriveHierarchyFromTitle(first.title);
                return h ? ` · ${h}` : '';
              })()}
            </p>
            <p className={`mt-0.5 text-[10px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>town · city · province · country</p>
          </div>
        )}

        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {disasterLoading && disasterEvents.length === 0 ? (
            <div className={`py-8 text-center font-mono text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>Loading live data…</div>
          ) : disasterEvents.length === 0 ? (
            <div className={`py-8 text-center text-[12px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>No active events</div>
          ) : filteredDisasterEvents.length === 0 ? (
            <div className={`py-8 text-center text-[12px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>No alerts match &lsquo;{alertQuery}&rsquo;</div>
          ) : (
            displayEvents.map((event) => {
              const cfg = severityConfig[event.severity];
              const cached = getCachedHierarchy(event.latitude, event.longitude);
              const hierarchy = cached?.hierarchy ?? deriveHierarchyFromTitle(event.title);
              return (
                <div key={event.id} className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/[0.08]">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>
                      {cfg.label} · {event.type}
                    </span>
                    <span className={`font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-500'}`}>{formatTimeAgo(event.occurredAt)}</span>
                  </div>
                  <p className={`text-[12.5px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-300'}`}>{event.title}</p>
                  {hierarchy && (
                    <p className={`mt-1 flex items-center gap-1 text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
                      <Navigation className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                      <span className="truncate">{hierarchy}</span>
                    </p>
                  )}
                  <p className={`mt-1 flex items-center gap-1.5 font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-500'}`}>
                    <span>
                      {event.source}
                      {cached?.countryCode ? ` · ${cached.countryCode}` : ''}
                      {cached ? '' : ' · reverse-geocoding…'}
                    </span>
                  </p>
                  {activeMode === 'monitor' && (
                    <button
                      type="button"
                      onClick={() => routeAroundEvent(event)}
                      title="Center a 1.5 km avoid zone on this event (Valhalla exclusion limit) for evacuation routing"
                      className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-medium transition hover:bg-white/10 ${isBrightBasemap ? 'text-slate-700' : 'text-slate-300'}`}
                    >
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                      Route around this event
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <button onClick={() => refreshDisasters()} className="mt-3 w-full rounded-xl bg-[#5500a4] py-2 text-[12.5px] font-medium text-white transition hover:brightness-110">
          {disasterLoading ? 'Refreshing…' : 'Refresh live data'}
        </button>
        {disasterError && (
          <p className="mt-2 rounded-lg border border-[#FF9F1C]/30 bg-[#FF9F1C]/10 px-3 py-2 text-[11px] text-[#ffc46b]">
            {disasterError}
          </p>
        )}
        {lastUpdated && (
          <p className={`mt-2 text-center font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-500'}`}>Updated {formatTimeAgo(lastUpdated)}</p>
        )}
      </div>
    </FloatingPanel>
  );
}
