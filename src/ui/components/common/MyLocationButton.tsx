import { MapPin } from 'lucide-react';
import * as turf from '@turf/turf';
import { useMapStore } from '../../../stores/mapStore';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useState } from 'react';

/** Radius in meters within which the map still counts as "on" the last
 *  geolocation fix (panning further away clears the active highlight). */
export const MY_LOCATION_ACTIVE_RADIUS_M = 50;

/** Single shared active treatment for every My Location control (global
 *  search, weather widget): success green, important-flagged so it wins
 *  over the per-site className overrides deterministically. */
export const MY_LOCATION_ACTIVE_CLASS = '!text-[#00d890]';

export function MyLocationButton({
  compact = false,
  className = '',
}: {
  compact?: boolean;
  className?: string;
}) {
  const isBrightBasemap = useBrightBasemap();
  const setCenter = useMapStore((s) => s.setCenter);
  const setZoom = useMapStore((s) => s.setZoom);
  const center = useMapStore((s) => s.center);
  const myLocation = useMapStore((s) => s.myLocation);
  const setMyLocation = useMapStore((s) => s.setMyLocation);
  const [locating, setLocating] = useState(false);

  // Active = acquiring a fix right now, or sitting on a real fix. Derived
  // from the shared fix plus the live map center — panning away reverts
  // automatically, no simulated flags.
  const onFix =
    myLocation !== null &&
    turf.distance([myLocation.lon, myLocation.lat], [center[0], center[1]], { units: 'meters' }) <=
      MY_LOCATION_ACTIVE_RADIUS_M;
  const active = locating || onFix;

  const handleClick = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const fix = { lon: pos.coords.longitude, lat: pos.coords.latitude };
        setMyLocation(fix);
        setCenter([fix.lon, fix.lat]);
        setZoom(12);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={locating}
      title="Center map to my location"
      aria-label="Use my location"
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-medium transition hover:bg-white/10 disabled:opacity-60 ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'} ${className} ${active ? MY_LOCATION_ACTIVE_CLASS : ''}`}
    >
      <MapPin className={`h-4 w-4 shrink-0 ${locating ? 'animate-pulse' : ''}`} aria-hidden />
      {active && !locating && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00d890]" aria-hidden />}
      <span className={compact ? 'hidden sm:inline' : ''}>{locating ? 'Locating…' : 'My location'}</span>
    </button>
  );
}
