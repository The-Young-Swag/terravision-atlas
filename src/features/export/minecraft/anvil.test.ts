import { describe, expect, it } from 'vitest';
import nbt from 'prismarine-nbt';
import { inflate, ungzip } from 'pako';
import {
  MINECRAFT_DATA_VERSION,
  SECTION_COUNT,
  buildChunkNbt,
  buildChunkSections,
  buildLevelDat,
  buildRegionChunks,
  writeRegionFile,
} from './anvil';
import { blockLonLat, latToTileY, lonToTileX, tileXToLon, tileYToLat } from './terrain';

function flatHeights(height: number): Int16Array {
  return new Int16Array(256).fill(height);
}

function parseChunkNbt(bytes: Uint8Array): Record<string, never> {
  const parsed = nbt.parseUncompressed(Buffer.from(bytes));
  return nbt.simplify(parsed) as Record<string, never>;
}

describe('buildChunkSections', () => {
  it('produces 24 sections with bedrock at the bottom and grass on top', () => {
    const sections = buildChunkSections(flatHeights(70));
    expect(sections).toHaveLength(SECTION_COUNT);
    const bottom = sections[0];
    expect(bottom.palette).toContain('minecraft:bedrock');
    expect(bottom.palette).toContain('minecraft:stone');
    const surfaceSection = sections[(70 + 64) >> 4];
    expect(surfaceSection.palette).toContain('minecraft:grass_block');
  });

  it('fills water up to sea level over low terrain', () => {
    const sections = buildChunkSections(flatHeights(50));
    const allNames = new Set(sections.flatMap((s) => s.palette));
    expect(allNames.has('minecraft:water')).toBe(true);
    expect(allNames.has('minecraft:grass_block')).toBe(false);
  });
});

describe('chunk NBT round-trip', () => {
  it('writes a parseable chunk with the 1.21 layout', () => {
    const sections = buildChunkSections(flatHeights(70));
    const bytes = buildChunkNbt(5, 7, sections);
    const chunk = parseChunkNbt(bytes) as unknown as {
      DataVersion: number;
      xPos: number;
      zPos: number;
      yPos: number;
      Status: string;
      sections: { Y: number; block_states: { palette: { Name: string }[]; data?: unknown[] } }[];
    };
    expect(chunk.DataVersion).toBe(MINECRAFT_DATA_VERSION);
    expect(chunk.xPos).toBe(5);
    expect(chunk.zPos).toBe(7);
    expect(chunk.yPos).toBe(-4);
    expect(chunk.Status).toBe('minecraft:full');
    expect(chunk.sections).toHaveLength(24);
    expect(chunk.sections[0].Y).toBe(-4);
    const deepSection = chunk.sections[0];
    expect(deepSection.block_states.palette.map((p) => p.Name).sort()).toEqual(
      ['minecraft:bedrock', 'minecraft:stone'].sort(),
    );
  });

  it('decodes 4-bit section data back to valid palette indices', () => {
    const sections = buildChunkSections(flatHeights(70));
    const bytes = buildChunkNbt(0, 0, sections);
    const chunk = parseChunkNbt(bytes) as unknown as {
      sections: { block_states: { palette: { Name: string }[]; data?: unknown[] } }[];
    };
    // Surface section (y=70 lives in section index (70+64)>>4 = 8).
    const surface = chunk.sections[8].block_states;
    const paletteNames = surface.palette.map((p) => p.Name);
    expect(paletteNames.length).toBeGreaterThan(1);
    expect(surface.data).toHaveLength(256);
    const toBigInt = (entry: unknown): bigint => {
      if (typeof entry === 'bigint') return entry;
      if (typeof entry === 'number') return BigInt(entry);
      if (Array.isArray(entry)) return (BigInt(entry[0]) << 32n) | BigInt(entry[1] >>> 0);
      throw new Error(`unexpected long form: ${typeof entry}`);
    };
    const words = (surface.data as unknown[]).map(toBigInt);
    let grassHits = 0;
    for (let i = 0; i < 4096; i++) {
      const word = words[(i / 16) | 0];
      const index = Number((word >> BigInt((i % 16) * 4)) & 0xfn);
      expect(index).toBeLessThan(paletteNames.length);
      if (paletteNames[index] === 'minecraft:grass_block') grassHits++;
    }
    expect(grassHits).toBe(256); // entire top layer of a flat world
  });
});

describe('region file layout', () => {
  it('writes sector-aligned chunks readable per the Anvil spec', () => {
    const chunks = buildRegionChunks(bigFlatRegion());
    const now = 1700000000;
    const region = writeRegionFile(chunks, now);
    expect(chunks).toHaveLength(1024);

    const view = new DataView(region.buffer, region.byteOffset, region.byteLength);
    // Chunk (3,5) lives at table index 3 + 5*32.
    const tableIndex = 3 + 5 * 32;
    const offsetEntry = view.getUint32(tableIndex * 4);
    const sector = offsetEntry >> 8;
    const sectorCount = offsetEntry & 0xff;
    expect(sector).toBeGreaterThanOrEqual(2);
    expect(sectorCount).toBeGreaterThanOrEqual(1);
    expect(view.getUint32(4096 + tableIndex * 4)).toBe(now);

    const byteOffset = sector * 4096;
    const length = view.getUint32(byteOffset);
    expect(region[byteOffset + 4]).toBe(2); // zlib compression
    expect(length).toBeLessThanOrEqual(sectorCount * 4096 - 4);
    const payload = region.slice(byteOffset + 5, byteOffset + 5 + length - 1);
    const inflated = inflate(payload);
    const chunk = parseChunkNbt(inflated) as unknown as { xPos: number; zPos: number; Status: string };
    expect(chunk.xPos).toBe(3);
    expect(chunk.zPos).toBe(5);
    expect(chunk.Status).toBe('minecraft:full');
  });
});

function bigFlatRegion(): Int16Array {
  return new Int16Array(512 * 512).fill(70);
}

describe('level.dat', () => {
  it('is gzipped NBT with matching data versions and spawn', () => {
    const bytes = buildLevelDat({ worldName: 'Test World', spawnX: 256, spawnY: 71, spawnZ: 256 });
    expect(bytes[0]).toBe(0x1f);
    expect(bytes[1]).toBe(0x8b);
    const parsed = nbt.simplify(nbt.parseUncompressed(Buffer.from(ungzip(bytes)))) as unknown as {
      Data: {
        DataVersion: number;
        LevelName: string;
        SpawnX: number;
        SpawnY: number;
        SpawnZ: number;
        Version: { Id: number; Name: string };
      };
    };
    expect(parsed.Data.DataVersion).toBe(MINECRAFT_DATA_VERSION);
    expect(parsed.Data.Version.Id).toBe(MINECRAFT_DATA_VERSION);
    expect(parsed.Data.Version.Name).toBe('1.21');
    expect(parsed.Data.LevelName).toBe('Test World');
    expect([parsed.Data.SpawnX, parsed.Data.SpawnY, parsed.Data.SpawnZ]).toEqual([256, 71, 256]);
  });
});

describe('terrain tile math', () => {
  it('round-trips tile coordinates', () => {
    const lon = 120.5887;
    const lat = 15.145;
    const x = lonToTileX(lon, 15);
    const y = latToTileY(lat, 15);
    expect(tileXToLon(x, 15)).toBeLessThanOrEqual(lon);
    expect(tileXToLon(x + 1, 15)).toBeGreaterThan(lon);
    expect(tileYToLat(y, 15)).toBeGreaterThanOrEqual(lat);
    expect(tileYToLat(y + 1, 15)).toBeLessThan(lat);
  });

  it('centers the block grid on the requested point', () => {
    const middle = blockLonLat(120, 15, 255.5, 255.5);
    expect(middle.lon).toBeCloseTo(120, 6);
    expect(middle.lat).toBeCloseTo(15, 6);
  });
});
