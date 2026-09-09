import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useMapStore } from '../../../stores/mapStore';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useDisaster } from '../../../hooks/useDisaster';

type AppMode = 'explore' | 'monitor' | 'survey';

interface StatusBarProps {
  activeMode: AppMode;
}

export function StatusBar({ activeMode }: StatusBarProps) {
  const { center, zoom } = useMapStore();
  const { events: disasterEvents } = useDisaster();
  const disasterCount = disasterEvents.length;
  const isBrightBasemap = useBrightBasemap();

  const centerLabel = useMemo(() => {
    const [lon, lat] = center;
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
  }, [center]);

  // Mobile collapsible footer (≤767px only — the body classes are consumed
  // exclusively by media-scoped CSS, so desktop is unaffected). Expanded =
  // footer panel visible, native attribution controls hidden; collapsed =
  // exact inverse. The toggle always stays reachable to re-expand.
  const [mobileCollapsed, setMobileCollapsed] = useState(false);
  useEffect(() => {
    const sync = () => {
      const mobile = window.innerWidth < 768;
      document.body.classList.toggle('mobile-footer-collapsed', mobile && mobileCollapsed);
      document.body.classList.toggle('mobile-footer-expanded', mobile && !mobileCollapsed);
    };
    sync();
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('resize', sync);
      document.body.classList.remove('mobile-footer-collapsed', 'mobile-footer-expanded');
    };
  }, [mobileCollapsed]);

  return (
    <>
      {/* Desktop footer — unchanged. */}
      <footer
        className={`glass absolute inset-x-3 bottom-3 z-10 hidden flex-col gap-1.5 rounded-xl px-3 py-2 font-mono text-[11px] sm:flex-row sm:items-center sm:justify-between md:inset-x-auto md:bottom-4 md:left-4 md:right-auto md:w-[28rem] md:max-w-[85vw] md:rounded-2xl md:px-4 md:py-2 md:flex ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 md:gap-5">
          <span className="truncate">{centerLabel}</span>
          {activeMode === 'survey' && <span className="shrink-0">EPSG:32651 · UTM 51N</span>}
          {activeMode === 'monitor' && <span className="shrink-0 truncate text-[#FF9F1C]">{disasterCount} active</span>}
          <span className="hidden shrink-0 sm:inline">Zoom {zoom.toFixed(1)}</span>
        </div>
        <div className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap font-sans ${isBrightBasemap ? 'text-slate-700' : 'text-slate-300'}`}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00d890]" />
          Live · 12s ago
        </div>
      </footer>

      {/* Mobile footer — centered, collapsible; the native map attribution
          controls take its place (exact inverse) while collapsed. */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-3 md:hidden">
        <div className="mb-1.5 flex justify-center">
          <button
            type="button"
            onClick={() => setMobileCollapsed((value) => !value)}
            aria-label={mobileCollapsed ? 'Expand footer' : 'Collapse footer'}
            aria-expanded={!mobileCollapsed}
            className="glass flex h-7 w-7 items-center justify-center rounded-full"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-300 ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}
              style={{ transform: mobileCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
              aria-hidden
            />
          </button>
        </div>
        <div className="relative flex min-h-[64px] items-center justify-center">
          <footer
            className={`mobile-footer-panel glass-strong flex flex-col items-center gap-0.5 rounded-2xl px-4 py-2.5 text-center ${isBrightBasemap ? 'text-slate-800' : 'text-slate-100'}`}
          >
            <span className="font-mono text-[13px] tracking-tight">{centerLabel}</span>
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="shrink-0">Zoom {zoom.toFixed(1)}</span>
              {activeMode === 'survey' && <span className="shrink-0">EPSG:32651 · UTM 51N</span>}
              {activeMode === 'monitor' && <span className="shrink-0 text-[#FF9F1C]">{disasterCount} active</span>}
            </span>
            <span className={`flex items-center gap-1.5 font-sans text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-300'}`}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00d890]" />
              Live · 12s ago
            </span>
          </footer>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-[4.75rem] left-1/2 z-10 flex max-w-[85vw] -translate-x-1/2 justify-center md:hidden">
        <span
          className={`glass max-w-full truncate rounded-full px-3 py-1.5 text-center text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-300'}`}
        >
          {activeMode === 'explore' ? 'Pan & zoom' : activeMode === 'monitor' ? `Monitoring ${disasterCount} events` : 'Survey tools active'}
        </span>
      </div>

      <div
        className={`pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] backdrop-blur md:flex ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}
      >
        <span className="h-3 w-3 rounded-full border border-white/20" />
        {activeMode === 'monitor' ? 'Explore · Monitor · Survey' : 'Atlas engine · OpenLayers · Cesium · MapLibre'}
        <span className="h-3 w-px bg-white/10" />
        Zero-cost · Client-side · Offline-ready
      </div>
    </>
  );
}
