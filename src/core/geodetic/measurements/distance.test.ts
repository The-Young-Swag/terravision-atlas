import { describe, expect, it } from 'vitest';
import { bearingDegrees, formatBearing, formatDistanceKilometers, geodesicKilometers } from './distance';

describe('geodesicKilometers', () => {
  it('returns null until two points are picked', () => {
    expect(geodesicKilometers([])).toBeNull();
    expect(geodesicKilometers([[0, 0]])).toBeNull();
  });

  it('measures a degree of latitude as ~111 km', () => {
    expect(geodesicKilometers([[0, 0], [0, 1]])).toBeCloseTo(111.2, 0);
  });

  it('sums every segment of a multi-point path', () => {
    const bent = geodesicKilometers([[0, 0], [0, 1], [1, 1]]) as number;
    const leg1 = geodesicKilometers([[0, 0], [0, 1]]) as number;
    const leg2 = geodesicKilometers([[0, 1], [1, 1]]) as number;
    expect(bent).toBeCloseTo(leg1 + leg2, 6);
    expect(bent).toBeCloseTo(222.4, 0);
  });
});

describe('bearingDegrees', () => {
  it('reports cardinal bearings clockwise from north', () => {
    expect(bearingDegrees([0, 0], [0, 1])).toBeCloseTo(0, 6);
    expect(bearingDegrees([0, 0], [1, 0])).toBeCloseTo(90, 6);
    expect(bearingDegrees([0, 0], [0, -1])).toBeCloseTo(180, 6);
  });
});

describe('format helpers', () => {
  it('formats meters below a kilometer and pads bearings', () => {
    expect(formatDistanceKilometers(0.85)).toBe('850 m');
    expect(formatDistanceKilometers(1.234)).toBe('1.23 km');
    expect(formatDistanceKilometers(null)).toBe('Click two points on the map');
    expect(formatBearing(5)).toBe('005°');
    expect(formatBearing(270.4)).toBe('270°');
  });
});
