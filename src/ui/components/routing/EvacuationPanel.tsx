import { useEffect, useState } from 'react';
import { Navigation, ShieldAlert, MapPin, X, Check, TriangleAlert } from 'lucide-react';
import * as turf from '@turf/turf';
import { FloatingPanel } from '../common/FloatingPanel';
import { useMapStore } from '../../../stores/mapStore';
import { useRouteStore } from '../../../stores/routeStore';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { TRAVEL_COSTINGS, routeWithOptions, type TravelCosting } from '../../../features/routing/valhalla';
import { buildJogLoop, type Hilliness } from '../../../features/routing/joggingLoop';
import { trafficAdjustedMinutes } from '../../../features/traffic/flowEta';
import { tomtomApiKey } from '../../../features/traffic/tomtom';
import { useTrafficStore } from '../../../stores/trafficStore';
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
const GENERAL_STEPS = ['Set start', 'Set destination', 'Find route'] as const;

/**
 * Shared navigation surface for Explore (general point-to-point) and
 * Monitor (evacuation with avoid-zone). One panel, one guided-pin UX, one
 * route store — the avoid-zone section only exists in the evacuation
 * context. Origin/destination fields reuse the shared PlaceAutocomplete
 * (Photon + Nominatim), never a second search input.
 */
export function EvacuationPanel({ context = 'evacuation' }: { context?: 'general' | 'evacuation' }) {
  const isEvacuation = context === 'evacuation';
  const steps = isEvacuation ? STEPS : GENERAL_STEPS;
  const mapCenter = useMapStore((s) => s.center);
  const setCenter = useMapStore((s) => s.setCenter);
  const setZoom = useMapStore((s) => s.setZoom);
  const start = useRouteStore((s) => s.start);
  const destination = useRouteStore((s) => s.destination);
  const avoidCircle = useRouteStore((s) => s.avoidCircle);
  const route = useRouteStore((s) => s.route);
  const pickMode = useRouteStore((s) => s.pickMode);
  const drawAvoidArmed = useRouteStore((s) => s.drawAvoidArmed);
  const setStart = useRouteStore((s) => s.setStart);
  const clearStart = useRouteStore((s) => s.clearStart);
  const setDestination = useRouteStore((s) => s.setDestination);
  const clearDestination = useRouteStore((s) => s.clearDestination);
  const setAvoidCircle = useRouteStore((s) => s.setAvoidCircle);
  const setPickMode = useRouteStore((s) => s.setPickMode);
  const setDrawAvoidArmed = useRouteStore((s) => s.setDrawAvoidArmed);
  const clearAvoidCircle = useRouteStore((s) => s.clearAvoidCircle);
  const setEvacuationRoute = useRouteStore((s) => s.setEvacuationRoute);
  const clearEvacuationRoute = useRouteStore((s) => s.clearEvacuationRoute);
  const travelMode = useRouteStore((s) => s.travelMode);
  const setTravelMode = useRouteStore((s) => s.setTravelMode);
  const setTrafficAdjustment = useRouteStore((s) => s.setTrafficAdjustment);
  const trafficAdjustment = useRouteStore((s) => s.trafficAdjustment);
  const jogLoop = useRouteStore((s) => s.jogLoop);
  const setJogLoop = useRouteStore((s) => s.setJogLoop);
  const isBrightBasemap = useBrightBasemap();
  const [jogTargetKm, setJogTargetKm] = useState('5');
  const [jogHilliness, setJogHilliness] = useState<Hilliness>('flat');
  const [isJogging, setIsJogging] = useState(false);
  const [jogError, setJogError] = useState<string | null>(null);

  const handleJogLoop = () => {
    const targetKm = Number(jogTargetKm);
    if (!Number.isFinite(targetKm) || targetKm < 0.5 || targetKm > 42) {
      setJogError('Target distance must be between 0.5 and 42 km');
      return;
    }
    const origin = start ?? { lon: mapCenter[0], lat: mapCenter[1], label: 'Map center' };
    setIsJogging(true);
    setJogError(null);
    setTrafficAdjustment(null);
    clearEvacuationRoute();
    setResult(null);
    buildJogLoop({ start: origin, targetKm, hilliness: jogHilliness })
      .then((loop) => {
        setJogLoop({ path: loop.path, distanceKm: loop.distanceKm, durationMinutes: loop.durationMinutes, targetKm, hilliness: jogHilliness });
        if (!loop.withinTolerance) {
          setJogError(
            `Closest walkable loop is ${loop.distanceKm.toFixed(1)} km (target ${targetKm.toFixed(1)} km) after ${loop.attempts} tries`,
          );
        }
      })
      .catch((err) => {
        setJogError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setIsJogging(false);
      });
  };

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
  const [radiusKm, setRadiusKm] = useState('1');
  const [isRouting, setIsRouting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [result, setResult] = useState<{ distanceKm: number; durationMinutes: number; avoidsArea: boolean } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const step = evacStep(start, destination, route !== null);
  const stepIndex = isEvacuation
    ? step === 'start'
      ? 0
      : step === 'destination'
        ? 1
        : step === 'avoid'
          ? 2
          : 3
    : step === 'start'
      ? 0
      : step === 'destination'
        ? 1
        : 2;
  const durationNoun =
    (isEvacuation ? TRAVEL_COSTINGS[0] : TRAVEL_COSTINGS.find((c) => c.id === travelMode) ?? TRAVEL_COSTINGS[0])
      .durationNoun;

  // Escape disarms map picking. (Avoid-draw cancellation, including
  // preview cleanup, lives in the map components next to the draw state.)
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
    costing: TravelCosting,
  ) => {
    setIsRouting(true);
    setResult(null);
    setError(null);
    setTrafficAdjustment(null);
    try {
      const ring = avoid ? circleToRing(avoid) : null;
      const route = await routeWithOptions(from, to, { avoidRing: ring, costing });
      const verdict = ring
        ? turf.booleanDisjoint(
            turf.lineString(route.path.map((point) => [point.lon, point.lat])),
            turf.polygon([ring.map((point) => [point.lon, point.lat])]),
          )
        : true;
      setEvacuationRoute({ ...route, avoidsArea: verdict });
      setResult({ distanceKm: route.distanceKm, durationMinutes: route.durationMinutes, avoidsArea: verdict });
      // Deterministic traffic adjustment from real TomTom flow speeds —
      // never blocks routing and never presented as prediction/AI. Falls
      // back to the base duration when Traffic data is unavailable.
      const trafficKey = tomtomApiKey();
      if (trafficKey && useTrafficStore.getState().status === 'ok') {
        trafficAdjustedMinutes(route.path, route.durationMinutes, trafficKey)
          .then((adjustment) => {
            if (adjustment && adjustment.factor > 1.02) setTrafficAdjustment(adjustment);
          })
          .catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRouting(false);
    }
  };

  const handleGuidedRoute = () => {
    if (!start || !destination) return;
    setJogLoop(null);
    // Evacuation is always driving; general navigation uses the selector.
    void submitRoute(start, destination, isEvacuation ? avoidCircle : null, isEvacuation ? 'auto' : travelMode);
  };

  const handleManualRoute = () => {
    try {
      const from = { lon: parseCoordinate(fromLon, 'Start longitude', -180, 180), lat: parseCoordinate(fromLat, 'Start latitude', -90, 90) };
      const to = { lon: parseCoordinate(toLon, 'End longitude', -180, 180), lat: parseCoordinate(toLat, 'End latitude', -90, 90) };
      // Valhalla rejects exclusion polygons over 10 km in circumference
      // (~1.59 km radius), so the manual radius is capped the same as the
      // draw tool instead of failing server-side.
      const avoid: EvacCircle = {
        lon: parseCoordinate(avoidLon, 'Avoid longitude', -180, 180),
        lat: parseCoordinate(avoidLat, 'Avoid latitude', -90, 90),
        radiusKm: parseCoordinate(radiusKm, 'Avoid radius (max 1.5 km per Valhalla limits)', 0.1, 1.5),
      };
      setAvoidCircle(avoid);
      void submitRoute(from, to, avoid, 'auto');
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
      title={isEvacuation ? 'Evacuation routing' : 'Navigation'}
      icon={<Navigation className="h-3.5 w-3.5" />}
      initialPosition={{ x: 350, y: 96 }}
      bubbleLabel={isEvacuation ? 'Evacuation routing' : 'Navigation'}
    >
      <div>
        <ol className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px]">
          {steps.map((label, index) => (
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
              {index < steps.length - 1 && <span className={isBrightBasemap ? 'text-slate-400' : 'text-slate-500'}>→</span>}
            </li>
          ))}
        </ol>
        <p className={`mb-3 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
          {isEvacuation || step !== 'avoid' ? EVAC_STEP_INSTRUCTIONS[step] : 'Both points set — press Find route'}
        </p>

        {!isEvacuation && (
          <div className="mb-3 flex rounded-xl bg-white/[0.04] p-1 text-[11px]" role="group" aria-label="Travel mode">
            {TRAVEL_COSTINGS.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setTravelMode(mode.id)}
                aria-pressed={travelMode === mode.id}
                className={`flex-1 rounded-lg py-1.5 transition ${travelMode === mode.id ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-700 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        )}

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

        {isEvacuation && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDrawAvoidArmed(!drawAvoidArmed)}
                aria-pressed={drawAvoidArmed}
                title="Draw a circular avoid zone on the map (Esc cancels)"
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-medium transition ${drawAvoidArmed ? 'border-[#5500a4] bg-[#5500a4] text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
              >
                <ShieldAlert className="h-4 w-4" aria-hidden />
                {drawAvoidArmed ? 'Drawing… click-drag on the map' : 'Draw avoid area'}
              </button>
              {avoidCircle && (
                <button
                  type="button"
                  onClick={clearAvoidCircle}
                  aria-label="Remove avoid zone"
                  title={`Remove avoid zone (${avoidCircle.radiusKm.toFixed(1)} km)`}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {avoidCircle && (
              <p className={`mb-3 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
                Avoid zone: {avoidCircle.radiusKm.toFixed(1)} km radius
              </p>
            )}
          </>
        )}

        {isEvacuation && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setManualOpen(!manualOpen)}
              aria-expanded={manualOpen}
              className={`flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[11px] transition hover:bg-white/[0.06] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}
            >
              <span>Enter coordinates manually</span>
              <span aria-hidden>{manualOpen ? '▴' : '▾'}</span>
            </button>
          </div>
        )}
        {isEvacuation && manualOpen && (
          <>
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

            <div className="mb-3">
              <button
                onClick={handleManualRoute}
                disabled={isRouting}
                title="Route from the manual coordinate fields above"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-medium text-slate-300 hover:bg-white/10 disabled:opacity-60"
              >
                {isRouting ? 'Requesting route…' : 'Route from these coordinates'}
              </button>
            </div>
          </>
        )}

        <button
          onClick={handleGuidedRoute}
          disabled={isRouting || !start || !destination}
          title={!start || !destination ? 'Set start and destination first' : isEvacuation ? 'Find evacuation route' : 'Find route'}
          className="w-full rounded-xl bg-[#5500a4] py-2 text-[12.5px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {isRouting ? 'Requesting route…' : isEvacuation ? 'Find evacuation route' : 'Find route'}
        </button>

        {!isEvacuation && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className={`mb-2 text-[11px] font-medium uppercase tracking-wide ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
              Jogging loop
            </p>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex-1">
                <label className={labelClass}>Target distance (km)</label>
                <input
                  value={jogTargetKm}
                  onChange={(e) => setJogTargetKm(e.target.value)}
                  inputMode="decimal"
                  placeholder="5"
                  aria-label="Jogging loop target distance in kilometers"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-1 flex-col">
                <span className={labelClass}>Terrain</span>
                <div className="flex rounded-xl bg-white/[0.04] p-1 text-[11px]" role="group" aria-label="Loop hilliness">
                  {(['flat', 'hilly'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setJogHilliness(option)}
                      aria-pressed={jogHilliness === option}
                      className={`flex-1 rounded-lg py-1.5 capitalize transition ${jogHilliness === option ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-700' : 'text-slate-300'}`}
                    >
                      {option === 'flat' ? 'Flatter' : 'Hillier'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={handleJogLoop}
              disabled={isJogging}
              title="Generate a walking loop from the start pin (or map center)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
            >
              {isJogging ? 'Planning loop…' : 'Generate loop'}
            </button>
            <p className={`mt-1.5 font-mono text-[10px] ${isBrightBasemap ? 'text-slate-500' : 'text-slate-400'}`}>
              Starts/ends at {start ? 'the start pin' : 'map center'} · footpaths preferred
            </p>
            {jogLoop && (
              <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[12px]">
                <p className={`font-mono ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
                  {jogLoop.distanceKm.toFixed(1)} km loop · {jogLoop.durationMinutes.toFixed(0)} min on foot
                </p>
                <p className={`mt-0.5 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
                  Target was {jogLoop.targetKm.toFixed(1)} km · {jogLoop.hilliness === 'flat' ? 'flatter' : 'hillier'} route
                </p>
                <button
                  onClick={() => {
                    setJogLoop(null);
                    setJogError(null);
                  }}
                  className={`mt-2 text-[11px] underline ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}
                >
                  Clear loop
                </button>
              </div>
            )}
            {jogError && (
              <p className="mt-2 rounded-lg border border-[#FF9F1C]/30 bg-[#FF9F1C]/10 px-3 py-2 text-[11px] text-[#ffc46b]">
                {jogError}
              </p>
            )}
          </div>
        )}

        {isEvacuation && route && (          <div
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium ${
              route.avoidsArea ? 'bg-[#00d890]/15 text-[#00d890]' : 'bg-[#FF9F1C]/15 text-[#FF9F1C]'
            }`}
          >
            {route.avoidsArea ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden /> Route avoids marked area
              </>
            ) : (
              <>
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Route intersects avoid zone
              </>
            )}
          </div>
        )}

        {result && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[12px]">
            <p className={`font-mono ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
              {result.distanceKm.toFixed(1)} km · {result.durationMinutes.toFixed(0)} min {durationNoun}
            </p>
            {trafficAdjustment && (
              <p className={`mt-1 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
                ≈{trafficAdjustment.adjustedMinutes.toFixed(0)} min with current traffic ({trafficAdjustment.samples}{' '}
                samples)
              </p>
            )}
            {isEvacuation && (
              <p className={`mt-1 flex items-center gap-1.5 ${result.avoidsArea ? 'text-[#00d890]' : 'text-[#FF9F1C]'}`}>
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {result.avoidsArea
                  ? 'Route avoids the area'
                  : 'Route enters the area — widen the radius and retry'}
              </p>
            )}
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
          Valhalla demo server · max 1 request/sec · {isEvacuation ? 'driving' : (TRAVEL_COSTINGS.find((c) => c.id === travelMode)?.label.toLowerCase() ?? 'driving')}
        </p>
      </div>
    </FloatingPanel>
  );
}
