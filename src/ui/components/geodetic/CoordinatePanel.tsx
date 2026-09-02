import { useMemo, useState } from 'react';
import { useMapStore } from '../../../stores/mapStore';
import { transformCoordinate, getEpsgList } from '../../../core/geodetic/projections/epsg';

export function CoordinatePanel() {
  const { center } = useMapStore();
  const [targetEpsg, setTargetEpsg] = useState('EPSG:32651');

  const transformed = useMemo(() => {
    try {
      const [x, y] = transformCoordinate('EPSG:4326', targetEpsg, center);
      return { x, y, error: null };
    } catch (err) {
      return { x: 0, y: 0, error: err instanceof Error ? err.message : 'Transform failed' };
    }
  }, [center, targetEpsg]);

  const wgs84Label = `${center[1].toFixed(5)}°N, ${center[0].toFixed(5)}°E`;

  return (
    <div className="glass absolute bottom-24 left-4 z-10 hidden w-72 rounded-2xl p-4 md:block">
      <h3 className="mb-3 text-[13px] font-semibold text-slate-200">Geodetic</h3>

      <div className="mb-3">
        <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">WGS84 (EPSG:4326)</p>
        <p className="font-mono text-[12px] text-slate-200">{wgs84Label}</p>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500">
          Target projection
        </label>
        <select
          value={targetEpsg}
          onChange={(e) => setTargetEpsg(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-[12px] outline-none focus:border-[#5500a4]/50"
        >
          {getEpsgList().map((epsg) => (
            <option key={epsg.code} value={epsg.code} className="bg-[#0D1B2A]">
              {epsg.code} — {epsg.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">{targetEpsg}</p>
        {transformed.error ? (
          <p className="font-mono text-[11px] text-[#E63946]">{transformed.error}</p>
        ) : (
          <p className="font-mono text-[12px] text-slate-200">
            E: {transformed.x.toFixed(2)}<br />
            N: {transformed.y.toFixed(2)} <span className="text-slate-400">m</span>
          </p>
        )}
      </div>

      <p className="mt-3 text-center font-mono text-[10px] text-slate-500">
        Powered by Proj4js · 5,000+ EPSG via custom grids
      </p>
    </div>
  );
}
