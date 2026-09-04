// NASA GIBS (Global Imagery Browse Services) satellite imagery.
// Free, keyless, no registration: https://gibs.earthdata.nasa.gov
// WMTS REST endpoint (EPSG:3857, "best available" edition):
//   https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg
//
// Layer identifiers below were verified against GIBS's live
// GetCapabilities response (wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities)
// before wiring: all three advertise TileMatrixSets
// GoogleMapsCompatible_Level7/Level9 (levels 0-9) and image/jpeg.
// Temporal coverage at verification time (daily updates ongoing):
// - MODIS Terra TrueColor: 2000-02-24 → yesterday (daily, ~250m)
// - MODIS Aqua TrueColor:  2002-07-03 → today (daily, ~250m)
// - VIIRS SNPP TrueColor:  2015-11-24 → today (near-real-time, ~3hr lag, ~375m)
// Level 9 is the finest matrix, so tiles overzoom gracefully past zoom 9
// (each engine is configured with a matching max/native zoom).

export type GibsLayerId = 'modis-terra' | 'modis-aqua' | 'viirs-snpp';

/** Satellite source for the "Satellite" basemap slot (Esri preserved). */
export type SatelliteSourceId = 'esri' | GibsLayerId;

export interface GibsLayerMeta {
  id: GibsLayerId;
  /** Human-readable label explaining the timeliness tradeoff. */
  label: string;
  desc: string;
  /** GIBS product identifier (verified against GetCapabilities). */
  product: string;
  attribution: string;
}

export const GIBS_LAYERS: GibsLayerMeta[] = [
  {
    id: 'modis-terra',
    label: 'MODIS Terra (daily)',
    desc: 'True color · ~250m · daily since 2000',
    product: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    attribution: 'Imagery © NASA EOSDIS GIBS (MODIS Terra)',
  },
  {
    id: 'modis-aqua',
    label: 'MODIS Aqua (daily)',
    desc: 'True color · ~250m · daily since 2002',
    product: 'MODIS_Aqua_CorrectedReflectance_TrueColor',
    attribution: 'Imagery © NASA EOSDIS GIBS (MODIS Aqua)',
  },
  {
    id: 'viirs-snpp',
    label: 'VIIRS SNPP (near real-time, ~3hr)',
    desc: 'True color · ~375m · updated within hours',
    product: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    attribution: 'Imagery © NASA EOSDIS GIBS (VIIRS SNPP)',
  },
];

export function gibsLayerMeta(id: GibsLayerId): GibsLayerMeta {
  const meta = GIBS_LAYERS.find((l) => l.id === id);
  if (!meta) throw new Error(`unknown GIBS layer: ${id}`);
  return meta;
}

/** GIBS "best" still requires a TIME in the path — use yesterday (UTC) so
 *  both daily MODIS and near-real-time VIIRS granules exist for the date. */
export function gibsBestDate(now: Date = new Date()): string {
  const yesterday = new Date(now.getTime() - 86400000);
  return yesterday.toISOString().slice(0, 10);
}

/** WMTS REST template. Engines substitute {x}=col {y}=row {z}=zoom. */
export function gibsTileUrlTemplate(product: string, date: string): string {
  return (
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${product}` +
    `/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
  );
}

export const GIBS_MAX_ZOOM = 9;

export const ESRI_ATTRIBUTION = 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics';

export function satelliteAttribution(source: SatelliteSourceId): string {
  if (source === 'esri') return ESRI_ATTRIBUTION;
  return gibsLayerMeta(source).attribution;
}
