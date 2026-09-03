import { describe, expect, it } from 'vitest';
import { flowTileUrl, parseIncidents } from './tomtom';

describe('flowTileUrl', () => {
  it('builds a TomTom flow tile template with the key', () => {
    const url = flowTileUrl('test-key');
    expect(url).toContain('api.tomtom.com/traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.png');
    expect(url).toContain('key=test-key');
  });
});

describe('parseIncidents', () => {
  it('reads point incidents with descriptions', () => {
    const incidents = parseIncidents({
      incidents: [
        {
          type: 'Accident',
          geometry: { type: 'Point', coordinates: [120.58, 15.14] },
          properties: { id: 1, iconCategory: 'accident', delay: 300, events: [{ description: 'Closed road' }] },
        },
      ],
    });
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      id: '1',
      lon: 120.58,
      lat: 15.14,
      category: 'accident',
      description: 'Closed road',
      delaySeconds: 300,
    });
  });

  it('centers line and polygon geometries and skips the unusable', () => {
    const incidents = parseIncidents({
      incidents: [
        {
          type: 'Road Works',
          geometry: { type: 'LineString', coordinates: [[120.5, 15.1], [120.6, 15.1]] },
          properties: { iconCategory: 'roadWork' },
        },
        { type: 'Fog', properties: { iconCategory: 'fog' } },
        { type: 'Jam', geometry: { type: 'Point', coordinates: ['x', 15] }, properties: {} },
      ],
    });
    expect(incidents).toHaveLength(1);
    expect(incidents[0].lon).toBeCloseTo(120.55, 3);
    expect(incidents[0].lat).toBeCloseTo(15.1, 3);
  });
});
