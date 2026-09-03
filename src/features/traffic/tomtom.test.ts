import { describe, expect, it } from 'vitest';
import { delaySeverityLabel, flowTileUrl, incidentCategoryLabel, parseIncidents } from './tomtom';

describe('flowTileUrl', () => {
  it('builds a TomTom flow tile template with the key', () => {
    const url = flowTileUrl('test-key');
    expect(url).toContain('api.tomtom.com/traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.png');
    expect(url).toContain('key=test-key');
  });
});

describe('incident labels', () => {
  it('maps documented icon and delay codes, falling back honestly', () => {
    expect(incidentCategoryLabel(6, 'Jam')).toBe('Jam');
    expect(incidentCategoryLabel(1, 'Accident')).toBe('Accident');
    expect(incidentCategoryLabel(99, 'Weird')).toBe('Weird');
    expect(incidentCategoryLabel(undefined, undefined)).toBe('Incident');
    expect(delaySeverityLabel(2)).toBe('Moderate delay');
    expect(delaySeverityLabel(undefined)).toBeNull();
    expect(delaySeverityLabel(99)).toBeNull();
  });
});

describe('parseIncidents', () => {
  it('reads point incidents with descriptions', () => {
    const incidents = parseIncidents({
      incidents: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [120.58, 15.14] },
          properties: {
            id: 1,
            iconCategory: 8,
            magnitudeOfDelay: 4,
            delay: 0,
            events: [{ description: 'Closed road' }],
            from: 'A',
            to: 'B',
            length: 238.5,
            startTime: '2026-09-03T11:12:30Z',
            endTime: '2026-09-03T11:50:30Z',
          },
        },
      ],
    });
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      id: '1',
      lon: 120.58,
      lat: 15.14,
      category: 'Road closed',
      description: 'Closed road',
      delaySeconds: 0,
      severity: 'Indefinite delay',
      from: 'A',
      to: 'B',
      lengthMeters: 238.5,
      startTime: '2026-09-03T11:12:30Z',
      endTime: '2026-09-03T11:50:30Z',
    });
  });

  it('centers line and polygon geometries and skips the unusable', () => {
    const incidents = parseIncidents({
      incidents: [
        {
          type: 'Road Works',
          geometry: { type: 'LineString', coordinates: [[120.5, 15.1], [120.6, 15.1]] },
          properties: { iconCategory: 9 },
        },
        { type: 'Fog', properties: { iconCategory: 2 } },
        { type: 'Jam', geometry: { type: 'Point', coordinates: ['x', 15] }, properties: {} },
      ],
    });
    expect(incidents).toHaveLength(1);
    expect(incidents[0].lon).toBeCloseTo(120.55, 3);
    expect(incidents[0].lat).toBeCloseTo(15.1, 3);
    expect(incidents[0].category).toBe('Road works');
  });
});
