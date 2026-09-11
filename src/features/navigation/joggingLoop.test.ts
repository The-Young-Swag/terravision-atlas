import { describe, expect, it } from 'vitest';
import { buildJogLoop, ringWaypoints } from './joggingLoop';
import type { MultiStopRoute, RoutePoint } from './valhalla';

const start: RoutePoint = { lon: 120.5887, lat: 15.145 };

function mockRoute(snapToTarget: number): (locations: RoutePoint[]) => Promise<MultiStopRoute> {
  return async (locations) => ({
    // Test double only: pretend the routed distance scales with the ring.
    path: locations,
    distanceKm: snapToTarget,
    durationMinutes: snapToTarget * 12,
    maneuverCount: locations.length,
  });
}

describe('ringWaypoints', () => {
  it('places six points around the start at the given radius', () => {
    const points = ringWaypoints(start, 1);
    expect(points).toHaveLength(6);
    for (const point of points) {
      const dist = Math.hypot((point.lon - start.lon) * 111, (point.lat - start.lat) * 111);
      expect(dist).toBeCloseTo(1, 0);
    }
  });
});

describe('buildJogLoop', () => {
  it('returns the routed loop with its actual distance when within tolerance', async () => {
    const result = await buildJogLoop({ start, targetKm: 5, hilliness: 'flat' }, mockRoute(5.4));
    expect(result.distanceKm).toBe(5.4);
    expect(result.targetKm).toBe(5);
    expect(result.withinTolerance).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.path[0]).toEqual(start);
    expect(result.path[result.path.length - 1]).toEqual(start);
  });

  it('reports the actual distance honestly when the target is unreachable', async () => {
    // Mock always returns 2 km regardless of ring size: rescaling cannot
    // converge, so after MAX_ATTEMPTS the actual 2 km is reported as-is.
    const result = await buildJogLoop({ start, targetKm: 5, hilliness: 'hilly' }, mockRoute(2));
    expect(result.distanceKm).toBe(2);
    expect(result.withinTolerance).toBe(false);
    expect(result.attempts).toBe(3);
  });

  it('passes hilliness through to pedestrian costing options', async () => {
    let seen: Record<string, number | string> | null = null;
    await buildJogLoop({ start, targetKm: 5, hilliness: 'flat' }, async (locations, options) => {
      seen = options;
      return { path: locations, distanceKm: 5, durationMinutes: 60, maneuverCount: 1 };
    });
    expect(seen).toMatchObject({ use_hills: 0.15, walkway_factor: 0.9 });
  });

  it('rejects absurd targets without any request', async () => {
    let called = false;
    const never = async () => {
      called = true;
      throw new Error('must not be called');
    };
    await expect(buildJogLoop({ start, targetKm: 0.1, hilliness: 'flat' }, never)).rejects.toThrow(
      'between 0.5 and 42 km',
    );
    expect(called).toBe(false);
  });
});
