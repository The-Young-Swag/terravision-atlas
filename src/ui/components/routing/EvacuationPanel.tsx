import { useState } from 'react';
import { Navigation, ShieldAlert } from 'lucide-react';
import * as turf from '@turf/turf';
import { FloatingPanel } from '../common/FloatingPanel';
import { useMapStore } from '../../../stores/mapStore';
import { useRouteStore } from '../../../stores/routeStore';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { routeAvoidingArea } from '../../../features/routing/valhalla';

function parseCoordinate(text: string, label: string, min: number, max: number): number {
  const value = Number(text.trim());
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be a number between ${min} and ${max}`);
  }
  return value;
}

export function EvacuationPanel() {
  const mapCenter = useMapStore((s) => s.center);
  const setEvacuationRoute = useRouteStore((s) => s.setEvacuationRoute);
  const clearEvacuationRoute = useRouteStore((s) => s.clearEvacuationRoute);
  const isBrightBasemap = useBrightBasemap();

  const [fromLon, setFromLon] = useState(() => (mapCenter[0] - 0.04).toFixed(4));
  const [fromLat, setFromLat] = useState(() => mapCenter[1].toFixed(4));
  const [toLon, setToLon] = useState(() => (mapCenter[0] + 0.04).toFixed(4));
  const [toLat, setToLat] = useState(() => mapCenter[1].toFixed(4));
  const [avoidLon, setAvoidLon] = useState(() => mapCenter[0].toFixed(4));
  const [avoidLat, setAvoidLat] = useState(() => mapCenter[1].toFixed(4));
  const [radiusKm, setRadiusKm] = useState('2');
  const [isRouting, setIsRouting] = useState(false);
  const [result, setResult] = useState<{ distanceKm: number; durationMinutes: number; avoidsArea: boolean } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const labelClass = `mb-1 block text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`;
  const inputClass =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-[12px] outline-none focus:border-[#5500a4]/50';

  const handleRoute = async () => {
    setIsRouting(true);
    setResult(null);
    setError(null);
    try {
      const from = { lon: parseCoordinate(fromLon, 'Start longitude', -180, 180), lat: parseCoordinate(fromLat, 'Start latitude', -90, 90) };
      const to = { lon: parseCoordinate(toLon, 'End longitude', -180, 180), lat: parseCoordinate(toLat, 'End latitude', -90, 90) };
      const avoidCenter = {
        lon: parseCoordinate(avoidLon, 'Avoid longitude', -180, 180),
        lat: parseCoordinate(avoidLat, 'Avoid latitude', -90, 90),
      };
      const radius = parseCoordinate(radiusKm, 'Avoid radius', 0.1, 20);
      const avoidPolygon = turf.circle([avoidCenter.lon, avoidCenter.lat], radius, { steps: 32, units: 'kilometers' });
      const ring = (avoidPolygon.geometry.coordinates[0] as [number, number][]).map(([lon, lat]) => ({ lon, lat }));
      const route = await routeAvoidingArea(from, to, ring);
      const verdict = turf.booleanDisjoint(
        turf.lineString(route.path.map((point) => [point.lon, point.lat])),
        avoidPolygon,
      );
      setEvacuationRoute({ ...route, avoidsArea: verdict }, ring);
      setResult({ distanceKm: route.distanceKm, durationMinutes: route.durationMinutes, avoidsArea: verdict });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRouting(false);
    }
  };

  return (
    <FloatingPanel
      id="evacuation"
      title="Evacuation routing"
      icon={<Navigation className="h-3.5 w-3.5" />}
      initialPosition={{ x: 350, y: 96 }}
      bubbleLabel="Evacuation routing"
    >
      <div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Start lon</label>
            <input value={fromLon} onChange={(e) => setFromLon(e.target.value)} inputMode="decimal" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Start lat</label>
            <input value={fromLat} onChange={(e) => setFromLat(e.target.value)} inputMode="decimal" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>End lon</label>
            <input value={toLon} onChange={(e) => setToLon(e.target.value)} inputMode="decimal" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>End lat</label>
            <input value={toLat} onChange={(e) => setToLat(e.target.value)} inputMode="decimal" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Avoid lon</label>
            <input value={avoidLon} onChange={(e) => setAvoidLon(e.target.value)} inputMode="decimal" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Avoid lat</label>
            <input value={avoidLat} onChange={(e) => setAvoidLat(e.target.value)} inputMode="decimal" className={inputClass} />
          </div>
        </div>

        <div className="mb-3">
          <label className={labelClass}>Avoid radius (km)</label>
          <input value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} inputMode="decimal" className={inputClass} />
        </div>

        <button
          onClick={handleRoute}
          disabled={isRouting}
          className="w-full rounded-xl bg-[#5500a4] py-2 text-[12.5px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {isRouting ? 'Requesting route…' : 'Find evacuation route'}
        </button>

        {result && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[12px]">
            <p className={`font-mono ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
              {result.distanceKm.toFixed(1)} km · {result.durationMinutes.toFixed(0)} min by car
            </p>
            <p className={`mt-1 flex items-center gap-1.5 ${result.avoidsArea ? 'text-[#00d890]' : 'text-[#FF9F1C]'}`}>
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              {result.avoidsArea
                ? 'Route avoids the area'
                : 'Route enters the area — widen the radius and retry'}
            </p>
            <button
              onClick={() => {
                clearEvacuationRoute();
                setResult(null);
              }}
              className={`mt-2 text-[11px] underline ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}
            >
              Clear route
            </button>
          </div>
        )}

        {error && (
          <p className="mt-2 rounded-lg border border-[#E63946]/30 bg-[#E63946]/10 px-3 py-2 text-[11px] text-[#ff8a8a]">
            Routing failed: {error}
          </p>
        )}

        <p className={`mt-3 text-center font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
          Valhalla demo server · max 1 request/sec · driving
        </p>
      </div>
    </FloatingPanel>
  );
}
