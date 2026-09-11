import { describe, expect, it } from 'vitest';
import { formatAreaSqMeters, geodesicAreaSqMeters } from './area';

describe('geodesicAreaSqMeters', () => {
  it('returns null until a polygon exists', () => {
    expect(geodesicAreaSqMeters([])).toBeNull();
    expect(geodesicAreaSqMeters([[0, 0]])).toBeNull();
    expect(geodesicAreaSqMeters([[0, 0], [1, 1]])).toBeNull();
  });

  it('measures a one-degree equatorial square', () => {
    const area = geodesicAreaSqMeters([[0, 0], [1, 0], [1, 1], [0, 1]]);
    expect(area).not.toBeNull();
    // ~111.2 km per side at the equator → ~12,360 km².
    expect(area as number).toBeGreaterThan(12_000_000_000);
    expect(area as number).toBeLessThan(12_800_000_000);
  });

  it('grows with the enclosed region, not the perimeter', () => {
    const small = geodesicAreaSqMeters([[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]]) as number;
    const large = geodesicAreaSqMeters([[0, 0], [1, 0], [1, 1], [0, 1]]) as number;
    expect(large / small).toBeCloseTo(4, 0);
  });
});

describe('formatAreaSqMeters', () => {
  it('formats sub-km² areas in m² and larger ones in km²', () => {
    expect(formatAreaSqMeters(null)).toContain('three or more points');
    expect(formatAreaSqMeters(2500)).toBe('2,500 m²');
    expect(formatAreaSqMeters(12_364_000_000)).toBe('12364.00 km²');
  });
});
