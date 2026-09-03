// Browser stub for Node's `zlib`, imported at module top by prismarine-nbt.
// Only prismarine-nbt's async gunzip callback path uses it, which this app
// never calls: NBT decoding here runs on already-decompressed bytes via
// parseUncompressed, and all compression goes through pako. This stub exists
// solely so bundlers can resolve the import; calling it is a loud error,
// never silent misbehavior. Vite maps bare `zlib` imports here (see
// vite.config.ts); Vitest/Node resolve the real builtin instead.
export function gunzip(): never {
  throw new Error('zlib.gunzip is unavailable in the browser — use pako instead');
}
