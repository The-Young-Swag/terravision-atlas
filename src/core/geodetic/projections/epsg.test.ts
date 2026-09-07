import { describe, expect, it } from 'vitest';
import { datumShiftMeters } from './epsg';

// Validation point: Malcampa, Camiling, Tarlac (~15.68°N, 120.41°E).
// No local reference survey is bundled, so these tests assert internal
// consistency plus a plausible magnitude band for the EPSG-published
// PRS92 7-parameter shift (tens of meters in Luzon — a zero shift or a
// kilometer-scale jump would both prove the towgs84 path is broken).
const MALCAMPA: [number, number] = [120.4123, 15.6812];

describe('datumShiftMeters (WGS84 <-> PRS92)', () => {
  it('produces a plausible non-zero offset at Malcampa', () => {
    const shift = datumShiftMeters('EPSG:4326', 'EPSG:4682', MALCAMPA);
    const magnitudeM = Math.hypot(shift.dNorthM, shift.dEastM);
    expect(magnitudeM).toBeGreaterThan(10);
    expect(magnitudeM).toBeLessThan(500);
  });

  it('round-trips back to the starting position', () => {
    const forward = datumShiftMeters('EPSG:4326', 'EPSG:4682', MALCAMPA);
    const back = datumShiftMeters('EPSG:4682', 'EPSG:4326', forward.shifted);
    expect(back.shifted[0]).toBeCloseTo(MALCAMPA[0], 6);
    expect(back.shifted[1]).toBeCloseTo(MALCAMPA[1], 6);
  });

  it('throws rather than fabricating a shift for unknown codes', () => {
    expect(() => datumShiftMeters('EPSG:4326', 'EPSG:99999', MALCAMPA)).toThrow();
  });
});
