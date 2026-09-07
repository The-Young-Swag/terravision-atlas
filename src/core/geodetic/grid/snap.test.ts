import { describe, expect, it } from 'vitest';
import { niceGridStepDegrees, niceMeterStep, snapLonLat, snapToUtmGrid } from './snap';

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

describe('niceMeterStep', () => {
  it('targets ~20px in a 1/2/5 series', () => {
    // z11 ≈ 76 m/px → target ≈ 1520 m → 2000 m
    expect(niceMeterStep(76.4)).toBe(2000);
    // z15 ≈ 4.8 m/px → target ≈ 96 m → 100 m
    expect(niceMeterStep(4.8)).toBe(100);
  });

  it('falls back safely on bad input', () => {
    expect(niceMeterStep(0)).toBe(10);
    expect(niceMeterStep(NaN)).toBe(10);
  });
});

describe('snapToUtmGrid', () => {
  it('snaps Malcampa-area points to the UTM 51N meter grid', () => {
    // 10 m grid near Malcampa, Camiling (≈15.68°N, 120.41°E)
    const snapped = snapToUtmGrid(120.41234, 15.68123, 10);
    expect(snapped.lon).not.toBe(120.41234);
    // idempotent: snapping twice changes nothing further
    expect(snapToUtmGrid(snapped.lon, snapped.lat, 10)).toEqual(snapped);
  });

  it('moves points by less than the grid diagonal', () => {
    const [lon, lat] = [120.41234, 15.68123];
    const snapped = snapToUtmGrid(lon, lat, 100);
    const dLonM = Math.abs(snapped.lon - lon) * 111320 * Math.cos((lat * Math.PI) / 180);
    const dLatM = Math.abs(snapped.lat - lat) * 111320;
    expect(Math.hypot(dLonM, dLatM)).toBeLessThan(100 * Math.SQRT2);
  });

  it('passes input through on bad step', () => {
    expect(snapToUtmGrid(120.4, 15.6, 0)).toEqual({ lon: 120.4, lat: 15.6 });
  });
});
