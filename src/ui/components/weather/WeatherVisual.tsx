import {
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudMoonRain,
  CloudOff,
  CloudSnow,
  CloudSun,
  CloudSunRain,
  Cloudy,
  Moon,
  Sun,
  SunSnow,
  type LucideIcon,
} from 'lucide-react';
import type { CurrentConditions } from '../../../features/weather/openMeteo';
import {
  WEATHER_CATEGORY_COLORS,
  categorizeWeatherCode,
  describeWeatherCode,
  type WeatherCategory,
} from '../../../features/weather/openMeteo';

interface WeatherVisualProps {
  current: CurrentConditions | null;
  size?: number;
}

// Icon-based current-conditions visual (lucide glyphs — the same icon
// source as the rest of the app, no new dependency). One glyph per
// condition with a true day/night pair wherever the set offers one, so
// every state is legible on its own: the celestial glyph is always a
// distinct sun/moon shape, never fused into a cloud blob. Covered skies
// (overcast, fog, rain, storm, snow) use the same glyph day and night
// with a night-dimmed tint. No animation — the glyph swaps once when
// the condition changes.
const GLYPH: Record<WeatherCategory, { day: LucideIcon; night: LucideIcon; color: string; tint: string }> = {
  clear: { day: Sun, night: Moon, color: WEATHER_CATEGORY_COLORS.clear, tint: 'rgba(255, 176, 32, 0.14)' },
  partly: { day: CloudSun, night: CloudMoon, color: WEATHER_CATEGORY_COLORS.partly, tint: 'rgba(232, 179, 75, 0.14)' },
  overcast: { day: Cloudy, night: Cloudy, color: WEATHER_CATEGORY_COLORS.overcast, tint: 'rgba(148, 163, 184, 0.14)' },
  fog: { day: CloudFog, night: CloudFog, color: WEATHER_CATEGORY_COLORS.fog, tint: 'rgba(168, 179, 197, 0.14)' },
  rain: { day: CloudSunRain, night: CloudMoonRain, color: WEATHER_CATEGORY_COLORS.rain, tint: 'rgba(56, 189, 248, 0.14)' },
  snow: { day: SunSnow, night: CloudSnow, color: WEATHER_CATEGORY_COLORS.snow, tint: 'rgba(191, 227, 255, 0.14)' },
  storm: { day: CloudLightning, night: CloudLightning, color: WEATHER_CATEGORY_COLORS.storm, tint: 'rgba(245, 197, 66, 0.14)' },
  unknown: { day: CloudOff, night: CloudOff, color: WEATHER_CATEGORY_COLORS.unknown, tint: 'rgba(100, 116, 139, 0.14)' },
};

export function WeatherVisual({ current, size = 64 }: WeatherVisualProps) {
  if (!current) {
    const fallback = GLYPH.unknown;
    const FallbackIcon = fallback.day;
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-2xl border border-white/10"
        style={{ width: size, height: size, backgroundColor: fallback.tint }}
        aria-label="No weather data available"
        role="img"
      >
        <FallbackIcon style={{ color: fallback.color, width: size * 0.5, height: size * 0.5 }} aria-hidden />
      </div>
    );
  }

  const category = categorizeWeatherCode(current.weatherCode);
  const entry = GLYPH[category];
  const Icon = current.isDay ? entry.day : entry.night;
  const label = `${describeWeatherCode(current.weatherCode)} (${current.isDay ? 'day' : 'night'})`;

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl border border-white/10"
      style={{ width: size, height: size, backgroundColor: entry.tint }}
      aria-label={label}
      role="img"
    >
      <Icon style={{ color: entry.color, width: size * 0.52, height: size * 0.52 }} aria-hidden />
    </div>
  );
}
