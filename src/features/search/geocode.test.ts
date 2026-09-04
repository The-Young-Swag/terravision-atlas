import { describe, expect, it } from 'vitest';
import { parseNominatimResult, parsePhotonSuggestions, parseReverseResult } from './geocode';

describe('parsePhotonSuggestions', () => {
  it('maps features to labeled suggestions, cap five', () => {
    const features = Array.from({ length: 7 }, (_, i) => ({
      geometry: { coordinates: [120 + i * 0.01, 15] as [number, number] },
      properties: { name: `Place ${i}`, city: `City ${i}`, country: 'Philippines' },
    }));
    const suggestions = parsePhotonSuggestions({ features });
    expect(suggestions).toHaveLength(5);
    expect(suggestions[0]).toEqual({ label: 'Place 0', sublabel: 'City 0, Philippines', lon: 120, lat: 15 });
  });

  it('drops features without name or coordinates', () => {
    const suggestions = parsePhotonSuggestions({
      features: [
        { geometry: { coordinates: [120, 15] }, properties: {} },
        { properties: { name: 'Nowhere' } },
        { geometry: { coordinates: [121, 16] }, properties: { name: 'Somewhere', state: 'State' } },
      ],
    });
    expect(suggestions).toEqual([{ label: 'Somewhere', sublabel: 'State', lon: 121, lat: 16 }]);
  });
});

describe('parseNominatimResult', () => {
  it('reads the first result', () => {
    expect(parseNominatimResult([{ lat: '14.5995', lon: '120.9842', display_name: 'Manila, Philippines' }])).toEqual({
      lon: 120.9842,
      lat: 14.5995,
      displayName: 'Manila, Philippines',
    });
    expect(parseNominatimResult([])).toBeNull();
    expect(parseNominatimResult([{ lat: 'x', lon: 'y' }])).toBeNull();
  });
});

describe('parseReverseResult', () => {
  it('reads display names with coordinates', () => {
    expect(parseReverseResult({ display_name: 'Road, City', lat: '15.1', lon: '120.5' })).toEqual({
      lon: 120.5,
      lat: 15.1,
      displayName: 'Road, City',
    });
    expect(parseReverseResult({})).toBeNull();
  });
});
