import { describe, expect, it } from 'vitest';
import { endpointLabel, parseRouteQuery } from './routeQuery';

describe('parseRouteQuery', () => {
  it('recognizes place-to-place forms without hijacking normal search', () => {
    const route = parseRouteQuery('Manila to Tarlac');
    expect(route).toEqual({
      kind: 'route',
      origin: { kind: 'place', text: 'Manila' },
      destination: { kind: 'place', text: 'Tarlac' },
    });
    expect(parseRouteQuery('From Quezon City to Makati')).toMatchObject({ kind: 'route' });
    expect(parseRouteQuery('Manila → Tarlac')).toMatchObject({ kind: 'route' });
    expect(parseRouteQuery('Manila -> Tarlac')).toMatchObject({ kind: 'route' });
    expect(parseRouteQuery('Manila - Tarlac')).toMatchObject({ kind: 'route' });
    // Ordinary searches are untouched.
    expect(parseRouteQuery('Tarlac')).toEqual({ kind: 'not-route' });
    expect(parseRouteQuery('Manila Cathedral')).toEqual({ kind: 'not-route' });
    // Hyphenated names without spaces are not routes.
    expect(parseRouteQuery('San-Jose')).toEqual({ kind: 'not-route' });
  });

  it('recognizes current-location endpoints on either side', () => {
    expect(parseRouteQuery('Here to Tarlac')).toEqual({
      kind: 'route',
      origin: { kind: 'here' },
      destination: { kind: 'place', text: 'Tarlac' },
    });
    expect(parseRouteQuery('Tarlac to here')).toMatchObject({
      kind: 'route',
      destination: { kind: 'here' },
    });
    expect(parseRouteQuery('Tarlac to my location')).toMatchObject({
      kind: 'route',
      destination: { kind: 'here' },
    });
    expect(endpointLabel({ kind: 'here' })).toBe('My location (GPS)');
  });

  it('stays understandable on partial queries', () => {
    expect(parseRouteQuery('Manila to')).toEqual({ kind: 'partial', originText: 'Manila' });
    expect(parseRouteQuery('Here to')).toEqual({ kind: 'partial', originText: 'Here' });
    expect(parseRouteQuery('to')).toEqual({ kind: 'not-route' });
  });

  it('flags waypoints as unsupported instead of trimming them', () => {
    expect(parseRouteQuery('Manila to Tarlac to Baguio')).toMatchObject({ kind: 'unsupported' });
    expect(parseRouteQuery('Manila via Tarlac')).toMatchObject({ kind: 'unsupported' });
  });
});
