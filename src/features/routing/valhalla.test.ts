import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  VALHALLA_CLIENT_ID,
  VALHALLA_ROUTE_URL,
  buildAvoidanceRequestBody,
  decodePolyline6,
  parseAvoidanceResponse,
  routeAvoidingArea,
} from './valhalla';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('decodePolyline6', () => {
  it('decodes the documented polyline example scaled to precision 6', () => {
    // Google's documented example `_p~iF~ps|U_ulLnnqC_mqNvxq`@ decodes at
    // precision 5 to (38.5,-120.2), (40.7,-120.95), (43.252,-126.453).
    // Read back with the precision-6 divisor those become exactly those
    // values divided by 10, which validates the decoder bit manipulation
    // independently of this codebase.
    const points = decodePolyline6('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(points).toHaveLength(3);
    expect(points[0].lat).toBeCloseTo(3.85, 6);
    expect(points[0].lon).toBeCloseTo(-12.02, 6);
    expect(points[1].lat).toBeCloseTo(4.07, 6);
    expect(points[1].lon).toBeCloseTo(-12.095, 6);
    expect(points[2].lat).toBeCloseTo(4.3252, 6);
    expect(points[2].lon).toBeCloseTo(-12.6453, 6);
  });
});

describe('buildAvoidanceRequestBody', () => {
  it('sends locations, auto costing, and the exclusion polygon', () => {
    const ring = [
      { lon: 120.6, lat: 15.15 },
      { lon: 120.61, lat: 15.15 },
      { lon: 120.61, lat: 15.16 },
      { lon: 120.6, lat: 15.15 },
    ];
    const body = buildAvoidanceRequestBody({ lon: 120.588, lat: 15.145 }, { lon: 120.62, lat: 15.17 }, ring);
    expect(body.costing).toBe('auto');
    expect(body.locations).toEqual([
      { lat: 15.145, lon: 120.588 },
      { lat: 15.17, lon: 120.62 },
    ]);
    expect(body.exclude_polygons).toHaveLength(1);
    expect(body.exclude_polygons?.[0]?.[0]).toEqual({ lat: 15.15, lon: 120.6 });
    expect(body.directions_options).toEqual({ units: 'kilometers' });
  });

  it('omits exclude_polygons when there is no avoid area', () => {
    const body = buildAvoidanceRequestBody({ lon: 0, lat: 0 }, { lon: 1, lat: 1 }, null);
    expect(body.exclude_polygons).toBeUndefined();
    expect(body.locations).toHaveLength(2);
  });
});

describe('parseAvoidanceResponse', () => {
  it('decodes the leg shape and summary', () => {
    const route = parseAvoidanceResponse({
      trip: {
        status: 0,
        summary: { length: 12.5, time: 1500 },
        legs: [{ shape: '_p~iF~ps|U', maneuvers: [{}, {}] }],
      },
    });
    expect(route.distanceKm).toBe(12.5);
    expect(route.durationMinutes).toBe(25);
    expect(route.maneuverCount).toBe(2);
    expect(route.path).toHaveLength(1);
    expect(route.path[0].lat).toBeCloseTo(3.85, 6);
    expect(route.path[0].lon).toBeCloseTo(-12.02, 6);
  });

  it('rejects error responses without fabricating a route', () => {
    expect(() => parseAvoidanceResponse({ error: 'No route found' })).toThrow('No route found');
    expect(() => parseAvoidanceResponse({ trip: { status: 2, status_message: 'No path' } })).toThrow('No path');
    expect(() => parseAvoidanceResponse({ trip: { status: 0, legs: [] } })).toThrow('without geometry');
  });
});

describe('routeAvoidingArea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts to the Valhalla demo server with the client id header', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { trip: { status: 0, summary: { length: 1, time: 60 }, legs: [{ shape: '_p~iF' }] } },
    });
    const ring = [
      { lon: 0, lat: 0 },
      { lon: 1, lat: 0 },
      { lon: 1, lat: 1 },
      { lon: 0, lat: 0 },
    ];
    await routeAvoidingArea({ lon: 0, lat: 0 }, { lon: 2, lat: 2 }, ring);
    expect(mockedAxios.post).toHaveBeenCalledOnce();
    const [url, , options] = mockedAxios.post.mock.calls[0];
    expect(url).toBe(VALHALLA_ROUTE_URL);
    expect(options?.headers?.['X-Client-Id']).toBe(VALHALLA_CLIENT_ID);
  });

  it('rejects degenerate avoid rings before any request', async () => {
    await expect(routeAvoidingArea({ lon: 0, lat: 0 }, { lon: 1, lat: 1 }, [{ lon: 0, lat: 0 }])).rejects.toThrow(
      'at least 3 distinct points',
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
