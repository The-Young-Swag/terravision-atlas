import { describe, expect, it } from 'vitest';
import { circleToRing, routeAvoidsRing } from './avoidZone';

const RING = circleToRing({ lon: 0, lat: 0, radiusKm: 1 });

describe('routeAvoidsRing', () => {
  it('passes when no ring was requested', () => {
    expect(routeAvoidsRing([{ lon: 0, lat: 0 }], null)).toBe(true);
  });

  it('passes when the path stays clear of the ring', () => {
    expect(
      routeAvoidsRing(
        [
          { lon: 5, lat: 5 },
          { lon: 6, lat: 6 },
        ],
        RING,
      ),
    ).toBe(true);
  });

  it('fails when the path cuts through the ring', () => {
    expect(
      routeAvoidsRing(
        [
          { lon: -5, lat: 0 },
          { lon: 5, lat: 0 },
        ],
        RING,
      ),
    ).toBe(false);
  });
});
