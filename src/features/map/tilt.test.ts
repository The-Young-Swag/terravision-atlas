import { describe, expect, it } from 'vitest';
import { TILT_MAX_DEGREES, clampTiltDegrees } from './tilt';

describe('clampTiltDegrees', () => {
  it('passes through in-range values unchanged', () => {
    expect(clampTiltDegrees(0)).toBe(0);
    expect(clampTiltDegrees(45)).toBe(45);
    expect(clampTiltDegrees(TILT_MAX_DEGREES)).toBe(TILT_MAX_DEGREES);
  });

  it('clamps below zero and above the max', () => {
    expect(clampTiltDegrees(-10)).toBe(0);
    expect(clampTiltDegrees(TILT_MAX_DEGREES + 5)).toBe(TILT_MAX_DEGREES);
  });
});
