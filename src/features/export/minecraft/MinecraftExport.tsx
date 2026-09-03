import { useState } from 'react';
import { Box, Download, MapPin, Layers } from 'lucide-react';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useMapStore } from '../../../stores/mapStore';
import { downloadBytes, exportMinecraftRegion } from './exportWorld';
import { REGION_BLOCKS } from './terrain';

type ExportPhase = 'idle' | 'working' | 'done' | 'failed';

interface ExportSummary {
  regionBytes: Uint8Array;
  levelDatBytes: Uint8Array;
  minHeight: number;
  maxHeight: number;
  spawnY: number;
}

export function MinecraftExport() {
  const [format, setFormat] = useState<'java' | 'bedrock'>('java');
  const [phase, setPhase] = useState<ExportPhase>('idle');
  const [progress, setProgress] = useState('');
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isBrightBasemap = useBrightBasemap();
  const center = useMapStore((s) => s.center);

  const handleExport = async () => {
    setPhase('working');
    setProgress('Starting…');
    setSummary(null);
    setError(null);
    try {
      const result = await exportMinecraftRegion(center[0], center[1], setProgress);
      setSummary({
        regionBytes: result.regionBytes,
        levelDatBytes: result.levelDatBytes,
        minHeight: result.minHeight,
        maxHeight: result.maxHeight,
        spawnY: result.spawnY,
      });
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('failed');
    }
  };

  return (
    <div className="glass w-full max-w-md rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <Box className="h-4 w-4 text-[#00d890]" />
        <h3 className="text-[13px] font-semibold text-slate-200">Minecraft Export</h3>
        <span className="ml-auto rounded-full bg-[#00d890]/20 px-2 py-0.5 font-mono text-[10px] text-[#00d890]">
          Java Edition
        </span>
      </div>

      <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 text-[12px] text-slate-300">
          <MapPin className={`h-3.5 w-3.5 ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`} />
          Current map area
        </div>
        <p className={`mt-1 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
          Center: {center[1].toFixed(4)}°N, {center[0].toFixed(4)}°E · {REGION_BLOCKS}×{REGION_BLOCKS} blocks
        </p>
        <div className={`mt-2 flex items-center gap-2 text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
          <Layers className="h-3 w-3" />
          Real terrain + water from elevation data · no roads or buildings
        </div>
      </div>

      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setFormat('java')}
          className={`flex-1 rounded-xl border px-3 py-2 text-[12px] font-medium ${
            format === 'java'
              ? 'border-[#5500a4] bg-[#5500a4] text-white'
              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          Java Edition
        </button>
        <button
          onClick={() => setFormat('bedrock')}
          disabled
          title="Bedrock LevelDB not practically exportable from browser — out of scope"
          className="flex-1 cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-medium text-slate-500 opacity-60"
        >
          Bedrock — not supported
        </button>
      </div>
      <p className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
        Exports one region (r.0.0.mca, 1024 chunks) plus level.dat, generated in your browser. These files have not
        been opened in real Minecraft yet — verify in-game before relying on them.
      </p>

      <button
        onClick={handleExport}
        disabled={phase === 'working'}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00d890] py-2.5 text-[13px] font-medium text-[#0D1B2A] transition hover:brightness-110 disabled:opacity-60"
      >
        <Download className={`h-4 w-4 ${phase === 'working' ? 'animate-pulse' : ''}`} />
        {phase === 'working' ? progress : 'Generate world files'}
      </button>

      {phase === 'failed' && error && (
        <p className="mt-2 rounded-lg border border-[#E63946]/30 bg-[#E63946]/10 px-3 py-2 text-[11px] text-[#ff8a8a]">
          Export failed: {error} Nothing was downloaded.
        </p>
      )}

      {phase === 'done' && summary && (
        <div className="mt-2 rounded-lg border border-[#00d890]/30 bg-[#00d890]/10 px-3 py-2 text-[11px] text-slate-200">
          <p className="font-mono">
            r.0.0.mca {(summary.regionBytes.length / 1024 / 1024).toFixed(1)} MB · level.dat{' '}
            {summary.levelDatBytes.length} B
          </p>
          <p className="mt-1 font-mono">
            Elevation {summary.minHeight}…{summary.maxHeight} m · spawn y={summary.spawnY}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => downloadBytes(summary.regionBytes, 'r.0.0.mca', 'application/octet-stream')}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#00d890] px-3 py-2 text-[12px] font-medium text-[#0D1B2A] hover:brightness-110"
            >
              <Download className="h-3.5 w-3.5" />
              r.0.0.mca
            </button>
            <button
              onClick={() => downloadBytes(summary.levelDatBytes, 'level.dat', 'application/octet-stream')}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#00d890]/40 bg-transparent px-3 py-2 text-[12px] font-medium text-[#00d890] hover:bg-[#00d890]/10"
            >
              <Download className="h-3.5 w-3.5" />
              level.dat
            </button>
          </div>
          <p className="mt-2">Put both files in a new world folder: region/r.0.0.mca and level.dat next to it.</p>
        </div>
      )}

      <p className={`mt-2 text-center font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
        Client-side only · No server · Uses local terrain data
      </p>
    </div>
  );
}
