import { describe, expect, it } from 'vitest';
import { temperatureColorFor } from './temperatureScale';

describe('temperatureColorFor', () => {
  it.each([
    [-5, '#E6F7FF'],
    [0, '#E6F7FF'],
    [13.9, '#E6F7FF'],
    [14, '#4BB6E6'],
    [15.5, '#4BB6E6'],
    [17, '#4BB6E6'],
    [18, '#B9E7FF'],
    [22, '#B9E7FF'],
    [26, '#B9E7FF'],
    [27, '#FFD600'],
    [29.9, '#FFD600'],
    [30, '#FFD600'],
    [31, '#FFAE00'],
    [33, '#FFAE00'],
    [35, '#FFAE00'],
    [36, '#FF3B30'],
    [42, '#FF3B30'],
  ])('maps %p°C to %p with no gaps or overlaps', (celsius, expected) => {
    expect(temperatureColorFor(celsius)).toBe(expected);
  });

  it('falls back for missing values so gaps never render a fake band', () => {
    expect(temperatureColorFor(null)).toBe('#FF9F1C');
    expect(temperatureColorFor(undefined)).toBe('#FF9F1C');
    expect(temperatureColorFor(NaN)).toBe('#FF9F1C');
  });
});
