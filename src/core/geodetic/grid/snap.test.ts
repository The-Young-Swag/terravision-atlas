import { describe, expect, it } from 'vitest';
import { niceGridStepDegrees, snapLonLat } from './snap';

describe('niceGridStepDegrees', () => {
  it('targets ~20px in a 1/2/5 series', () => {
    // z11 ≈ 76 m/px near Angeles City → target ≈ 1520 m ≈ 0.014° → 0.02°
    expect(niceGridStepDegrees(76.4, 15.1)).toBe(0.02);
    // z15 ≈ 4.8 m/px → target ≈ 96 m ≈ 0.00086° → 0.001°
    expect(niceGridStepDegrees(4.8, 15.1)).toBe(0.001);
  });

  it('falls back safely on bad input', () => {
    expect(niceGridStepDegrees(0, 15)).toBe(0.001);
    expect(niceGridStepDegrees(NaN, 15)).toBe(0.001);
  });
});

describe('snapLonLat', () => {
  it('rounds to exact grid multiples', () => {
    expect(snapLonLat(120.58873, 15.14504, 0.001)).toEqual({ lon: 120.589, lat: 15.145 });
    // floating-point exactness for decimal steps
    const snapped = snapLonLat(120.5887, 15.145, 0.02);
    expect(snapped.lon / 0.02).toBeCloseTo(Math.round(snapped.lon / 0.02), 10);
  });
});
