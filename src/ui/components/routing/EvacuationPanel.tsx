import { useEffect, useState } from 'react';
import { Navigation, ShieldAlert, MapPin, X } from 'lucide-react';
import * as turf from '@turf/turf';
import { FloatingPanel } from '../common/FloatingPanel';
import { useMapStore } from '../../../stores/mapStore';
import { useRouteStore } from '../../../stores/routeStore';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { routeAvoidingArea } from '../../../features/routing/valhalla';
import { circleToRing, evacStep, EVAC_STEP_INSTRUCTIONS, type EvacCircle } from '../../../features/routing/avoidZone';
import { PlaceAutocomplete } from '../search/PlaceAutocomplete';
import type { GeocodedPlace } from '../../../features/search/geocode';

function parseCoordinate(text: string, label: string, min: number, max: number): number {
  const value = Number(text.trim());
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be a number between ${min} and ${max}`);
  }
  return value;
}

const STEPS = ['Set start', 'Set destination', 'Avoid area (optional)', 'Find route'] as const;

export function EvacuationPanel() {
  const mapCenter = useMapStore((s) => s.center);
  const setCenter = useMapStore((s) => s.setCenter);
  const setZoom = useMapStore((s) => s.setZoom);
  const start = useRouteStore((s) => s.start);
  const destination = useRouteStore((s) => s.destination);
  const avoidCircle = useRouteStore((s) => s.avoidCircle);
  const route = useRouteStore((s) => s.route);
  const pickMode = useRouteStore((s) => s.pickMode);
  const setStart = useRouteStore((s) => s.setStart);
  const clearStart = useRouteStore((s) => s.clearStart);
  const setDestination = useRouteStore((s) => s.setDestination);
  const clearDestination = useRouteStore((s) => s.clearDestination);
  const setAvoidCircle = useRouteStore((s) => s.setAvoidCircle);
  const setPickMode = useRouteStore((s) => s.setPickMode);
  const setEvacuationRoute = useRouteStore((s) => s.setEvacuationRoute);
  const clearEvacuationRoute = useRouteStore((s) => s.clearEvacuationRoute);
  const isBrightBasemap = useBrightBasemap();

  // Field text is render-derived: user typing lives in the draft, while an
  // externally set pin (map click, drag, autocomplete select) resets the
  // draft back to the pin label. This is React's documented previous-render
  // comparison pattern, not an effect sync.
  const [startDraft, setStartDraft] = useState<string | null>(null);
  const [prevStart, setPrevStart] = useState(start);
  if (start !== prevStart) {
    setPrevStart(start);
    setStartDraft(null);
  }
  const [destinationDraft, setDestinationDraft] = useState<string | null>(null);
  const [prevDestination, setPrevDestination] = useState(destination);
  if (destination !== prevDestination) {
    setPrevDestination(destination);
    setDestinationDraft(null);
  }
  const startText = startDraft ?? start?.label ?? '';
  const destinationText = destinationDraft ?? destination?.label ?? '';
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

  const step = evacStep(start, destination, route !== null);
  const stepIndex = step === 'start' ? 0 : step === 'destination' ? 1 : step === 'avoid' ? 2 : 3;

  // Escape disarms map picking.
  useEffect(() => {
    if (!pickMode) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickMode(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickMode, setPickMode]);

  const flyToPin = (lon: number, lat: number) => {
    setCenter([lon, lat]);
    if (useMapStore.getState().zoom < 12) setZoom(12);
  };

  const handleSelectStart = (place: GeocodedPlace) => {
    setStart({ lon: place.lon, lat: place.lat, label: place.displayName.split(',')[0] });
    flyToPin(place.lon, place.lat);
  };

  const handleSelectDestination = (place: GeocodedPlace) => {
    setDestination({ lon: place.lon, lat: place.lat, label: place.displayName.split(',')[0] });
    flyToPin(place.lon, place.lat);
  };

  const submitRoute = async (
    from: { lon: number; lat: number },
    to: { lon: number; lat: number },
    avoid: EvacCircle | null,
  ) => {
    setIsRouting(true);
    setResult(null);
    setError(null);
    try {
      const ring = avoid ? circleToRing(avoid) : null;
      const route = await routeAvoidingArea(from, to, ring);
      const verdict = ring
        ? turf.booleanDisjoint(
            turf.lineString(route.path.map((point) => [point.lon, point.lat])),
            turf.polygon([ring.map((point) => [point.lon, point.lat])]),
          )
        : true;
      setEvacuationRoute({ ...route, avoidsArea: verdict });
      setResult({ distanceKm: route.distanceKm, durationMinutes: route.durationMinutes, avoidsArea: verdict });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRouting(false);
    }
  };

  const handleGuidedRoute = () => {
    if (!start || !destination) return;
    void submitRoute(start, destination, avoidCircle);
  };

  const handleManualRoute = () => {
    try {
      const from = { lon: parseCoordinate(fromLon, 'Start longitude', -180, 180), lat: parseCoordinate(fromLat, 'Start latitude', -90, 90) };
      const to = { lon: parseCoordinate(toLon, 'End longitude', -180, 180), lat: parseCoordinate(toLat, 'End latitude', -90, 90) };
      const avoid: EvacCircle = {
        lon: parseCoordinate(avoidLon, 'Avoid longitude', -180, 180),
        lat: parseCoordinate(avoidLat, 'Avoid latitude', -90, 90),
        radiusKm: parseCoordinate(radiusKm, 'Avoid radius', 0.1, 20),
      };
      setAvoidCircle(avoid);
      void submitRoute(from, to, avoid);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const labelClass = `mb-1 block text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`;
  const inputClass = `w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-[12px] outline-none focus:border-[#5500a4]/50 ${isBrightBasemap ? 'text-slate-800 placeholder:text-slate-500' : 'text-slate-200 placeholder:text-slate-400'}`;
  const pickButtonClass = (active: boolean) =>
    `flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${active ? 'border-[#5500a4] bg-[#5500a4] text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`;

  return (
    <FloatingPanel
      id="evacuation"
      title="Evacuation routing"
      icon={<Navigation className="h-3.5 w-3.5" />}
      initialPosition={{ x: 350, y: 96 }}
      bubbleLabel="Evacuation routing"
    >
      <div>
        <ol className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px]">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-1.5">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] ${
                  index < stepIndex
                    ? 'bg-[#00d890]/25 text-[#00d890]'
                    : index === stepIndex
                      ? 'bg-[#5500a4] text-white'
                      : isBrightBasemap
                        ? 'bg-black/10 text-slate-500'
                        : 'bg-white/10 text-slate-400'
                }`}
              >
                {index + 1}
              </span>
              <span className={index === stepIndex ? (isBrightBasemap ? 'text-slate-800' : 'text-slate-100') : isBrightBasemap ? 'text-slate-500' : 'text-slate-400'}>
                {label}
              </span>
              {index < STEPS.length - 1 && <span className={isBrightBasemap ? 'text-slate-400' : 'text-slate-500'}>→</span>}
            </li>
          ))}
        </ol>
        <p className={`mb-3 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
          {EVAC_STEP_INSTRUCTIONS[step]}
        </p>

        <div className="mb-2 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <label className={labelClass}>Start</label>
            <PlaceAutocomplete
              value={startText}
              onChange={setStartDraft}
              onSelect={handleSelectStart}
              placeholder="Search or pick on map…"
              ariaLabel="Start location"
            />
          </div>
          <button
            type="button"
            onClick={() => setPickMode(pickMode === 'start' ? null : 'start')}
            aria-pressed={pickMode === 'start'}
            title="Pick start on the map"
            aria-label="Pick start on the map"
            className={pickButtonClass(pickMode === 'start')}
          >
            <MapPin className="h-4 w-4" />
          </button>
          {start && (
            <button
              type="button"
              onClick={() => {
                clearStart();
                setStartDraft(null);
              }}
              aria-label="Clear start"
              title="Clear start"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <label className={labelClass}>Destination</label>
            <PlaceAutocomplete
              value={destinationText}
              onChange={setDestinationDraft}
              onSelect={handleSelectDestination}
              placeholder="Search or pick on map…"
              ariaLabel="Destination location"
            />
          </div>
          <button
            type="button"
            onClick={() => setPickMode(pickMode === 'destination' ? null : 'destination')}
            aria-pressed={pickMode === 'destination'}
            title="Pick destination on the map"
            aria-label="Pick destination on the map"
            className={pickButtonClass(pickMode === 'destination')}
          >
            <MapPin className="h-4 w-4" />
          </button>
          {destination && (
            <button
              type="button"
              onClick={() => {
                clearDestination();
                setDestinationDraft(null);
              }}
              aria-label="Clear destination"
              title="Clear destination"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

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

        <div className="flex gap-2">
          <button
            onClick={handleGuidedRoute}
            disabled={isRouting || !start || !destination}
            title={!start || !destination ? 'Set start and destination first' : 'Find evacuation route'}
            className="flex-1 rounded-xl bg-[#5500a4] py-2 text-[12.5px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {isRouting ? 'Requesting route…' : 'Find evacuation route'}
          </button>
          <button
            onClick={handleManualRoute}
            disabled={isRouting}
            title="Route from the manual coordinate fields below"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-medium text-slate-300 hover:bg-white/10 disabled:opacity-60"
          >
            Use manual
          </button>
        </div>

        {result && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[12px]">
            <p className={`font-mono ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
              {result.distanceKm.toFixed(1)} km · {result.durationMinutes.toFixed(0)} min by car
            </p>
            <p className={`mt-1 flex items-center gap-1.5 ${result.avoidsArea ? 'text-[#00d890]' : 'text-[#FF9F1C]'}`}>
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
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
