import { MapPin } from 'lucide-react';
import { useMapStore } from '../../../stores/mapStore';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useState } from 'react';

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
  const [locating, setLocating] = useState(false);

  const handleClick = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.longitude, pos.coords.latitude]);
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
      className={`flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-medium transition hover:bg-white/10 disabled:opacity-60 ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'} ${className}`}
    >
      <MapPin className={`h-4 w-4 shrink-0 ${locating ? 'animate-pulse' : ''}`} aria-hidden />
      <span className={compact ? 'hidden sm:inline' : ''}>{locating ? 'Locating…' : 'My location'}</span>
    </button>
  );
}
