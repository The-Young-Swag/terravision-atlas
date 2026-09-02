import { useEffect, useMemo, useState } from 'react';
import { Search, AlertTriangle, Navigation } from 'lucide-react';
import { FloatingPanel } from '../common/FloatingPanel';
import { useDisaster } from '../../../hooks/useDisaster';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import {
  reverseGeocode,
  getCachedHierarchy,
  deriveHierarchyFromTitle,
  type LocationHierarchy,
} from '../../../core/data/geocode/reverseGeocode';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

type AppMode = 'explore' | 'monitor' | 'survey';

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
  const [locationCache, setLocationCache] = useState<Map<string, LocationHierarchy>>(new Map());
  const { events: disasterEvents, loading: disasterLoading, lastUpdated, refresh: refreshDisasters } = useDisaster();
  const disasterCount = disasterEvents.length;
  const isBrightBasemap = useBrightBasemap();

  const filteredDisasterEvents = useMemo(() => {
    if (!alertQuery.trim()) return disasterEvents;
    const q = alertQuery.toLowerCase();
    return disasterEvents.filter((e) => {
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
  }, [disasterEvents, alertQuery, locationCache]);

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
    >
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className={`font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
            {disasterLoading ? 'updating…' : `${disasterCount} active`}
          </span>
        </div>

        <div className="relative mb-3">
          <Search
            className={`absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isBrightBasemap ? 'text-slate-500' : 'text-slate-400'}`}
            aria-hidden
          />
          <input
            value={alertQuery}
            onChange={(e) => setAlertQuery(e.target.value)}
            placeholder="Search by country, city, town…"
            aria-label="Search alerts by location"
            className={`w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-[12.5px] outline-none focus:border-[#5500a4]/50 ${isBrightBasemap ? 'text-slate-800 placeholder:text-slate-500' : 'text-slate-200 placeholder:text-slate-400'}`}
          />
        </div>

        {activeMode === 'monitor' && (
          <div className="mb-3 flex gap-1.5">
            {['All', 'High', 'Medium', 'Low'].map((c, i) => (
              <span
                key={c}
                className={`rounded-full border border-white/10 px-2.5 py-1 text-[11px] ${i === 0 ? 'bg-white/15 text-white' : isBrightBasemap ? 'bg-white/5 text-slate-700' : 'bg-white/5 text-slate-300'}`}
              >
                {c}
              </span>
            ))}
          </div>
        )}

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
            <p className={`mt-0.5 text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>town · city · province · country</p>
          </div>
        )}

        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {disasterLoading && disasterEvents.length === 0 ? (
            <div className={`py-8 text-center font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>Loading live data…</div>
          ) : disasterEvents.length === 0 ? (
            <div className={`py-8 text-center text-[12px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>No active events</div>
          ) : filteredDisasterEvents.length === 0 ? (
            <div className={`py-8 text-center text-[12px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>No alerts match &lsquo;{alertQuery}&rsquo;</div>
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
                    <p className={`mt-1 flex items-center gap-1 text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
                      <Navigation className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                      <span className="truncate">{hierarchy}</span>
                    </p>
                  )}
                  <p className={`mt-1 font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-500'}`}>
                    {event.source}
                    {cached?.countryCode ? ` · ${cached.countryCode}` : ''}
                    {cached ? '' : ' · reverse-geocoding…'}
                  </p>
                </div>
              );
            })
          )}
        </div>

        <button onClick={() => refreshDisasters()} className="mt-3 w-full rounded-xl bg-[#5500a4] py-2 text-[12.5px] font-medium text-white transition hover:brightness-110">
          {disasterLoading ? 'Refreshing…' : 'Refresh live data'}
        </button>
        {lastUpdated && (
          <p className={`mt-2 text-center font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-500'}`}>Updated {formatTimeAgo(lastUpdated)}</p>
        )}
      </div>
    </FloatingPanel>
  );
}
