import { describe, expect, it } from 'vitest';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { Stroke } from 'ol/style';
import { createRouteLayer } from './routeLayer';
import { createAvoidLayer } from './avoidLayer';
import { ROUTE_LINE_COLOR } from '../routeStyle';

const route = {
  path: [
    { lon: 120.58, lat: 15.14 },
    { lon: 120.6, lat: 15.16 },
    { lon: 120.62, lat: 15.17 },
  ],
  distanceKm: 5,
  durationMinutes: 10,
  avoidsArea: true,
};

describe('createRouteLayer', () => {
  it('builds casing, line, chevrons, and endpoint markers from the path', () => {
    const layer = createRouteLayer(route);
    const features = layer.getSource()?.getFeatures() ?? [];
    // casing + line + 4 direction chevrons + 2 endpoint markers
    expect(features).toHaveLength(8);
    const lines = features.filter((f) => f.getGeometry() instanceof LineString);
    expect(lines).toHaveLength(2);
    expect((lines[0].getGeometry() as LineString).getCoordinates()).toHaveLength(3);
    const points = features.filter((f) => f.getGeometry() instanceof Point);
    expect(points).toHaveLength(6);
  });

  it('uses the unified blue line color regardless of the avoid verdict', () => {
    for (const avoidsArea of [true, false]) {
      const layer = createRouteLayer({ ...route, avoidsArea });
      const lines = (layer.getSource()?.getFeatures() ?? []).filter((f) => f.getGeometry() instanceof LineString);
      const strokes = lines.map((f) => (f.getStyle() as { getStroke(): Stroke }).getStroke().getColor());
      expect(strokes).toContain(ROUTE_LINE_COLOR);
    }
  });
});

describe('createAvoidLayer', () => {
  it('builds one polygon from the ring', () => {
    const ring = [
      { lon: 120.6, lat: 15.15 },
      { lon: 120.61, lat: 15.15 },
      { lon: 120.61, lat: 15.16 },
      { lon: 120.6, lat: 15.15 },
    ];
    const layer = createAvoidLayer(ring);
    const features = layer.getSource()?.getFeatures() ?? [];
    expect(features).toHaveLength(1);
    expect(features[0].getGeometry()?.getType()).toBe('Polygon');
  });
});
