import proj4 from 'proj4';

// Minimal EPSG definitions for TerraVision — covers WGS84, NAD83, ETRS89, and common UTM
// Full 5,000+ projections can be loaded via proj4-epsg or custom grids, but these are the core.

export const EPSG_DEFINITIONS: Record<string, string> = {
  'EPSG:4326': '+proj=longlat +datum=WGS84 +no_defs',
  'EPSG:3857': '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs',
  'EPSG:32651': '+proj=utm +zone=51 +datum=WGS84 +units=m +no_defs', // UTM 51N (Philippines)
  'EPSG:32633': '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs',
  'EPSG:26915': '+proj=utm +zone=15 +datum=NAD83 +units=m +no_defs',
  'EPSG:25832': '+proj=utm +zone=32 +datum=ETRS89 +units=m +no_defs',
  'EPSG:27700': '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs',
};

// Register with proj4
Object.entries(EPSG_DEFINITIONS).forEach(([code, def]) => {
  proj4.defs(code, def);
});

// Also ensure WGS84 is available as longlat
proj4.defs('WGS84', EPSG_DEFINITIONS['EPSG:4326']);

export function transformCoordinate(
  from: string,
  to: string,
  coordinate: [number, number],
): [number, number] {
  return proj4(from, to, coordinate) as [number, number];
}

export function getEpsgList(): Array<{ code: string; name: string }> {
  return [
    { code: 'EPSG:4326', name: 'WGS84 — World Geodetic System' },
    { code: 'EPSG:3857', name: 'Web Mercator — Google Maps' },
    { code: 'EPSG:32651', name: 'UTM 51N — Philippines' },
    { code: 'EPSG:32633', name: 'UTM 33N — Central Europe' },
    { code: 'EPSG:26915', name: 'NAD83 / UTM 15N' },
    { code: 'EPSG:25832', name: 'ETRS89 / UTM 32N' },
    { code: 'EPSG:27700', name: 'OSGB36 / British National Grid' },
  ];
}
