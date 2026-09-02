import { useState } from 'react';
import { Box, Download, MapPin, Layers } from 'lucide-react';

export function MinecraftExport() {
  const [area] = useState({ width: 500, height: 500 }); // meters
  const [format, setFormat] = useState<'java' | 'bedrock'>('java');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    // Simulate export — in real implementation, this would use the Minecraft export engine
    // with terrain, roads, buildings → blocks conversion
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsExporting(false);

    // Create a placeholder download — real implementation would generate a .zip with world files
    const csv = `minecraft_export,center_lon,center_lat,width,height,format\n120.5887,15.145,${area.width},${area.height},${format}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terravision-minecraft-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass w-full max-w-md rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <Box className="h-4 w-4 text-[#00d890]" />
        <h3 className="text-[13px] font-semibold text-slate-200">Minecraft Export</h3>
        <span className="ml-auto rounded-full bg-[#00d890]/20 px-2 py-0.5 font-mono text-[10px] text-[#00d890]">
          One-click
        </span>
      </div>

      <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 text-[12px] text-slate-300">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          Current map area
        </div>
        <p className="mt-1 font-mono text-[11px] text-slate-400">
          Center: 15.1450°N, 120.5887°E · {area.width}×{area.height} m
        </p>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
          <Layers className="h-3 w-3" />
          Terrain + roads + buildings → blocks
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
          className={`flex-1 rounded-xl border px-3 py-2 text-[12px] font-medium ${
            format === 'bedrock'
              ? 'border-[#5500a4] bg-[#5500a4] text-white'
              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          Bedrock
        </button>
      </div>

      <button
        onClick={handleExport}
        disabled={isExporting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00d890] py-2.5 text-[13px] font-medium text-[#0D1B2A] transition hover:brightness-110 disabled:opacity-60"
      >
        <Download className={`h-4 w-4 ${isExporting ? 'animate-pulse' : ''}`} />
        {isExporting ? 'Generating world…' : `Export to ${format === 'java' ? 'Java' : 'Bedrock'}`}
      </button>

      <p className="mt-2 text-center font-mono text-[10px] text-slate-500">
        Client-side only · No server · Uses local terrain data
      </p>
    </div>
  );
}
