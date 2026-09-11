import type { BasemapId } from '../../../features/map/store';
import { Satellite, Map as MapIcon, Mountain, Moon } from 'lucide-react';

interface BasemapIconProps {
  basemap: BasemapId;
  size?: number;
}

// Base-map icons in the sidebar-notch treatment: one rounded chip per
// option, glyph in the option's accent color on that accent at low
// alpha — immediately distinctive by shape + color at a glance.
// No claymorphism; the surrounding glass rows are untouched.
const ACCENT: Record<BasemapId, string> = {
  satellite: '#10B981', // green
  streets: '#94A3B8', // neutral
  terrain: '#D9A441', // amber
  dark: '#A78BFA', // violet
};

const ICON_MAP: Record<BasemapId, typeof Satellite> = {
  satellite: Satellite,
  streets: MapIcon,
  terrain: Mountain,
  dark: Moon,
};

export function BasemapIcon({ basemap, size = 32 }: BasemapIconProps) {
  const Icon = ICON_MAP[basemap];
  const accent = ACCENT[basemap];
  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-[10px]"
      style={{ width: size, height: size, color: accent, backgroundColor: `${accent}29` }}
      aria-hidden="true"
    >
      <Icon style={{ width: size * 0.56, height: size * 0.56 }} aria-hidden />
    </span>
  );
}
