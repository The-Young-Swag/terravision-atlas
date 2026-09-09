import { Layers, Satellite, Map as MapIcon, Mountain, Moon, Check, RotateCcw, Info, X } from 'lucide-react';
import { FloatingPanel } from '../common/FloatingPanel';

import { TrafficLegend } from './TrafficLegend';
import { useMapStore } from '../../../stores/mapStore';
import { STREETS_SOURCES } from '../../../core/map/streets';
import { useTrafficStore } from '../../../stores/trafficStore';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { GIBS_LAYERS, type SatelliteSourceId } from '../../../core/map/gibs';
import { useTiltStore } from '../../../stores/tiltStore';
import { BasemapIcon } from './BasemapIcon';
import {
  TILT_MAX_DEGREES,
  cesiumTiltDegrees,
  maplibreTiltDegrees,
  resetCesiumTiltToTopDown,
  resetMapLibreTiltToTopDown,
  setCesiumTiltDegrees,
  setMapLibreTiltDegrees,
} from '../../../core/map/tilt';
import { useEffect, useMemo, useState } from 'react';

const SATELLITE_SOURCES: { id: SatelliteSourceId; label: string; desc: string }[] = [
  { id: 'esri', label: 'Esri World Imagery', desc: 'High-res mosaic · default' },
  ...GIBS_LAYERS.map((l) => ({ id: l.id, label: l.label, desc: l.desc })),
];

export function LayersPanel() {
  const basemap = useMapStore((s) => s.basemap);
  const satelliteSource = useMapStore((s) => s.satelliteSource);
  const streetsSource = useMapStore((s) => s.streetsSource);
  const viewMode = useMapStore((s) => s.viewMode);
  const showHazards = useMapStore((s) => s.showHazards);
  const showTerrainContours = useMapStore((s) => s.showTerrainContours);
  const showTraffic = useMapStore((s) => s.showTraffic);
  const center = useMapStore((s) => s.center);
  const zoom = useMapStore((s) => s.zoom);
  const setBasemap = useMapStore((s) => s.setBasemap);
  const setSatelliteSource = useMapStore((s) => s.setSatelliteSource);
  const setStreetsSource = useMapStore((s) => s.setStreetsSource);
  const setViewMode = useMapStore((s) => s.setViewMode);
  const setShowHazards = useMapStore((s) => s.setShowHazards);
  const setShowTerrainContours = useMapStore((s) => s.setShowTerrainContours);
  const setShowTraffic = useMapStore((s) => s.setShowTraffic);
  const trafficStatus = useTrafficStore((s) => s.status);

  const isBrightBasemap = useBrightBasemap();

  // Camera tilt slider: live pitch kept in sync, but while dragging we
  // drive from a local draft so the thumb doesn't fight the live readback.
  // 3D help popup shows once when entering 3D and can be reopened via (i).
  const cesiumViewer = useTiltStore((s) => s.cesium) as Parameters<typeof cesiumTiltDegrees>[0] | null;
  const maplibreMap = useTiltStore((s) => s.maplibre) as Parameters<typeof maplibreTiltDegrees>[0] | null;
  const showTiltSlider = viewMode === '3d' || viewMode === 'vector';
  const tilt =
    viewMode === '3d'
      ? cesiumTiltDegrees(cesiumViewer)
      : viewMode === 'vector'
        ? maplibreTiltDegrees(maplibreMap)
        : 0;
  const [isDraggingTilt, setIsDraggingTilt] = useState(false);
  const [tiltDraft, setTiltDraft] = useState<number | null>(null);
  const displayTilt = isDraggingTilt && tiltDraft !== null ? tiltDraft : Math.round(tilt);
  const applyTilt = (degrees: number) => {
    if (viewMode === '3d') setCesiumTiltDegrees(cesiumViewer, degrees);
    else if (viewMode === 'vector') setMapLibreTiltDegrees(maplibreMap, degrees);
  };
  const resetTilt = () => {
    if (viewMode === '3d') resetCesiumTiltToTopDown(cesiumViewer);
    else if (viewMode === 'vector') resetMapLibreTiltToTopDown(maplibreMap);
  };
  const TILT_HELP_KEY = 'terravision.tiltHelpSeen';
  const [showTiltHelp, setShowTiltHelp] = useState(false);
  useEffect(() => {
    if (viewMode === '3d') {
      try {
        if (!localStorage.getItem(TILT_HELP_KEY)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time help on entering 3D
          setShowTiltHelp(true);
        }
      } catch {
        setShowTiltHelp(true);
      }
    } else {
      setShowTiltHelp(false);
    }
  }, [viewMode]);
  const dismissTiltHelp = () => {
    setShowTiltHelp(false);
    try {
      localStorage.setItem(TILT_HELP_KEY, '1');
    } catch {
      // ignore storage errors
    }
  };

  const centerLabel = useMemo(() => {
    const [lon, lat] = center;
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
  }, [center]);

  return (
    <FloatingPanel
      id="layers"
      title="Layers"
      icon={<Layers className="h-3.5 w-3.5" />}
      initialPosition={{ x: 16, y: 96 }}
      bubbleLabel="Layers"
    >
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className={`text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-500'}`}>Basemap</p>
          <button
            onClick={() => {
              setBasemap('satellite');
              setShowHazards(true);
            }}
            className={`text-[12px] ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
          >
            Reset
          </button>
        </div>

        <div className="mb-4 space-y-1.5">
          {(
            [
              {
                id: 'satellite' as const,
                label: 'Satellite',
                desc: SATELLITE_SOURCES.find((s) => s.id === satelliteSource)?.label ?? 'Esri World Imagery',
                icon: Satellite,
              },
              {
                id: 'streets' as const,
                label: 'Streets',
                desc: STREETS_SOURCES.find((s) => s.id === streetsSource)?.label ?? 'OpenStreetMap',
                icon: MapIcon,
              },
              {
                id: 'terrain' as const,
                label: 'Terrain',
                desc: 'Esri World Topo',
                icon: Mountain,
              },
              {
                id: 'dark' as const,
                label: 'Dark',
                desc: 'Stadia Dark',
                icon: Moon,
              },
            ] as const
          ).map((option) => {
            const isActive = basemap === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setBasemap(option.id)}
                aria-label={`Basemap ${option.label}`}
                aria-pressed={isActive}
                className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${isActive ? (isBrightBasemap ? 'border-[#5500a4] bg-[#5500a4]/10 text-slate-900' : 'border-[#5500a4] bg-[#5500a4]/10 text-white') : isBrightBasemap ? 'border-white/10 bg-white/[0.04] text-slate-800 hover:text-slate-900' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:text-white'}`}
              >
                <BasemapIcon basemap={option.id} size={32} />
                <span className="flex-1">
                  <span className={`block text-[13px] font-medium leading-none ${isActive ? 'text-[#10B981]' : isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>{option.label}</span>
                  <span className={`block text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>{option.desc}</span>
                </span>
                {isActive ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5500a4] text-white">
                    <Check className="h-3 w-3" />
                  </span>
                ) : (
                  <span className="h-5 w-5 shrink-0 rounded-full border border-white/10 group-hover:border-white/20" />
                )}
              </button>
            );
          })}
        </div>

        {/* Satellite source picker — same selection pattern, shown only for
            the Satellite basemap slot (Esri default + NASA GIBS layers). */}
        {basemap === 'satellite' && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-2">
            <p className={`mb-1.5 px-1 text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-500'}`}>
              NASA GIBS
            </p>
            <div className="space-y-1">
              {SATELLITE_SOURCES.map((source) => {
                const isSourceActive = satelliteSource === source.id;
                return (
                  <button
                    key={source.id}
                    onClick={() => setSatelliteSource(source.id)}
                    aria-label={`Satellite source ${source.label}`}
                    aria-pressed={isSourceActive}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition ${isSourceActive ? (isBrightBasemap ? 'border-[#5500a4] bg-[#5500a4]/10 text-slate-900' : 'border-[#5500a4] bg-[#5500a4]/10 text-white') : isBrightBasemap ? 'border-transparent text-slate-800 hover:bg-white/10' : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'}`}
                  >
                    <span className="flex-1">
                      <span className={`block text-[12px] font-medium leading-tight ${isSourceActive ? 'text-[#10B981]' : ''}`}>
                        {source.label}
                      </span>
                      <span className={`block font-mono text-[10px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>{source.desc}</span>
                    </span>
                    {isSourceActive ? (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#5500a4] text-white">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    ) : (
                      <span className="h-4 w-4 shrink-0 rounded-full border border-white/10" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Streets source picker — same selection pattern as Satellite
            source above, shown only for the Streets basemap slot
            (OpenStreetMap default + Esri alternate). */}
        {basemap === 'streets' && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-2">
            <p className={`mb-1.5 px-1 text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-500'}`}>
              Streets source
            </p>
            <div className="space-y-1">
              {STREETS_SOURCES.map((source) => {
                const isSourceActive = streetsSource === source.id;
                return (
                  <button
                    key={source.id}
                    onClick={() => setStreetsSource(source.id)}
                    aria-label={`Streets source ${source.label}`}
                    aria-pressed={isSourceActive}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition ${isSourceActive ? (isBrightBasemap ? 'border-[#5500a4] bg-[#5500a4]/10 text-slate-900' : 'border-[#5500a4] bg-[#5500a4]/10 text-white') : isBrightBasemap ? 'border-transparent text-slate-800 hover:bg-white/10' : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'}`}
                  >
                    <span className="flex-1">
                      <span className={`block text-[12px] font-medium leading-tight ${isSourceActive ? 'text-[#10B981]' : ''}`}>
                        {source.label}
                      </span>
                      <span className={`block font-mono text-[10px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>{source.desc}</span>
                    </span>
                    {isSourceActive ? (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#5500a4] text-white">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    ) : (
                      <span className="h-4 w-4 shrink-0 rounded-full border border-white/10" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-4 space-y-1">
          {viewMode === '2d' && (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/5">
              <input type="checkbox" checked={showHazards} onChange={(e) => setShowHazards(e.target.checked)} className="rounded" />
              <span className={`text-[13px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>Live hazards</span>
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#E63946]" />
            </label>
          )}
          {(viewMode === '2d' || viewMode === 'vector') && (
            <>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/5">
                <input type="checkbox" checked={showTraffic} onChange={(e) => setShowTraffic(e.target.checked)} className="rounded" />
                <span className={`text-[13px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>Traffic</span>
                <span className={`ml-auto font-mono text-[10px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>TomTom</span>
              </label>
              {showTraffic && trafficStatus === 'unavailable' && (
                <p className={`px-1.5 py-1 text-[11px] ${isBrightBasemap ? 'text-slate-500' : 'text-slate-300'}`}>traffic data unavailable</p>
              )}
              {showTraffic && trafficStatus === 'no-key' && (
                <p className={`px-1.5 py-1 text-[11px] ${isBrightBasemap ? 'text-slate-500' : 'text-slate-300'}`}>traffic unavailable — API key not configured</p>
              )}
              {showTraffic && trafficStatus === 'ok' && (
                <div className="px-1.5 py-1">
                  <TrafficLegend />
                </div>
              )}
            </>
          )}
          {viewMode === 'vector' && (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/5">
              <input type="checkbox" checked={showTerrainContours} onChange={(e) => setShowTerrainContours(e.target.checked)} className="rounded" />
              <span className={`text-[13px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>Terrain contours</span>
              <span className={`ml-auto font-mono text-[10px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>Vector</span>
            </label>
          )}
        </div>

        <div className="border-t border-white/10 pt-3">
          <p className={`mb-2 text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-500'}`}>View</p>
          <div className="glass flex rounded-xl p-1 text-[11px]">
            <button
              onClick={() => setViewMode('2d')}
              className={`flex-1 rounded-lg py-1.5 hover:bg-white/5 ${viewMode === '2d' ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-800' : 'text-slate-300'}`}
            >
              2D Map
            </button>
            <button
              onClick={() => setViewMode('vector')}
              className={`flex-1 rounded-lg py-1.5 hover:bg-white/5 ${viewMode === 'vector' ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-800' : 'text-slate-300'}`}
            >
              Vector
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`flex-1 rounded-lg py-1.5 hover:bg-white/5 ${viewMode === '3d' ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-800' : 'text-slate-300'}`}
            >
              3D Globe
            </button>
          </div>
          {showTiltSlider && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className={`flex items-center gap-1.5 text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
                  Camera tilt
                  <button
                    type="button"
                    onClick={() => setShowTiltHelp((v) => !v)}
                    title="How to tilt"
                    aria-label="Show tilt help"
                    className={`flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[10px] leading-none transition hover:bg-white/20 ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}
                  >
                    <Info className="h-3 w-3" aria-hidden />
                  </button>
                </span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
                    {displayTilt}°
                  </span>
                  <button
                    type="button"
                    onClick={resetTilt}
                    title="Reset to top-down view"
                    aria-label="Reset tilt to top-down"
                    className={`flex h-5 w-5 items-center justify-center rounded transition hover:bg-white/10 ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              </div>
              {showTiltHelp && viewMode === '3d' && (
                <div className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-[#209dd7]/30 bg-[#209dd7]/10 px-3 py-2 text-[11px] leading-relaxed">
                  <p className={`${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
                    <span className="font-semibold">Middle-click + drag</span> to tilt,{' '}
                    <span className="font-semibold">scroll</span> to zoom,{' '}
                    <span className="font-semibold">right-drag</span> to rotate. You can also use the slider.
                  </p>
                  <button
                    type="button"
                    onClick={dismissTiltHelp}
                    aria-label="Dismiss tilt help"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              )}
              <input
                type="range"
                min={0}
                max={TILT_MAX_DEGREES}
                step={1}
                value={displayTilt}
                onPointerDown={() => setIsDraggingTilt(true)}
                onPointerUp={() => {
                  setIsDraggingTilt(false);
                  setTiltDraft(null);
                }}
                onPointerCancel={() => {
                  setIsDraggingTilt(false);
                  setTiltDraft(null);
                }}
                onInput={(e) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  setTiltDraft(v);
                  setIsDraggingTilt(true);
                  applyTilt(v);
                }}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTiltDraft(v);
                  applyTilt(v);
                }}
                aria-label="Camera tilt"
                title={`${viewMode === '3d' ? '3D globe' : 'Vector map'} camera tilt (0° = top-down, ${TILT_MAX_DEGREES}° = near-horizon)`}
                className="h-2 w-full cursor-grab touch-none appearance-none rounded-full bg-white/10 accent-[#5500a4] active:cursor-grabbing"
              />
            </div>
          )}
          <p className={`mt-2 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-500'}`}>
            {centerLabel} · Zoom {zoom.toFixed(1)} · {viewMode === '2d' ? 'OpenLayers' : viewMode === 'vector' ? 'MapLibre' : 'Cesium'}
          </p>
        </div>
      </div>
    </FloatingPanel>
  );
}
