import { useMemo } from 'react';
import { useMapStore } from '../../../stores/mapStore';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useDisaster } from '../../../hooks/useDisaster';

type AppMode = 'explore' | 'monitor' | 'survey';

interface StatusBarProps {
  activeMode: AppMode;
}

export function StatusBar({ activeMode }: StatusBarProps) {
  const { center, zoom, viewMode } = useMapStore();
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
      {/* In Vector mode the right edge pulls in (animated) to clear the
          MapLibre zoom control bottom-right. Same element, same bottom/left
          anchor — only the width transitions, so no state is lost. */}
      <footer className={`glass absolute bottom-4 left-4 z-10 flex flex-col gap-2 rounded-2xl px-4 py-2 font-mono text-[11px] transition-[right] duration-300 ease-in-out sm:flex-row sm:items-center sm:justify-between ${viewMode === 'vector' ? 'right-20' : 'right-4'} ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <span>{centerLabel}</span>
          {activeMode === 'survey' && <span>EPSG:32651 · UTM 51N</span>}
          {activeMode === 'monitor' && <span className="text-[#FF9F1C]">{disasterCount} active incidents nearby</span>}
          <span className="hidden sm:inline">Zoom {zoom.toFixed(1)}</span>
        </div>
        <div className={`flex items-center gap-1.5 font-sans ${isBrightBasemap ? 'text-slate-700' : 'text-slate-300'}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#00d890]" />
          Live · updated 12s ago
        </div>
        <div className="hidden items-center gap-4 sm:flex">
          <span>1 : 150,000</span>
          <span>50 km</span>
        </div>
      </footer>

      <div className="absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 gap-2 md:hidden">
        <span className={`glass rounded-full px-3 py-1.5 text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-300'}`}>
          {activeMode === 'explore' ? 'Pan & zoom the map' : activeMode === 'monitor' ? `Monitoring ${disasterCount} events` : 'Survey tools active'}
        </span>
      </div>

      <div className={`pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] backdrop-blur md:flex ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
        <span className="h-3 w-3 rounded-full border border-white/20" />
        {activeMode === 'monitor' ? 'Explore · Monitor · Survey' : 'Atlas engine · OpenLayers · Cesium · MapLibre'}
        <span className="h-3 w-px bg-white/10" />
        Zero-cost · Client-side · Offline-ready
      </div>
    </>
  );
}
