import { describe, expect, it } from 'vitest';
import { buildFirmsUrl, firmsQueryBBox, parseFirmsCsv, firmsRowsToEvents } from './firmsFetcher';

const SAMPLE_CSV = [
  'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti4,frp,daynight',
  '15.145,120.588,320.5,0.4,0.3,2026-09-05,0130,N,VIIRS,h,2.0N,300.1,5.2,D',
  '15.200,120.600,290.1,0.5,0.4,2026-09-05,0130,N,VIIRS,n,2.0N,280.0,1.1,D',
  'bad,row,missing,columns',
].join('\n');

describe('buildFirmsUrl', () => {
  it('uses the MAP_KEY/SOURCE/AREA/DAY_RANGE path shape', () => {
    const url = buildFirmsUrl({ minLon: 118, minLat: 12, maxLon: 123, maxLat: 17 }, 'KEY');
    expect(url).toBe(
      'https://firms.modaps.eosdis.nasa.gov/api/area/csv/KEY/VIIRS_SNPP_NRT/118,12,123,17/1',
    );
  });
});

describe('firmsQueryBBox', () => {
  it('centers a bounded window on the map center', () => {
    expect(firmsQueryBBox(120.5, 15.1)).toEqual({ minLon: 118, minLat: 12.6, maxLon: 123, maxLat: 17.6 });
  });

  it('clamps latitude to valid range', () => {
    expect(firmsQueryBBox(0, 89.5).maxLat).toBe(90);
    expect(firmsQueryBBox(0, -89.5).minLat).toBe(-90);
  });
});

describe('parseFirmsCsv', () => {
  it('parses valid rows and skips malformed ones', () => {
    const rows = parseFirmsCsv(SAMPLE_CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ latitude: 15.145, longitude: 120.588, confidence: 'h' });
  });

  it('returns [] without a header or data rows', () => {
    expect(parseFirmsCsv('')).toEqual([]);
    expect(parseFirmsCsv('latitude,longitude')).toEqual([]);
  });
});

describe('firmsRowsToEvents', () => {
  it('maps confidence to severity without ever assigning high', () => {
    const events = firmsRowsToEvents(parseFirmsCsv(SAMPLE_CSV));
    expect(events).toHaveLength(2);
    expect(events[0].severity).toBe('medium');
    expect(events[1].severity).toBe('low');
    expect(events[0].source).toBe('NASA FIRMS');
    expect(events[0].type).toBe('wildfire');
  });
});
