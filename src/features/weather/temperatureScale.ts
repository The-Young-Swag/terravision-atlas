// Temperature-to-color bands for the weather chart (user-confirmed).
// Single source of truth: both the temperature line/points and the legend
// swatch resolve through temperatureColorFor — never inline conditionals.
//
// Bands use strict less-than ceilings, so every boundary value lands
// exactly: 14→#4BB6E6, 18→#B9E7FF, 27→#FFD600, 31→#FFAE00, 36→#FF3B30,
// with no gaps, overlaps, or float slivers.

export const TEMPERATURE_BAND_CEILINGS: { below: number; color: string }[] = [
  { below: 14, color: '#E6F7FF' }, // below 14°
  { below: 18, color: '#4BB6E6' }, // 14° – 17°
  { below: 27, color: '#B9E7FF' }, // 18° – 26°
  { below: 31, color: '#FFD600' }, // 27° – 30° (confirmed yellow)
  { below: 36, color: '#FFAE00' }, // 31° – 35° (confirmed orange-yellow)
];

/** 36° and up (confirmed #FF3B30) — anything at/above the last ceiling. */
export const TEMPERATURE_RED = '#FF3B30';

/** Fallback when no temperature value exists (keeps the previous static
 *  line color so gaps never render a misleading band). */
export const TEMPERATURE_FALLBACK = '#FF9F1C';

/**
 * Band color for a temperature in °C.
 * Null/NaN returns the fallback (renders gaps, never a fake band).
 */
export function temperatureColorFor(celsius: number | null | undefined): string {
  if (celsius === null || celsius === undefined || !Number.isFinite(celsius)) return TEMPERATURE_FALLBACK;
  for (const band of TEMPERATURE_BAND_CEILINGS) {
    if (celsius < band.below) return band.color;
  }
  return TEMPERATURE_RED;
}
