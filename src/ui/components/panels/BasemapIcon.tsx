import type { BasemapId } from '../../../stores/mapStore';
import { Satellite, Map as MapIcon, Mountain, Moon } from 'lucide-react';

interface BasemapIconProps {
  basemap: BasemapId;
  isActive: boolean;
  isBrightBasemap: boolean;
  size?: number;
}

// Refined icon-based base-map icons (Item 2 — clean lucide-react glyphs
// in a glassmorphism container, no extruded/3D clay styling). Each icon
// is immediately and distinctly recognizable at a glance: Satellite
// (globe/satellite), Streets (map/roads), Terrain (mountain), Dark
// (moon). Color identity is preserved per basemap option.
const ICON_COLOR: Record<BasemapId, string> = {
  satellite: '#10B981', // green
  streets: '#94A3B8', // neutral
  terrain: '#A16207', // brown
  dark: '#A78BFA', // purple/violet (selected accent)
};

const ICON_BG: Record<BasemapId, string> = {
  satellite: 'rgba(16, 185, 129, 0.12)',
  streets: 'rgba(148, 163, 184, 0.12)',
  terrain: 'rgba(161, 98, 7, 0.12)',
  dark: 'rgba(167, 139, 250, 0.12)',
};

export function BasemapIcon({ basemap, isActive, isBrightBasemap, size = 32 }: BasemapIconProps) {
  const Icon = ICON_MAP[basemap];
  const color = ICON_COLOR[basemap];
  const bg = ICON_BG[basemap];
  return (
    <div
      className={`flex items-center justify-center rounded-lg border transition ${isActive ? 'border-[#5500a4]/50' : 'border-white/10'} ${isBrightBasemap ? 'bg-white/5' : 'bg-white/5'}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div
        className="flex h-5 w-5 items-center justify-center rounded"
        style={{ backgroundColor: bg }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color }} aria-hidden />
      </div>
    </div>
  );
}

const ICON_MAP: Record<BasemapId, typeof Satellite> = {
  satellite: Satellite,
  streets: MapIcon,
  terrain: Mountain,
  dark: Moon,
};
