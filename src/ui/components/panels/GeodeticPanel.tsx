import { useMemo, useState } from 'react';
import { Ruler } from 'lucide-react';
import { FloatingPanel } from '../common/FloatingPanel';
import { useMapStore } from '../../../features/map/store';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { transformCoordinate, getEpsgList } from '../../../core/geodetic/projections/epsg';

export function GeodeticPanel() {
  const { center } = useMapStore();
  const isBrightBasemap = useBrightBasemap();
  const [targetEpsg, setTargetEpsg] = useState('EPSG:32651');

  const geodeticTransformed = useMemo(() => {
    try {
      const [x, y] = transformCoordinate('EPSG:4326', targetEpsg, center);
      return { x, y, error: null as string | null };
    } catch (err) {
      return { x: 0, y: 0, error: err instanceof Error ? err.message : 'Transform failed' };
    }
  }, [center, targetEpsg]);

  const wgs84Label = useMemo(() => `${center[1].toFixed(5)}°N, ${center[0].toFixed(5)}°E`, [center]);

  return (
    <FloatingPanel id="geodetic" title="Geodetic" icon={<Ruler className="h-3.5 w-3.5" />} initialPosition={{ x: 16, y: 420 }} bubbleLabel="Geodetic">
      <div>
        <div className="mb-3">
          <p className={`mb-1 text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-500'}`}>WGS84 (EPSG:4326)</p>
          <p className={`font-mono text-[12px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>{wgs84Label}</p>
        </div>

        <div className="mb-3">
          <label className={`mb-1 block text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-500'}`}>Target projection</label>
          <select
            value={targetEpsg}
            onChange={(e) => setTargetEpsg(e.target.value)}
            className={`glass w-full rounded-xl px-3 py-2 font-mono text-[12px] outline-none focus:border-[#5500a4]/50 ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}
          >
            {getEpsgList().map((epsg) => (
              <option key={epsg.code} value={epsg.code} className="bg-[#0D1B2A] text-slate-200">
                {epsg.code} — {epsg.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <p className={`mb-1 text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-500'}`}>{targetEpsg}</p>
          {geodeticTransformed.error ? (
            <p className="font-mono text-[11px] text-[#E63946]">{geodeticTransformed.error}</p>
          ) : (
            <p className={`font-mono text-[12px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>
              E: {geodeticTransformed.x.toFixed(2)}
              <br />
              N: {geodeticTransformed.y.toFixed(2)} <span className={isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}>m</span>
            </p>
          )}
        </div>

        <p className={`mt-3 text-center font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-500'}`}>Powered by Proj4js · 9 EPSG bundled (WGS84/UTM/NAD83/ETRS89/OSGB36/PRS92) · NTv2</p>

        <p className={`mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
          Elevation profile and cut/fill volume need DEM sampling along the measured path — not built yet.
          Bearing, distance, area, datum shift, grid snap, CSV export, and session share above are the working set.
        </p>
      </div>
    </FloatingPanel>
  );
}
