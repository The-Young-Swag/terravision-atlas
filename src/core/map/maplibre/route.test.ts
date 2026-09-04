import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ROUTE_CASING_LAYER_ID,
  ROUTE_LINE_LAYER_ID,
  ROUTE_SOURCE_ID,
  removeRouteLayers,
  setRouteVisible,
} from './route';
import type { EvacRoute } from '../../../stores/routeStore';

function fakeMap() {
  const sources = new Map<string, unknown>();
  const layers = new Map<string, unknown>();
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

  it('adds a GeoJSON source with casing and verdict-colored line, in order', () => {
    setRouteVisible(map as never, route);
    expect(map.addSource).toHaveBeenCalledOnce();
    const source = map.sources.get(ROUTE_SOURCE_ID) as {
      data: { features: { geometry: { coordinates: number[][] } }[] };
    };
    expect(source.data.features).toHaveLength(1);
    expect(source.data.features[0].geometry.coordinates).toEqual([
      [120.58, 15.14],
      [120.6, 15.16],
    ]);
    const addedIds = (map.addLayer as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0].id);
    expect(addedIds).toEqual([ROUTE_CASING_LAYER_ID, ROUTE_LINE_LAYER_ID]);
    const linePaint = (map.addLayer as ReturnType<typeof vi.fn>).mock.calls[1][0].paint;
    expect(linePaint['line-color']).toBe('#00d890');
  });

  it('colors amber when the route enters the area', () => {
    setRouteVisible(map as never, { ...route, avoidsArea: false });
    const linePaint = (map.addLayer as ReturnType<typeof vi.fn>).mock.calls[1][0].paint;
    expect(linePaint['line-color']).toBe('#FF9F1C');
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
