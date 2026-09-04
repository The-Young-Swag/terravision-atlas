import { describe, expect, it } from 'vitest';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { createRouteLayer } from './routeLayer';
import { createAvoidLayer } from './avoidLayer';

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
  it('builds casing, line, and endpoint markers from the path', () => {
    const layer = createRouteLayer(route);
    const features = layer.getSource()?.getFeatures() ?? [];
    expect(features).toHaveLength(4);
    const lines = features.filter((f) => f.getGeometry() instanceof LineString);
    expect(lines).toHaveLength(2);
    expect((lines[0].getGeometry() as LineString).getCoordinates()).toHaveLength(3);
    const points = features.filter((f) => f.getGeometry() instanceof Point);
    expect(points).toHaveLength(2);
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
