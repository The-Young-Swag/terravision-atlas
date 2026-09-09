import { useMemo } from 'react';
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

  return (
    <>
      {/* Footer: mobile-first. Uses inset-x to respect viewport, capped width
          on desktop. On mobile the right inset reserves 3.5rem for the
          collapsed OpenLayers/MapLibre attribution button so it stays
          tappable. Tailwind v4 arbitrary values keep this in markup. */}
      <footer
        className={`glass absolute inset-x-3 bottom-3 z-10 flex flex-col gap-1.5 rounded-xl px-3 py-2 font-mono text-[11px] sm:flex-row sm:items-center sm:justify-between md:inset-x-auto md:bottom-4 md:left-4 md:right-auto md:w-[28rem] md:max-w-[85vw] md:rounded-2xl md:px-4 md:py-2 max-md:right-14 ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}
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
