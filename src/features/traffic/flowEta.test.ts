import { describe, expect, it } from 'vitest';
import { combineSpeedRatios, parseFlowSegment } from './flowEta';

describe('parseFlowSegment', () => {
  it('extracts current and free-flow speeds', () => {
    expect(
      parseFlowSegment({ flowSegmentData: { currentSpeed: 30, freeFlowSpeed: 60 } }),
    ).toEqual({ currentSpeed: 30, freeFlowSpeed: 60 });
  });

  it('returns null for missing or invalid fields', () => {
    expect(parseFlowSegment({})).toBeNull();
    expect(parseFlowSegment({ flowSegmentData: { currentSpeed: 30 } })).toBeNull();
    expect(parseFlowSegment({ flowSegmentData: { currentSpeed: 30, freeFlowSpeed: 0 } })).toBeNull();
    expect(parseFlowSegment({ flowSegmentData: { currentSpeed: -5, freeFlowSpeed: 60 } })).toEqual({
      currentSpeed: 0,
      freeFlowSpeed: 60,
    });
  });
});

describe('combineSpeedRatios', () => {
  it('returns 1 when traffic flows freely', () => {
    expect(combineSpeedRatios([1, 1, 1])).toBe(1);
  });

  it('scales up with the mean slowdown', () => {
    // ratios 0.5 and 1.0 → mean 0.75 → factor 1/0.75
    expect(combineSpeedRatios([0.5, 1])).toBeCloseTo(1.333, 3);
  });

  it('never speeds the trip up and caps runaway slowdowns', () => {
    expect(combineSpeedRatios([1.5, 2])).toBe(1);
    expect(combineSpeedRatios([0.01])).toBe(3);
  });

  it('returns 1 with no samples', () => {
    expect(combineSpeedRatios([])).toBe(1);
  });
});
