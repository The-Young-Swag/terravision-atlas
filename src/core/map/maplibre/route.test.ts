import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ROUTE_CASING_LAYER_ID,
  ROUTE_DIRECTION_LAYER_ID,
  ROUTE_LINE_LAYER_ID,
  ROUTE_SOURCE_ID,
  removeRouteLayers,
  setRouteVisible,
} from './route';
import { FALLBACK_LINE_COLOR_FOR_TEST } from './route';
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

  it('adds a GeoJSON source with casing and unified blue line, in order', () => {
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
    const addedIds = (map.addLayer as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0].id);
    expect(addedIds).toEqual([ROUTE_CASING_LAYER_ID, ROUTE_LINE_LAYER_ID]);
    const linePaint = (map.addLayer as ReturnType<typeof vi.fn>).mock.calls[1][0].paint;
    expect(linePaint['line-color']).toBe(FALLBACK_LINE_COLOR_FOR_TEST);
  });

  it('uses the same blue line color regardless of the avoid verdict', () => {
    setRouteVisible(map as never, { ...route, avoidsArea: false });
    const linePaint = (map.addLayer as ReturnType<typeof vi.fn>).mock.calls[1][0].paint;
    expect(linePaint['line-color']).toBe(FALLBACK_LINE_COLOR_FOR_TEST);
  });

  it('drives the line color from per-sample speeds when flow data is available', () => {
    const samples: FlowSample[] = [
      { pathIndex: 0, currentSpeed: 60, freeFlowSpeed: 80 },
      { pathIndex: 1, currentSpeed: 20, freeFlowSpeed: 80 },
    ];
    setRouteVisible(map as never, route, samples);
    const linePaint = (map.addLayer as ReturnType<typeof vi.fn>).mock.calls[1][0].paint;
    expect(linePaint['line-color']).toMatchObject(['interpolate', ['linear'], ['line-progress'], 0, '#FFFF37', 1, '#FF2323']);
  });

  it('adds a line-placed direction layer when a canvas chevron can be built', () => {
    const noop = () => {};
    const contextStub = {
      lineJoin: '',
      lineCap: '',
      strokeStyle: '',
      lineWidth: 0,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      stroke: noop,
      getImageData: () => ({ width: 28, height: 28 }),
    };
    const documentStub = {
      createElement: () => ({ width: 0, height: 0, getContext: () => contextStub }),
    };
    const holder = globalThis as unknown as { document?: unknown };
    const previous = holder.document;
    holder.document = documentStub;
    try {
      setRouteVisible(map as never, route);
    } finally {
      holder.document = previous;
    }
    const addedIds = (map.addLayer as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0].id);
    expect(addedIds).toEqual([ROUTE_CASING_LAYER_ID, ROUTE_LINE_LAYER_ID, ROUTE_DIRECTION_LAYER_ID]);
    const directionLayout = (map.addLayer as ReturnType<typeof vi.fn>).mock.calls[2][0].layout;
    expect(directionLayout['symbol-placement']).toBe('line');
    expect(directionLayout['icon-rotation-alignment']).toBe('map');
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
