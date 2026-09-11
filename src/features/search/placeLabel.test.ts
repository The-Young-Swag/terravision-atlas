import { describe, expect, it } from 'vitest';
import { shortPlaceLabel } from './placeLabel';

describe('shortPlaceLabel', () => {
  it('takes the first comma segment, trimmed', () => {
    expect(shortPlaceLabel('Manila, Metro Manila, Philippines')).toBe('Manila');
    expect(shortPlaceLabel('  Kyoto , Kyoto, Japan ')).toBe('Kyoto');
  });

  it('falls back for missing or blank input', () => {
    expect(shortPlaceLabel(null)).toBe('');
    expect(shortPlaceLabel(undefined)).toBe('');
    expect(shortPlaceLabel('')).toBe('');
    expect(shortPlaceLabel(null, 'Pinned location')).toBe('Pinned location');
    expect(shortPlaceLabel(', foo', 'Pinned location')).toBe('Pinned location');
  });
});
