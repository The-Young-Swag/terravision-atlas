import {
  SEA_LEVEL_Y,
  buildChunkNbt,
  buildChunkSections,
  buildLevelDat,
  compressChunkPayload,
  writeRegionFile,
  type RegionChunkInput,
} from './anvil';
import { REGION_BLOCKS, sampleTerrain } from './terrain';

// Single-region export: region r.0.0.mca holds chunks (0..31, 0..31), i.e. a
// 512x512-block area centered on the map. One region only — writing a larger
// selected area as many regions is future work, and the UI states exactly
// what is exported rather than implying more.

export interface MinecraftExportResult {
  regionBytes: Uint8Array;
  levelDatBytes: Uint8Array;
  minHeight: number;
  maxHeight: number;
  chunkCount: number;
  spawnY: number;
}

/** Nearest above-sea-level column to the region center, so spawn is on land. */
function findSpawn(heights: Int16Array): { x: number; y: number; z: number } {
  const center = (REGION_BLOCKS - 1) / 2;
  for (let radius = 0; radius < REGION_BLOCKS / 2; radius++) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const bx = Math.round(center + dx);
        const bz = Math.round(center + dz);
        const h = heights[bz * REGION_BLOCKS + bx];
        if (h > SEA_LEVEL_Y) return { x: bx, y: h + 1, z: bz };
      }
    }
  }
  return { x: 256, y: SEA_LEVEL_Y + 1, z: 256 };
}

export async function exportMinecraftRegion(
  centerLon: number,
  centerLat: number,
  onProgress?: (stage: string) => void,
): Promise<MinecraftExportResult> {
  onProgress?.('Sampling real elevation…');
  const { heights, minHeight, maxHeight } = await sampleTerrain(centerLon, centerLat);

  const chunks: RegionChunkInput[] = [];
  for (let cz = 0; cz < 32; cz++) {
    for (let cx = 0; cx < 32; cx++) {
      const column = new Int16Array(256);
      for (let lz = 0; lz < 16; lz++) {
        for (let lx = 0; lx < 16; lx++) {
          column[lz * 16 + lx] = heights[(cz * 16 + lz) * REGION_BLOCKS + cx * 16 + lx];
        }
      }
      const sections = buildChunkSections(column);
      chunks.push({ chunkX: cx, chunkZ: cz, compressedNbt: compressChunkPayload(buildChunkNbt(cx, cz, sections)) });
    }
    // Keep the UI responsive during the ~100M block assignments.
    onProgress?.(`Building chunks… ${chunks.length}/1024`);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  onProgress?.('Writing region file…');
  const regionBytes = writeRegionFile(chunks, Math.floor(Date.now() / 1000));

  const spawn = findSpawn(heights);
  const levelDatBytes = buildLevelDat({ worldName: 'TerraVision Export', spawnX: spawn.x, spawnY: spawn.y, spawnZ: spawn.z });

  return { regionBytes, levelDatBytes, minHeight, maxHeight, chunkCount: chunks.length, spawnY: spawn.y };
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime: string): void {
  // Copy into a fresh ArrayBuffer: pako's output can view a shared buffer,
  // which the Blob constructor's types reject.
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
