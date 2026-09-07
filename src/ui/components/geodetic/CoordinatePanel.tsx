import { useMemo, useState } from 'react';
import { useMapStore } from '../../../stores/mapStore';
import { transformCoordinate, getEpsgList } from '../../../core/geodetic/projections/epsg';
import { ntv2ShiftMeters, parseNTv2, type NTv2Grid } from '../../../core/geodetic/ntv2/NTv2Grid';
import { Upload, SlidersHorizontal } from 'lucide-react';
import { FloatingPanel } from '../common/FloatingPanel';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';

export function CoordinatePanel() {
  const { center } = useMapStore();
  const [targetEpsg, setTargetEpsg] = useState('EPSG:32651');
  const [datumBlend, setDatumBlend] = useState(0); // 0 = WGS84, 100 = shifted
  const [gridFile, setGridFile] = useState<string | null>(null);
  const [grid, setGrid] = useState<NTv2Grid | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);
  const isBrightBasemap = useBrightBasemap();

  // Real shift at the map center from the loaded NTv2 grid (null when no
  // grid is loaded or the center falls outside its coverage).
  const gridShift = useMemo(
    () => (grid ? ntv2ShiftMeters(grid, center[1], center[0]) : null),
    [grid, center],
  );

  const loadGridFile = (file: File) => {
    setGridFile(file.name);
    setGridError(null);
    setGrid(null);
    file
      .arrayBuffer()
      .then((buffer) => {
        try {
          setGrid(parseNTv2(buffer));
        } catch (err) {
          setGridError(err instanceof Error ? `Could not parse ${file.name}: ${err.message}` : `Could not parse ${file.name}`);
        }
      })
      .catch(() => {
        setGridError(`Could not read ${file.name}`);
      });
  };

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
    <FloatingPanel
      id="datum-viz"
      title="Datum shift"
      icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
      initialPosition={{ x: 320, y: 380 }}
      bubbleLabel="Datum shift"
    >
      <div>
        <div className="mb-3">
        <p className={`mb-1 text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>WGS84 (EPSG:4326)</p>
        <p className={`font-mono text-[12px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>{wgs84Label}</p>
      </div>

      <div className="mb-3">
        <label className={`mb-1 block text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
          Target projection
        </label>
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
        <p className={`mb-1 text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>{targetEpsg}</p>
        {transformed.error ? (
          <p className="font-mono text-[11px] text-[#E63946]">{transformed.error}</p>
        ) : (
          <p className={`font-mono text-[12px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>
            E: {transformed.x.toFixed(2)}<br />
            N: {transformed.y.toFixed(2)} <span className={isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}>m</span>
          </p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="mb-2 flex items-center gap-2">
          <SlidersHorizontal className={`h-3.5 w-3.5 ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`} />
          <p className={`text-[11px] font-medium uppercase tracking-wide ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
            Datum shift visualization
          </p>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={datumBlend}
          onChange={(e) => setDatumBlend(Number(e.target.value))}
          className="h-1 w-full appearance-none rounded-full bg-white/10 accent-[#5500a4]"
        />
        <div className={`mt-1 flex justify-between font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
          <span>WGS84</span>
          <span>{datumBlend}%</span>
          <span>Shifted</span>
        </div>
        <p className={`mt-2 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
          {gridShift ? (
            <>
              ΔN: {((gridShift.dNorthM * datumBlend) / 100).toFixed(2)} m · ΔE:{' '}
              {((gridShift.dEastM * datumBlend) / 100).toFixed(2)} m
            </>
          ) : (
            'Load an NTv2 grid below for real shifts at this location'
          )}
        </p>
      </div>

      <div className="mt-3">
        <label className={`flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] hover:bg-white/10 ${isBrightBasemap ? 'text-slate-700' : 'text-slate-300'}`}>
          <Upload className="h-3.5 w-3.5" />
          <span>{gridFile ? gridFile : 'Load NTv2 grid (.gsb)'}</span>
          <input
            type="file"
            accept=".gsb,.gsa"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadGridFile(file);
              e.target.value = '';
            }}
          />
        </label>
        {gridError && <p className="mt-1 font-mono text-[10px] text-[#E63946]">{gridError}</p>}
        {!gridError && grid && !gridShift && (
          <p className={`mt-1 text-center font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
            Map center is outside this grid&apos;s coverage
          </p>
        )}
        <p className={`mt-1 text-center font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
          Supports NTv2 grids for sub-centimeter shifts
        </p>
      </div>

      <p className={`mt-3 text-center font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
        Powered by Proj4js · 7 EPSG bundled · NTv2 precise (full 5k+ requires proj4-epsg fetch)
      </p>
      </div>
    </FloatingPanel>
  );
}
