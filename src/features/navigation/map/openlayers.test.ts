import { describe, expect, it } from 'vitest';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { Stroke } from 'ol/style';
import { createRouteLayer, createAvoidLayer } from './openlayers';
import { ROUTE_LINE_COLOR, ROUTE_CASING_COLOR } from '../../../features/map';

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
  it('builds core line (always blue), casing (white when no traffic), and endpoint markers from the path', () => {
    const layer = createRouteLayer(route);
    const features = layer.getSource()?.getFeatures() ?? [];
    // core line + 1 casing + 2 endpoint markers = 4 features
    expect(features).toHaveLength(4);
    const lines = features.filter((f) => f.getGeometry() instanceof LineString);
    // 1 core line + 1 casing = 2 LineString features
    expect(lines).toHaveLength(2);
    const points = features.filter((f) => f.getGeometry() instanceof Point);
    // 2 endpoint markers = 2 Point features
    expect(points).toHaveLength(2);
    // Core line is always brand blue
    const coreLine = lines.find((f) => {
      const style = f.getStyle() as { getStroke(): Stroke };
      const color = style.getStroke().getColor();
      return color === ROUTE_LINE_COLOR;
    });
    expect(coreLine).toBeTruthy();
    // Casing is white when no traffic
    const casing = lines.find((f) => {
      const style = f.getStyle() as { getStroke(): Stroke };
      const color = style.getStroke().getColor();
      return color === ROUTE_CASING_COLOR;
    });
    expect(casing).toBeTruthy();
  });

  it('colors the casing by traffic status when flow samples provided', () => {
    const samples = [
      { pathIndex: 0, currentSpeed: 20, freeFlowSpeed: 80 },
      { pathIndex: 2, currentSpeed: 60, freeFlowSpeed: 80 },
    ];
    const layer = createRouteLayer(route, samples);
    const features = layer.getSource()?.getFeatures() ?? [];
    const lines = features.filter((f) => f.getGeometry() instanceof LineString);
    // Core line + potentially multiple casing segments = at least 2
    expect(lines.length).toBeGreaterThanOrEqual(2);
    // Core line is always brand blue
    const coreLine = lines.find((f) => {
      const style = f.getStyle() as { getStroke(): Stroke };
      const color = style.getStroke().getColor();
      return color === ROUTE_LINE_COLOR;
    });
    expect(coreLine).toBeTruthy();
    // At least one casing segment should be traffic-colored (not white)
    const trafficCasing = lines.find((f) => {
      const style = f.getStyle() as { getStroke(): Stroke };
      const color = style.getStroke().getColor();
      return color !== ROUTE_LINE_COLOR && color !== ROUTE_CASING_COLOR;
    });
    expect(trafficCasing).toBeTruthy();
  });

  it('uses the unified blue line color regardless of the avoid verdict', () => {
    for (const avoidsArea of [true, false]) {
      const layer = createRouteLayer({ ...route, avoidsArea });
      const lines = (layer.getSource()?.getFeatures() ?? []).filter((f) => f.getGeometry() instanceof LineString);
      const coreLine = lines.find((f) => {
        const style = f.getStyle() as { getStroke(): Stroke };
        return style.getStroke().getColor() === ROUTE_LINE_COLOR;
      });
      expect(coreLine).toBeTruthy();
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