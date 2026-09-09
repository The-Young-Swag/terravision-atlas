import { useState } from 'react';
import { Settings2, Fuel, BookOpen, Box } from 'lucide-react';
import { motion } from 'framer-motion';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { MyLocationButton } from '../common/MyLocationButton';
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
      {/* Top bar — mobile-first: single row on >=640px, two rows below; every
          child can shrink (min-w-0) so nothing overflows 375px. */}
      <header className="absolute inset-x-3 top-3 z-20 flex items-center gap-1.5 md:inset-x-4 md:top-4 md:gap-3">
        <div className="glass-strong flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 md:gap-2.5 md:rounded-2xl md:px-4 md:py-2.5">
          <span className={`shrink-0 text-[13px] font-semibold tracking-tight md:text-[15px] ${isBrightBasemap ? 'text-slate-900' : 'text-slate-100'}`}>TerraVision</span>
          <span className={`hidden shrink-0 text-[10px] font-medium tracking-widest sm:inline md:text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-300'}`}>ATLAS</span>
        </div>

        <div className="glass flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-2 md:gap-2.5 md:rounded-2xl md:px-4 md:py-2.5">
          <PlaceSearchBox />
        </div>

        <MyLocationButton compact />

        {/* Mode switcher — Explore / Monitor / Survey with per-mode colors */}
        <div className={`glass hidden items-center gap-1 rounded-full p-1 text-[13px] font-medium md:flex ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
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
          className={`glass flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition md:h-10 md:w-10 md:rounded-2xl ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
          aria-label="Open storytelling"
        >
          <BookOpen className="h-4 w-4 md:h-[18px] md:w-[18px]" />
        </button>

        <button
          onClick={() => setMinecraftOpen(true)}
          className={`glass flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition md:h-10 md:w-10 md:rounded-2xl ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
          aria-label="Open Minecraft export"
        >
          <Box className="h-4 w-4 md:h-[18px] md:w-[18px]" />
        </button>

        <button
          onClick={() => setFuelOpen(true)}
          className={`glass flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition md:h-10 md:w-10 md:rounded-2xl ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
          aria-label="Open fuel calculator"
        >
          <Fuel className="h-4 w-4 md:h-[18px] md:w-[18px]" />
        </button>

        <button
          className={`glass hidden h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-2xl opacity-60 transition md:flex ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}
          aria-label="Settings"
          disabled
          title="Settings — not implemented"
        >
          <Settings2 className="h-[18px] w-[18px]" />
        </button>
      </header>

      {/* Mobile mode switcher — centered pill below the header; uses same
          inset-x as header so it never overflows. */}
      <div className="absolute inset-x-3 top-[3.5rem] z-20 flex justify-center md:hidden">
        <div className={`glass flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-1 text-[12px] font-medium [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
          {(['explore', 'monitor', 'survey'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`shrink-0 rounded-full px-3 py-1.5 capitalize transition ${activeMode === mode ? `${getModeColor(mode)} text-white shadow` : isBrightBasemap ? 'hover:text-slate-900' : 'hover:text-white'}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
