import { useState } from 'react';
import { Settings2, Fuel, Compass, BookOpen, Box } from 'lucide-react';
import { motion } from 'framer-motion';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useMapStore } from '../../../stores/mapStore';
import { useSearchStore } from '../../../stores/searchStore';
import { useRouteStore } from '../../../stores/routeStore';
import { useUiPanelStore } from '../../../stores/uiPanelStore';
import { PlaceAutocomplete } from '../search/PlaceAutocomplete';
import type { GeocodedPlace } from '../../../features/search/geocode';

function PlaceSearchBox() {
  const [query, setQuery] = useState('');
  const setCenter = useMapStore((s) => s.setCenter);
  const setZoom = useMapStore((s) => s.setZoom);
  const setMarker = useSearchStore((s) => s.setMarker);
  const clearMarker = useSearchStore((s) => s.clearMarker);
  const setStart = useRouteStore((s) => s.setStart);
  const setDestination = useRouteStore((s) => s.setDestination);
  const reopenPanel = useUiPanelStore((s) => s.reopenPanel);

  const handleSelect = (place: GeocodedPlace) => {
    setCenter([place.lon, place.lat]);
    setZoom(12);
    setMarker({ lon: place.lon, lat: place.lat, label: place.displayName });
  };

  // Route acceptance: only here does parsing touch the Navigation panel,
  // and only after the user explicitly accepts. The active mode is forced
  // to explore first because Navigation is the explore-only context; this
  // matches the same explore/monitor condition the EvacuationPanel uses.
  const handleRouteResolved = (start: GeocodedPlace, destination: GeocodedPlace) => {
    setStart({ lon: start.lon, lat: start.lat, label: start.displayName.split(',')[0] });
    setDestination({ lon: destination.lon, lat: destination.lat, label: destination.displayName.split(',')[0] });
    // Surface the Navigation panel in the active viewport. Reopen is
    // idempotent: a panel that is already visible stays visible.
    reopenPanel('evacuation');
    setCenter([destination.lon, destination.lat]);
    if (useMapStore.getState().zoom < 12) setZoom(12);
  };

  return (
    <PlaceAutocomplete
      value={query}
      onChange={(text) => {
        setQuery(text);
        if (text.trim().length === 0) clearMarker();
      }}
      onSelect={(place) => {
        setQuery(place.displayName.split(',')[0]);
        handleSelect(place);
      }}
      enableRouteParsing
      onRouteResolved={handleRouteResolved}
      placeholder="Search places"
      ariaLabel="Search places"
    />
  );
}

type AppMode = 'explore' | 'monitor' | 'survey';

function getModeColor(mode: AppMode): string {
  switch (mode) {
    case 'explore':
      return 'bg-[#059669]';
    case 'monitor':
      return 'bg-[#dc2626]';
    case 'survey':
      return 'bg-[#2563eb]';
    default:
      return 'bg-[#059669]';
  }
}

interface TopBarProps {
  activeMode: AppMode;
  setActiveMode: (mode: AppMode) => void;
  setFuelOpen: (open: boolean) => void;
  setStoryOpen: (open: boolean) => void;
  setMinecraftOpen: (open: boolean) => void;
}

export function TopBar({
  activeMode,
  setActiveMode,
  setFuelOpen,
  setStoryOpen,
  setMinecraftOpen,
}: TopBarProps) {
  const isBrightBasemap = useBrightBasemap();

  return (
    <>
      {/* Top bar */}
      <header className="absolute left-4 right-4 top-4 z-20 flex items-center gap-3">
        <div className="glass-strong flex shrink-0 items-center gap-2.5 rounded-2xl px-4 py-2.5">
          <Compass className="h-5 w-5 text-[#5500a4]" aria-hidden />
          <span className={`text-[15px] font-semibold tracking-tight ${isBrightBasemap ? 'text-slate-900' : 'text-slate-100'}`}>TerraVision</span>
          <span className={`text-[11px] font-medium tracking-widest ${isBrightBasemap ? 'text-slate-700' : 'text-slate-400'}`}>ATLAS</span>
        </div>

        <div className="glass flex max-w-md flex-1 items-center gap-2.5 rounded-2xl px-4 py-2.5 search-bar-shell">
          <PlaceSearchBox />
        </div>

        {/* Mode switcher — Explore / Monitor / Survey with per-mode colors */}
        <div className={`glass hidden items-center gap-1 rounded-full p-1 text-[13px] font-medium md:flex ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
          {(['explore', 'monitor', 'survey'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`relative rounded-full px-4 py-1.5 capitalize transition ${activeMode === mode ? 'text-white' : isBrightBasemap ? 'hover:text-slate-900' : 'hover:text-white'}`}
              aria-pressed={activeMode === mode}
            >
              {activeMode === mode && (
                <motion.span
                  layoutId="mode-thumb"
                  className={`absolute inset-0 rounded-full shadow ${getModeColor(mode)}`}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative">{mode}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setStoryOpen(true)}
          className={`glass flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
          aria-label="Open storytelling"
        >
          <BookOpen className="h-[18px] w-[18px]" />
        </button>

        <button
          onClick={() => setMinecraftOpen(true)}
          className={`glass flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
          aria-label="Open Minecraft export"
        >
          <Box className="h-[18px] w-[18px]" />
        </button>

        <button
          onClick={() => setFuelOpen(true)}
          className={`glass flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
          aria-label="Open fuel calculator"
        >
          <Fuel className="h-[18px] w-[18px]" />
        </button>

        <button
          className={`glass hidden h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-2xl opacity-60 transition md:flex ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}
          aria-label="Settings"
          disabled
          title="Settings — not implemented"
        >
          <Settings2 className="h-[18px] w-[18px]" />
        </button>
      </header>

      {/* Mobile mode switcher */}
      <div className="absolute left-4 right-4 top-[4.75rem] z-20 flex justify-center md:hidden">
        <div className={`glass flex items-center gap-1 rounded-full p-1 text-[13px] font-medium ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
          {(['explore', 'monitor', 'survey'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`rounded-full px-3 py-1.5 capitalize transition ${activeMode === mode ? `${getModeColor(mode)} text-white shadow` : isBrightBasemap ? 'hover:text-slate-900' : 'hover:text-white'}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
