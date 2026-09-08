import type { BasemapId } from '../../../stores/mapStore';
import { Satellite, Map as MapIcon, Mountain, Moon } from 'lucide-react';

interface BasemapIconProps {
  basemap: BasemapId;
  isActive: boolean;
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

// Clay container surface per option: muted low-contrast solids in the
// option's own color family (not frosted translucency). Only the
// container changed — glyph, tint chip, and selection behavior below
// are exactly as before.
const CONTAINER_BG: Record<BasemapId, string> = {
  satellite: '#22352c',
  streets: '#2b303c',
  terrain: '#3a3122',
  dark: '#171b28',
};

const CLAY_SHADOW =
  'shadow-[inset_2px_2px_4px_rgba(255,255,255,0.16),inset_-2px_-2px_5px_rgba(0,0,0,0.4),3px_3px_7px_rgba(0,0,0,0.45)]';

export function BasemapIcon({ basemap, isActive, size = 32 }: BasemapIconProps) {
  const Icon = ICON_MAP[basemap];
  const color = ICON_COLOR[basemap];
  const bg = ICON_BG[basemap];
  return (
    <div
      className={`flex items-center justify-center rounded-xl border transition ${isActive ? 'border-[#5500a4]/50' : 'border-white/5'} ${CLAY_SHADOW}`}
      style={{ width: size, height: size, backgroundColor: CONTAINER_BG[basemap] }}
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
