import { describe, expect, it } from 'vitest';
import { applyNTv2Shift, interpolateShift, ntv2ShiftMeters, type NTv2Grid } from './NTv2Grid';

// Hand-built 2x2 grid over 14–16°N, 120–122°E with a uniform +3.6"/+2.4"
// shift: bilinear interpolation of a constant field must return the
// constant, and meters conversion must scale longitude by cos(latitude).
function uniformGrid(): NTv2Grid {
  const latitudeShifts = new Float64Array([3.6, 3.6, 3.6, 3.6]);
  const longitudeShifts = new Float64Array([2.4, 2.4, 2.4, 2.4]);
  const accuracies = new Float64Array([0.1, 0.1, 0.1, 0.1]);
  return {
    header: { numSubGrids: 1, numSubGridsBytes: 0 },
    subGrids: [
      {
        header: {
          name: 'TEST',
          parent: 'NONE',
          lowerLatitude: 14,
          upperLatitude: 16,
          lowerLongitude: 120,
          upperLongitude: 122,
          latitudeInterval: 2,
          longitudeInterval: 2,
          gridNodeCount: 4,
        },
        latitudeShifts,
        longitudeShifts,
        latitudeAccuracies: accuracies,
        longitudeAccuracies: accuracies,
      },
    ],
  };
}

describe('interpolateShift', () => {
  it('returns the uniform shift at the grid center', () => {
    const shift = interpolateShift(uniformGrid().subGrids[0], 15, 121);
    expect(shift?.dLat).toBeCloseTo(0.001, 6);
    expect(shift?.dLon).toBeCloseTo(2.4 / 3600, 8);
  });

  it('returns null outside coverage', () => {
    expect(interpolateShift(uniformGrid().subGrids[0], 10, 121)).toBeNull();
    expect(interpolateShift(uniformGrid().subGrids[0], 15, 130)).toBeNull();
  });
});

describe('applyNTv2Shift', () => {
  it('adds the shift forward and subtracts it in reverse', () => {
    const forward = applyNTv2Shift(uniformGrid(), 15, 121);
    expect(forward?.latitude).toBeCloseTo(15.001, 6);
    const back = applyNTv2Shift(uniformGrid(), forward!.latitude, forward!.longitude, true);
    expect(back?.latitude).toBeCloseTo(15, 6);
    expect(back?.longitude).toBeCloseTo(121, 6);
  });
});

describe('ntv2ShiftMeters', () => {
  it('converts the shift to meters with longitude scaled by cos(lat)', () => {
    const shift = ntv2ShiftMeters(uniformGrid(), 15, 121);
    expect(shift?.dNorthM).toBeCloseTo(111.32, 1);
    expect(shift?.dEastM).toBeCloseTo(74.213 * Math.cos((15 * Math.PI) / 180), 1);
  });

  it('returns null outside coverage', () => {
    expect(ntv2ShiftMeters(uniformGrid(), 10, 121)).toBeNull();
  });
});
