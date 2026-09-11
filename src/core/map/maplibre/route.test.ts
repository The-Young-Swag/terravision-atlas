import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ROUTE_CASING_LAYER_ID,
  ROUTE_LINE_LAYER_ID,
  ROUTE_SOURCE_ID,
  removeRouteLayers,
  setRouteVisible,
} from './route';
import { ROUTE_LINE_COLOR } from '../../../features/map/routeStyle';
import type { EvacRoute } from '../../../stores/routeStore';
import type { FlowSample } from '../../../features/traffic/flowEta';

function fakeMap() {
  const sources = new Map<string, unknown>();
  const layers = new Map<string, unknown>();
  const images = new Map<string, unknown>();
  return {
    sources,
    layers,
    getSource: (id: string) => sources.get(id) as { type: string } | undefined,
    getLayer: (id: string) => layers.get(id),
    addSource: vi.fn((id: string, source: unknown) => {
      sources.set(id, source);
    }),
    addLayer: vi.fn((layer: { id: string }) => {
      layers.set(layer.id, layer);
    }),
    removeSource: vi.fn((id: string) => {
      sources.delete(id);
    }),
    removeLayer: vi.fn((id: string) => {
      layers.delete(id);
    }),
    hasImage: vi.fn((id: string) => images.has(id)),
    addImage: vi.fn((id: string, image: unknown) => {
      images.set(id, image);
    }),
  };
}

type FakeMap = ReturnType<typeof fakeMap>;

const route: EvacRoute = {
  path: [
    { lon: 120.58, lat: 15.14 },
    { lon: 120.6, lat: 15.16 },
  ],
  distanceKm: 5,
  durationMinutes: 10,
  avoidsArea: true,
};

describe('setRouteVisible', () => {
  let map: FakeMap;
  beforeEach(() => {
    map = fakeMap();
  });

  it('adds a GeoJSON source with core line (always blue) and casing, in order', () => {
    setRouteVisible(map as never, route);
    expect(map.addSource).toHaveBeenCalledOnce();
    const source = map.sources.get(ROUTE_SOURCE_ID) as {
      data: { geometry: { coordinates: number[][] }; type: string };
    };
    expect(source.data.type).toBe('Feature');
    expect(source.data.geometry.coordinates).toEqual([
      [120.58, 15.14],
      [120.6, 15.16],
    ]);
    // lineMetrics: true should be set on the source
    expect(source).toMatchObject({ data: expect.any(Object), lineMetrics: true });
    const addedIds = (map.addLayer as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0].id);
    // Core line added first (bottom), then casing on top
    expect(addedIds).toEqual([ROUTE_LINE_LAYER_ID, ROUTE_CASING_LAYER_ID]);
    const linePaint = (map.addLayer as ReturnType<typeof vi.fn>).mock.calls[0][0].paint;
    expect(linePaint['line-color']).toBe(ROUTE_LINE_COLOR);
  });

  it('uses the same blue line color regardless of the avoid verdict', () => {
    setRouteVisible(map as never, { ...route, avoidsArea: false });
    const linePaint = (map.addLayer as ReturnType<typeof vi.fn>).mock.calls[0][0].paint;
    expect(linePaint['line-color']).toBe(ROUTE_LINE_COLOR);
  });

  it('drives the CASING color from per-sample speeds when flow data is available', () => {
    const samples: FlowSample[] = [
      { pathIndex: 0, currentSpeed: 60, freeFlowSpeed: 80 },
      { pathIndex: 1, currentSpeed: 20, freeFlowSpeed: 80 },
    ];
    setRouteVisible(map as never, route, samples);
    // Core line is always blue (first call)
    const linePaint = (map.addLayer as ReturnType<typeof vi.fn>).mock.calls[0][0].paint;
    expect(linePaint['line-color']).toBe(ROUTE_LINE_COLOR);
    // Casing is traffic-colored (second call)
    const casingPaint = (map.addLayer as ReturnType<typeof vi.fn>).mock.calls[1][0].paint;
    expect(casingPaint['line-color']).toMatchObject(['interpolate', ['linear'], ['line-progress'], 0, '#FFFF37', 1, '#FF2323']);
  });

  it('clears everything on null', () => {
    setRouteVisible(map as never, route);
    setRouteVisible(map as never, null);
    expect(map.sources.has(ROUTE_SOURCE_ID)).toBe(false);
    expect(map.layers.size).toBe(0);
  });
});

describe('removeRouteLayers', () => {
  it('is safe on an empty map', () => {
    const map = fakeMap();
    expect(() => removeRouteLayers(map as never)).not.toThrow();
  });
});