// NTv2 Grid Parser — minimal implementation for datum shift grids (.gsb)
// Based on NTv2 spec: header (11*16 bytes) + subgrids, each with 4*4 header + data
// For TerraVision, we implement a client-side parser that can load a grid file via fetch
// and apply bilinear interpolation for sub-centimeter accurate shifts.
// Full spec: https://web.archive.org/web/20140125020422/http://www.mnhn.fr/mnhn/geo/NTv2.pdf

export interface NTv2Header {
  numSubGrids: number;
  numSubGridsBytes: number;
}

export interface NTv2SubGridHeader {
  name: string;
  parent: string;
  lowerLatitude: number;
  upperLatitude: number;
  lowerLongitude: number;
  upperLongitude: number;
  latitudeInterval: number;
  longitudeInterval: number;
  gridNodeCount: number;
}

export interface NTv2Grid {
  header: NTv2Header;
  subGrids: Array<{
    header: NTv2SubGridHeader;
    latitudeShifts: Float64Array;
    longitudeShifts: Float64Array;
    latitudeAccuracies: Float64Array;
    longitudeAccuracies: Float64Array;
  }>;
}

// Parse an NTv2 .gsb file from an ArrayBuffer
// Returns a grid object with subgrids and shift arrays
export function parseNTv2(buffer: ArrayBuffer): NTv2Grid {
  const view = new DataView(buffer);

  // Header: 11 records * 16 bytes (each record is 8+8 or 16)
  // For simplicity, we read the overview header
  const numSubGrids = view.getInt32(8, false); // big-endian
  const header: NTv2Header = {
    numSubGrids,
    numSubGridsBytes: view.getInt32(24, false),
  };

  let offset = 11 * 16; // skip overview header

  const subGrids: NTv2Grid['subGrids'] = [];

  for (let i = 0; i < numSubGrids; i++) {
    // Subgrid header: 11 * 16 bytes
    const subGridName = String.fromCharCode(...new Uint8Array(buffer, offset, 8)).trim();
    const parentName = String.fromCharCode(...new Uint8Array(buffer, offset + 16, 8)).trim();
    const lowerLatitude = view.getFloat64(offset + 24, false) * (180 / Math.PI); // radians to degrees
    const upperLatitude = view.getFloat64(offset + 40, false) * (180 / Math.PI);
    const lowerLongitude = view.getFloat64(offset + 56, false) * (180 / Math.PI);
    const upperLongitude = view.getFloat64(offset + 72, false) * (180 / Math.PI);
    const latitudeInterval = view.getFloat64(offset + 88, false) * (180 / Math.PI);
    const longitudeInterval = view.getFloat64(offset + 104, false) * (180 / Math.PI);
    const gridNodeCount = view.getInt32(offset + 136, false);

    const subHeader: NTv2SubGridHeader = {
      name: subGridName,
      parent: parentName,
      lowerLatitude,
      upperLatitude,
      lowerLongitude,
      upperLongitude,
      latitudeInterval,
      longitudeInterval,
      gridNodeCount,
    };

    offset += 11 * 16;

    // Data: 4 * gridNodeCount * 8 bytes? Actually each node has 4 float64: lat shift, lon shift, lat acc, lon acc
    const latitudeShifts = new Float64Array(gridNodeCount);
    const longitudeShifts = new Float64Array(gridNodeCount);
    const latitudeAccuracies = new Float64Array(gridNodeCount);
    const longitudeAccuracies = new Float64Array(gridNodeCount);

    for (let j = 0; j < gridNodeCount; j++) {
      // Each shift is in radians, stored as float64 big-endian
      const latShiftRad = view.getFloat64(offset, false);
      const lonShiftRad = view.getFloat64(offset + 8, false);
      const latAcc = view.getFloat64(offset + 16, false);
      const lonAcc = view.getFloat64(offset + 24, false);

      // Convert shifts from radians to degrees, then to arc-seconds, then to degrees again
      // 1 radian = 180/π degrees
      latitudeShifts[j] = latShiftRad * (180 / Math.PI);
      longitudeShifts[j] = lonShiftRad * (180 / Math.PI);
      latitudeAccuracies[j] = latAcc;
      longitudeAccuracies[j] = lonAcc;

      offset += 4 * 8;
    }

    subGrids.push({
      header: subHeader,
      latitudeShifts,
      longitudeShifts,
      latitudeAccuracies,
      longitudeAccuracies,
    });
  }

  return { header, subGrids };
}

// Bilinear interpolation for a given lat/lon within a subgrid
export function interpolateShift(
  grid: NTv2Grid['subGrids'][0],
  latitude: number,
  longitude: number,
): { dLat: number; dLon: number } | null {
  const h = grid.header;

  // Check bounds
  if (
    latitude < h.lowerLatitude ||
    latitude > h.upperLatitude ||
    longitude < h.lowerLongitude ||
    longitude > h.upperLongitude
  ) {
    return null;
  }

  const latIndex = (latitude - h.lowerLatitude) / h.latitudeInterval;
  const lonIndex = (longitude - h.lowerLongitude) / h.longitudeInterval;

  const lat0 = Math.floor(latIndex);
  const lon0 = Math.floor(lonIndex);
  const lat1 = lat0 + 1;
  const lon1 = lon0 + 1;

  const latFrac = latIndex - lat0;
  const lonFrac = lonIndex - lon0;

  const cols = Math.round((h.upperLongitude - h.lowerLongitude) / h.longitudeInterval) + 1;

  const idx = (row: number, col: number) => row * cols + col;

  const maxRow = Math.round((h.upperLatitude - h.lowerLatitude) / h.latitudeInterval);
  const maxCol = cols - 1;

  if (lat0 < 0 || lon0 < 0 || lat1 > maxRow || lon1 > maxCol) return null;

  const i00 = idx(lat0, lon0);
  const i10 = idx(lat1, lon0);
  const i01 = idx(lat0, lon1);
  const i11 = idx(lat1, lon1);

  const latShift =
    (1 - latFrac) * (1 - lonFrac) * grid.latitudeShifts[i00] +
    latFrac * (1 - lonFrac) * grid.latitudeShifts[i10] +
    (1 - latFrac) * lonFrac * grid.latitudeShifts[i01] +
    latFrac * lonFrac * grid.latitudeShifts[i11];

  const lonShift =
    (1 - latFrac) * (1 - lonFrac) * grid.longitudeShifts[i00] +
    latFrac * (1 - lonFrac) * grid.longitudeShifts[i10] +
    (1 - latFrac) * lonFrac * grid.longitudeShifts[i01] +
    latFrac * lonFrac * grid.longitudeShifts[i11];

  return { dLat: latShift / 3600, dLon: lonShift / 3600 }; // arc-seconds to degrees
}

// Apply NTv2 shift to a WGS84 coordinate to get target datum (or reverse)
export function applyNTv2Shift(
  grid: NTv2Grid,
  latitude: number,
  longitude: number,
  inverse = false,
): { latitude: number; longitude: number } | null {
  // Use the first subgrid that contains the point (NTv2 may have multiple)
  for (const subGrid of grid.subGrids) {
    const shift = interpolateShift(subGrid as unknown as NTv2Grid['subGrids'][0], latitude, longitude);
    if (shift) {
      const factor = inverse ? -1 : 1;
      return {
        latitude: latitude + shift.dLat * factor,
        longitude: longitude + shift.dLon * factor,
      };
    }
  }
  return null;
}

// Utility to fetch and parse a grid file from public/grids
export async function loadNTv2Grid(url: string): Promise<NTv2Grid> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch NTv2 grid: ${response.status}`);
  const buffer = await response.arrayBuffer();
  return parseNTv2(buffer);
}
