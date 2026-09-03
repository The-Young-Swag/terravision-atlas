import nbt from 'prismarine-nbt';
import { deflate, gzip } from 'pako';
import { Buffer } from 'buffer';

// Java Edition world writer: single Anvil region file (r.0.0.mca) plus a
// level.dat, built entirely client-side. NBT tag encoding comes from
// prismarine-nbt; the Anvil container (8KB header, zlib chunks, 4KB sector
// alignment) is implemented here because prismarine-nbt only handles tags.
//
// Format references (minecraft.wiki, verified September 2026):
// - Chunk layout: post-1.18 form — root { DataVersion, xPos, zPos, yPos,
//   Status: 'minecraft:full', sections[], block_entities[] }. The Status
//   value MUST be namespaced; anything else marks the chunk a proto-chunk.
// - Target DataVersion 3953 = Java 1.21. Newer clients upgrade on load;
//   older clients refuse worlds saved by newer versions, hence not the latest.
// - Sections Y -4..19 cover the default overworld height (-64..319).
// - Single-entry palettes omit the data array; multi-entry block palettes
//   use 4 bits per block (256 longs per section).
// - Heightmaps and per-section lighting are deliberately OMITTED: absent
//   heightmaps are recomputed lazily by the game and absent light data
//   triggers a relight on first load, while wrong values would silently
//   corrupt spawn placement and lighting. Omission is the robust choice.

// prismarine-nbt is Node-first and allocates Buffers while serializing.
// Point the global at the standard browser polyfill once, here, so neither
// this module nor the library needs Buffer passed around.
if ((globalThis as Record<string, unknown>).Buffer === undefined) {
  (globalThis as Record<string, unknown>).Buffer = Buffer;
}

export const MINECRAFT_DATA_VERSION = 3953; // Java Edition 1.21
export const MINECRAFT_VERSION_NAME = '1.21';
export const REGION_CHUNK_COUNT = 32; // region file holds 32x32 chunks
export const BLOCKS_PER_CHUNK = 16;
export const WORLD_MIN_Y = -64;
export const SECTION_MIN_Y = -4; // section index of WORLD_MIN_Y
export const SECTION_COUNT = 24; // sections -4..19 cover -64..319
export const SEA_LEVEL_Y = 62; // water fills terrain below this height
const COMPRESSION_ZLIB = 2; // Anvil chunk compression type for zlib
const SECTOR_BYTES = 4096;
const HEADER_SECTORS = 2; // 4KB offsets table + 4KB timestamps table

const AIR = 'minecraft:air';
const BEDROCK = 'minecraft:bedrock';
const STONE = 'minecraft:stone';
const DIRT = 'minecraft:dirt';
const GRASS_BLOCK = 'minecraft:grass_block';
const SAND = 'minecraft:sand';
const WATER = 'minecraft:water';
const PLAINS = 'minecraft:plains';

type NbtTag = { type: string; value: unknown; name?: string };

const tagByte = (value: number): NbtTag => nbt.byte(value) as unknown as NbtTag;
const tagInt = (value: number): NbtTag => nbt.int(value) as unknown as NbtTag;
const tagLong = (value: [number, number]): NbtTag => nbt.long(value) as unknown as NbtTag;
const tagString = (value: string): NbtTag => nbt.string(value) as unknown as NbtTag;
const tagDouble = (value: number): NbtTag => nbt.double(value) as unknown as NbtTag;
const tagCompound = (value: Record<string, NbtTag>): NbtTag => nbt.comp(value) as unknown as NbtTag;
const tagLongArray = (value: bigint[]): NbtTag => nbt.longArray(value) as unknown as NbtTag;

// prismarine-nbt quirk: a list of compounds takes an array of bare field
// maps, NOT an array of full {type,value} tags (full tags silently encode
// as empty compounds). Scalar/array lists take raw values as usual.
type CompoundFields = Record<string, NbtTag>;
const tagCompoundList = (items: CompoundFields[]): NbtTag => ({
  type: 'list',
  value: { type: 'compound', value: items },
});
const emptyCompoundList = (): NbtTag => tagCompoundList([]);

function encodeNbt(rootValue: Record<string, NbtTag>): Uint8Array {
  const root = { type: 'compound', name: '', value: rootValue };
  const buffer = nbt.writeUncompressed(root as never);
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/** Pack 4-bits-per-block section data: 4096 indices into 256 longs. */
function packSectionData(indices: Uint8Array): bigint[] {
  const words: bigint[] = new Array<bigint>(256).fill(0n);
  for (let i = 0; i < 4096; i++) {
    const wordIndex = (i / 16) | 0;
    const shift = BigInt((i % 16) * 4);
    words[wordIndex] |= BigInt(indices[i]) << shift;
  }
  return words;
}

interface SectionNbt {
  palette: string[];
  indices: Uint8Array; // palette index per block in YZX order
}

function sectionToNbt(sectionY: number, section: SectionNbt): CompoundFields {
  const palette = section.palette.map((name) => ({ Name: tagString(name) }));
  const blockStates: Record<string, NbtTag> = { palette: tagCompoundList(palette) };
  if (section.palette.length > 1) {
    blockStates.data = tagLongArray(packSectionData(section.indices));
  }
  return {
    Y: tagByte(sectionY),
    block_states: tagCompound(blockStates),
    biomes: tagCompound({ palette: tagCompoundList([{ Name: tagString(PLAINS) }]) }),
  };
}

function chunkIndex(localX: number, localY: number, localZ: number): number {
  return localY * 256 + localZ * 16 + localX;
}

export function buildChunkNbt(chunkX: number, chunkZ: number, sections: SectionNbt[]): Uint8Array {
  return encodeNbt({
    DataVersion: tagInt(MINECRAFT_DATA_VERSION),
    xPos: tagInt(chunkX),
    zPos: tagInt(chunkZ),
    yPos: tagInt(SECTION_MIN_Y),
    Status: tagString('minecraft:full'),
    LastUpdate: tagLong([0, 0]),
    InhabitedTime: tagLong([0, 0]),
    sections: tagCompoundList(sections.map((section, i) => sectionToNbt(SECTION_MIN_Y + i, section))),
    block_entities: emptyCompoundList(),
    block_ticks: emptyCompoundList(),
    fluid_ticks: emptyCompoundList(),
  });
}

/**
 * Fill one chunk's 24 sections from a 16x16 surface-height grid.
 * heights[lz * 16 + lx] is the top solid block Y for that column.
 */
export function buildChunkSections(heights: Int16Array): SectionNbt[] {
  const sections: SectionNbt[] = [];
  for (let s = 0; s < SECTION_COUNT; s++) {
    sections.push({ palette: [], indices: new Uint8Array(4096) });
  }

  const blockAt = (x: number, y: number, z: number, heightsRow: Int16Array): string => {
    if (y === WORLD_MIN_Y) return BEDROCK;
    const h = heightsRow[z * 16 + x];
    if (y > h) {
      if (h < SEA_LEVEL_Y && y <= SEA_LEVEL_Y) return WATER;
      return AIR;
    }
    if (y === h) {
      if (h > SEA_LEVEL_Y) return GRASS_BLOCK;
      if (h >= SEA_LEVEL_Y - 4) return SAND;
      return DIRT;
    }
    if (y > h - 4) return DIRT;
    return STONE;
  };

  for (let sectionIndex = 0; sectionIndex < SECTION_COUNT; sectionIndex++) {
    const section = sections[sectionIndex];
    const baseY = WORLD_MIN_Y + sectionIndex * 16;
    const localPalette = new Map<string, number>();
    const localNames: string[] = [];
    for (let y = 0; y < 16; y++) {
      for (let z = 0; z < 16; z++) {
        for (let x = 0; x < 16; x++) {
          const name = blockAt(x, baseY + y, z, heights);
          let paletteId = localPalette.get(name);
          if (paletteId === undefined) {
            paletteId = localNames.length;
            localNames.push(name);
            localPalette.set(name, paletteId);
          }
          section.indices[chunkIndex(x, y, z)] = paletteId;
        }
      }
    }
    section.palette = localNames;
  }
  return sections;
}

/** Compress one chunk's NBT payload the way the Anvil format stores it. */
export function compressChunkPayload(nbtBytes: Uint8Array): Uint8Array {
  return deflate(nbtBytes);
}

export interface RegionChunkInput {
  chunkX: number; // absolute chunk coords; region (0,0) holds 0..31
  chunkZ: number;
  compressedNbt: Uint8Array; // zlib-compressed chunk NBT
}

interface PlacedChunk extends RegionChunkInput {
  sector: number;
  sectorCount: number;
}

/**
 * Assemble a complete .mca region file: 8KB header (chunk offsets, then
 * chunk timestamps), then each chunk as [u32 length][0x02 zlib][deflate
 * bytes], each padded out to whole 4KB sectors.
 */
export function writeRegionFile(chunks: RegionChunkInput[], timestampSeconds: number): Uint8Array {
  const sorted = [...chunks].sort((a, b) => a.chunkZ - b.chunkZ || a.chunkX - b.chunkX);
  let nextSector = HEADER_SECTORS;
  const placed: PlacedChunk[] = sorted.map((chunk) => {
    const payloadBytes = chunk.compressedNbt.length + 5;
    const sectorCount = Math.ceil(payloadBytes / SECTOR_BYTES);
    const placedChunk = { ...chunk, sector: nextSector, sectorCount };
    nextSector += sectorCount;
    return placedChunk;
  });

  const totalBytes = nextSector * SECTOR_BYTES;
  const out = new Uint8Array(totalBytes);
  const view = new DataView(out.buffer);
  for (const chunk of placed) {
    const tableIndex = (chunk.chunkX % REGION_CHUNK_COUNT) + (chunk.chunkZ % REGION_CHUNK_COUNT) * REGION_CHUNK_COUNT;
    view.setUint32(tableIndex * 4, (chunk.sector << 8) | chunk.sectorCount);
    view.setUint32(SECTOR_BYTES + tableIndex * 4, timestampSeconds);
    const offset = chunk.sector * SECTOR_BYTES;
    view.setUint32(offset, chunk.compressedNbt.length + 1);
    out[offset + 4] = COMPRESSION_ZLIB;
    out.set(chunk.compressedNbt, offset + 5);
  }
  return out;
}

/** Build one region's chunks from a 512x512 surface-height grid. */
export function buildRegionChunks(heights: Int16Array): RegionChunkInput[] {
  const chunks: RegionChunkInput[] = [];
  for (let cz = 0; cz < REGION_CHUNK_COUNT; cz++) {
    for (let cx = 0; cx < REGION_CHUNK_COUNT; cx++) {
      const column = new Int16Array(256);
      for (let lz = 0; lz < 16; lz++) {
        for (let lx = 0; lx < 16; lx++) {
          column[lz * 16 + lx] = heights[(cz * 16 + lz) * 512 + cx * 16 + lx];
        }
      }
      const sections = buildChunkSections(column);
      const compressedNbt = compressChunkPayload(buildChunkNbt(cx, cz, sections));
      chunks.push({ chunkX: cx, chunkZ: cz, compressedNbt });
    }
  }
  return chunks;
}

export interface LevelDatOptions {
  worldName: string;
  spawnX: number;
  spawnY: number;
  spawnZ: number;
}

/** Minimal level.dat: the game fills every absent field with its default. */
export function buildLevelDat({ worldName, spawnX, spawnY, spawnZ }: LevelDatOptions): Uint8Array {
  const root = {
    Data: tagCompound({
      DataVersion: tagInt(MINECRAFT_DATA_VERSION),
      Version: tagCompound({
        Id: tagInt(MINECRAFT_DATA_VERSION),
        Name: tagString(MINECRAFT_VERSION_NAME),
        Snapshot: tagByte(0),
      }),
      LevelName: tagString(worldName),
      GameType: tagInt(0),
      Difficulty: tagByte(2),
      allowCommands: tagByte(0),
      SpawnX: tagInt(spawnX),
      SpawnY: tagInt(spawnY),
      SpawnZ: tagInt(spawnZ),
      Time: tagLong([0, 0]),
      DayTime: tagLong([0, 0]),
      raining: tagByte(0),
      thundering: tagByte(0),
      GameRules: tagCompound({}),
      WorldBorderCenterX: tagDouble(0),
      WorldBorderCenterZ: tagDouble(0),
      WorldBorderSize: tagDouble(59999968),
    }),
  };
  return gzip(encodeNbt(root));
}
