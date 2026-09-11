import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid2x2, Ruler, X, Move3d, Printer, Satellite, Link2, Copy, MapPin, ChevronsLeft, ChevronsRight, Telescope } from 'lucide-react';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useMapStore } from '../../../features/map/store';
import { downloadA0Png, exportA0Png } from '../../../features/export/print/a0Export';
import { bearingDegrees, formatBearing, formatDistanceKilometers, geodesicKilometers } from '../geodetic/measurements/distance';
import { formatAreaSqMeters, geodesicAreaSqMeters } from '../geodetic/measurements/area';
import { useSurveyStore } from '../store';
import { useEdgeDock } from '../../../hooks/useEdgeDock';
import type { AppMode } from '../../../types';

const SURVEY_DOCK_KEY = 'terravision.survey-toolbar.dock';
const SURVEY_COLLAPSED_KEY = 'terravision.survey-toolbar.collapsed';
const SURVEY_Y_KEY = 'terravision.survey-toolbar.y';
/** Clearance kept above/below the viewport edge when sliding. */
const SLIDE_EDGE_MARGIN = 8;

function readToolbarCollapsed(): boolean {
  try {
    return localStorage.getItem(SURVEY_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function readToolbarYOffset(): number {
  try {
    const raw = localStorage.getItem(SURVEY_Y_KEY);
    if (raw === null) return -40;
    const num = Number(raw);
    return Number.isFinite(num) ? num : -40;
  } catch {
    return -40;
  }
}

interface ModeDocksProps {
  activeMode: AppMode;
}

export function ModeDocks({ activeMode }: ModeDocksProps) {
  const isBrightBasemap = useBrightBasemap();
  const snapToGrid = useMapStore((s) => s.snapToGrid);
  const setSnapToGrid = useMapStore((s) => s.setSnapToGrid);
  const measureActive = useMapStore((s) => s.measureActive);
  const measurePoints = useMapStore((s) => s.measurePoints);
  const measureMode = useMapStore((s) => s.measureMode);
  const setMeasureMode = useMapStore((s) => s.setMeasureMode);
  const measureClosed = useMapStore((s) => s.measureClosed);
  const setMeasureClosed = useMapStore((s) => s.setMeasureClosed);
  const setMeasureActive = useMapStore((s) => s.setMeasureActive);
  const clearMeasure = useMapStore((s) => s.clearMeasure);
  const showDatumViz = useMapStore((s) => s.showDatumViz);
  const setShowDatumViz = useMapStore((s) => s.setShowDatumViz);
  const viewMode = useMapStore((s) => s.viewMode);
  const center = useMapStore((s) => s.center);
  const zoom = useMapStore((s) => s.zoom);
  const basemap = useMapStore((s) => s.basemap);
  const satelliteSource = useMapStore((s) => s.satelliteSource);
  const streetsSource = useMapStore((s) => s.streetsSource);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  // Survey-specific state
  const gpsTracking = useSurveyStore((s) => s.gpsTracking);
  const gpsAccuracy = useSurveyStore((s) => s.gpsAccuracy);
  const gpsError = useSurveyStore((s) => s.gpsError);
  const setGpsTracking = useSurveyStore((s) => s.setGpsTracking);
  const setGpsPosition = useSurveyStore((s) => s.setGpsPosition);
  const setGpsError = useSurveyStore((s) => s.setGpsError);
  const encodeSessionToUrl = useSurveyStore((s) => s.encodeSessionToUrl);
  const generateSessionId = useSurveyStore((s) => s.generateSessionId);
  const datumVizOpen = useSurveyStore((s) => s.datumVizOpen);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // Edge-dock + drag-to-snap via the shared hook (same implementation the
  // notch sidebar uses — same snap zones, same z-index constants, same
  // persistence approach). Collapse is click-toggled here (not hover/pin),
  // per the toolbar spec. Default side is right so the two edge docks
  // don't stack on top of each other out of the box.
  const { left, dragging, dragSide, dragHandleProps } = useEdgeDock({
    dockKey: SURVEY_DOCK_KEY,
    defaultSide: 'right',
  });
  const [collapsed, setCollapsed] = useState(readToolbarCollapsed);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SURVEY_COLLAPSED_KEY, String(next));
      } catch {
        // persistence is a nicety — the toggle still works for the session
      }
      return next;
    });
  }, []);

  // Vertical slide-along-edge: pixel offset from the vertical center,
  // applied via `top: calc(50% + offset)` so the shared -translate-y-1/2
  // class is untouched. Horizontal position never changes here — the
  // edge pin (left-0/right-0) stays put for the whole gesture.
  const [yOffset, setYOffset] = useState(readToolbarYOffset);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideStartRef = useRef<{ pointerY: number; offset: number } | null>(null);

  const clampYOffset = useCallback((value: number) => {
    const height = containerRef.current?.offsetHeight ?? 0;
    const maxTravel = Math.max(0, (window.innerHeight - height) / 2 - SLIDE_EDGE_MARGIN);
    return Math.min(maxTravel, Math.max(-maxTravel, value));
  }, []);

  const persistYOffset = useCallback((value: number) => {
    try {
      localStorage.setItem(SURVEY_Y_KEY, String(Math.round(value)));
    } catch {
      // persistence is a nicety
    }
  }, []);

  const handleA0Export = async () => {
    if (viewMode !== '2d') {
      setExportNote('Switch to 2D Map to export — A0 renders the 2D view');
      return;
    }
    setExportNote(null);
    setIsExporting(true);
    try {
      const blob = await exportA0Png(center[0], center[1], zoom, basemap, satelliteSource, streetsSource, setExportNote);
      downloadA0Png(blob, basemap, zoom);
      setExportNote(`Saved ${(blob.size / 1048576).toFixed(1)} MB PNG`);
    } catch (err) {
      setExportNote(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  // GPS tracking effect
  useEffect(() => {
    if (!gpsTracking) return;
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported');
      setGpsTracking(false);
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsPosition([pos.coords.longitude, pos.coords.latitude], pos.coords.accuracy);
        // Also update map center to follow GPS
        useMapStore.getState().setCenter([pos.coords.longitude, pos.coords.latitude]);
      },
      (err) => {
        // Stop first, then report: setGpsTracking preserves an existing
        // error when stopping, so the message below survives.
        setGpsTracking(false);
        setGpsError(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsTracking, setGpsTracking, setGpsPosition, setGpsError]);

  // Sync datum viz open state with map store
  useEffect(() => {
    setShowDatumViz(datumVizOpen);
  }, [datumVizOpen, setShowDatumViz]);

  // Escape exits measure mode (and clears the line) from either map.
  useEffect(() => {
    if (!measureActive) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMeasureActive(false);
        clearMeasure();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [measureActive, setMeasureActive, clearMeasure]);

  const measuredKm = measureMode === 'distance' ? geodesicKilometers(measurePoints) : null;
  const lastSegmentBearing =
    measureMode === 'distance' && measurePoints.length >= 2
      ? formatBearing(bearingDegrees(measurePoints[measurePoints.length - 2], measurePoints[measurePoints.length - 1]))
      : null;
  const measuredArea = measureMode === 'area' && measureClosed ? geodesicAreaSqMeters(measurePoints) : null;

  const handleShareClick = useCallback(() => {
    const url = encodeSessionToUrl(window.location.origin + window.location.pathname);
    setShareUrl(url);
    // Clipboard may reject (permissions/headless) — the link stays visible
    // in the dock either way, so sharing never silently fails.
    try {
      const result = navigator.clipboard.writeText(url);
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => {});
      }
    } catch {
      // ignore — link remains visible for manual copy
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }, [encodeSessionToUrl]);

  const handleNewSession = useCallback(() => {
    generateSessionId();
    setShareUrl(null);
    setShareCopied(false);
    // Clear measurement points
    clearMeasure();
    setMeasureActive(false);
  }, [generateSessionId, clearMeasure, setMeasureActive]);

  const handleMeasureCsvExport = useCallback(() => {
    const rows = measurePoints.map(([lon, lat], i) => {
      const cumulativeKm = geodesicKilometers(measurePoints.slice(0, i + 1)) ?? 0;
      return `${i},${lon.toFixed(6)},${lat.toFixed(6)},${cumulativeKm.toFixed(3)}`;
    });
    const areaLine =
      measureMode === 'area' && measureClosed
        ? `# area_m2,${(geodesicAreaSqMeters(measurePoints) ?? 0).toFixed(1)}\n`
        : '';
    const csv = `index,lon,lat,cumulative_km\n${rows.join('\n')}\n${areaLine}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'terravision-measurement.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [measurePoints, measureMode, measureClosed]);

  const toolbarTools = (
    <>
      <button
        onClick={() => setSnapToGrid(!snapToGrid)}
        aria-pressed={snapToGrid}
        title="Snap to the UTM 51N meter grid — map center and measure points (2D and Vector maps)"
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition max-md:w-full max-md:justify-center ${snapToGrid ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
      >
        <Grid2x2 className="h-3.5 w-3.5 shrink-0" />
        Snap to grid
      </button>
      <button
        onClick={() => {
          if (measureActive) {
            setMeasureActive(false);
            clearMeasure();
          } else {
            setMeasureActive(true);
          }
        }}
        aria-pressed={measureActive}
        title={
          measureMode === 'area'
            ? 'Measure geodesic area: click vertices, then click the first point or Finish to close (Esc exits)'
            : 'Measure geodesic distance: keep clicking to add segments (Esc exits)'
        }
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition max-md:w-full max-md:justify-center ${measureActive ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
      >
        <Ruler className="h-3.5 w-3.5 shrink-0" />
        Measure geodesic
      </button>
      <div
        className="flex rounded-xl bg-white/[0.04] p-1 text-[11px] max-md:col-span-2 max-md:w-full max-md:justify-center md:justify-center"
        role="group"
        aria-label="Measure mode"
      >
        {(['distance', 'area'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setMeasureMode(mode)}
            aria-pressed={measureMode === mode}
            title={mode === 'distance' ? 'Path distance across all segments' : 'Enclosed polygon area'}
            className={`flex-1 rounded-lg px-2.5 py-1.5 capitalize transition max-md:flex-1 ${measureMode === mode ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
          >
            {mode}
          </button>
        ))}
      </div>
      <button
        onClick={() => setShowDatumViz(!showDatumViz)}
        aria-pressed={showDatumViz}
        title="Show the datum shift visualization panel"
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition max-md:w-full max-md:justify-center ${showDatumViz ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
      >
        <Move3d className="h-3.5 w-3.5 shrink-0" />
        Datum shift viz
      </button>
      {/* Live GPS tracking — uses browser Geolocation API (free, no key) */}
      <button
        onClick={() => setGpsTracking(!gpsTracking)}
        aria-pressed={gpsTracking}
        disabled={gpsError !== null && !gpsTracking}
        title={
          gpsTracking
            ? `Live GPS tracking active — accuracy ${gpsAccuracy ? `${Math.round(gpsAccuracy)}m` : '?'} — click to stop`
            : gpsError
              ? `GPS error: ${gpsError} — click to retry`
              : 'Start live GPS tracking (uses device location)'
        }
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition max-md:w-full max-md:justify-center ${gpsTracking ? 'bg-[#00d890]/20 text-[#00d890] border border-[#00d890]/30' : gpsError ? 'text-[#E63946] hover:text-[#E63946]' : isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
      >
        <Satellite className="h-3.5 w-3.5 shrink-0" />
        {gpsTracking ? 'GPS live' : gpsError ? 'GPS error' : 'Live GPS'}
      </button>
      {/* Shareable session link */}
      <button
        onClick={handleShareClick}
        aria-label={shareCopied ? 'Copied!' : 'Copy shareable survey session link'}
        title={shareCopied ? 'Link copied to clipboard' : 'Copy a link that restores this survey session (view, measurements, tools)'}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition max-md:w-full max-md:justify-center ${shareCopied ? 'bg-[#00d890]/20 text-[#00d890] border border-[#00d890]/30' : isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
      >
        <Link2 className="h-3.5 w-3.5 shrink-0" />
        {shareCopied ? <Copy className="h-3.5 w-3.5" /> : 'Share session'}
      </button>
      {/* New session button */}
      <button
        onClick={handleNewSession}
        aria-label="Start new survey session"
        title="Clear all measurements and generate a new session ID"
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition max-md:w-full max-md:justify-center ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        New session
      </button>
      <button
        onClick={() => void handleA0Export()}
        disabled={isExporting}
        title="Download the current 2D view as an A0-size PNG (2D Map view only)"
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition disabled:opacity-60 max-md:w-full max-md:justify-center ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
      >
        <Printer className={`h-3.5 w-3.5 shrink-0 ${isExporting ? 'animate-pulse' : ''}`} />
        {isExporting ? (exportNote ?? 'Exporting…') : 'A0 export'}
      </button>
    </>
  );

  // Measurement status: its own row above the tools when
  // measuring (or when a note/link needs display).
  const toolbarStatus = (
    <>
            {measureMode === 'distance' && measurePoints.length > 0 && (
              <span className={`px-2 py-1 text-center font-mono text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
                {formatDistanceKilometers(measuredKm)}
                {lastSegmentBearing ? ` · ${lastSegmentBearing}` : ''}
              </span>
            )}
            {measureMode === 'area' && measurePoints.length > 0 && (
              <span className={`px-2 py-1 text-center font-mono text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
                {measureClosed
                  ? formatAreaSqMeters(measuredArea)
                  : `${measurePoints.length} vertices — click the first point or Finish to close`}
              </span>
            )}
            {measureMode === 'area' && measureActive && !measureClosed && measurePoints.length >= 3 && (
              <button
                type="button"
                onClick={() => setMeasureClosed(true)}
                title="Close the polygon and compute its area"
                className={`rounded-xl px-3 py-2 text-[11px] font-medium transition ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
              >
                Finish
              </button>
            )}
            {measurePoints.length > 0 && (
              <button
                onClick={() => {
                  clearMeasure();
                  setMeasureActive(false);
                }}
                aria-label="Clear measurement"
                title="Clear measurement"
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {measurePoints.length > 0 && (
              <button
                type="button"
                onClick={handleMeasureCsvExport}
                title="Download measurement points and totals as CSV"
                className={`rounded-xl px-3 py-2 font-mono text-[11px] transition ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
              >
                CSV
              </button>
            )}
            {exportNote && !isExporting && (
              <span className={`px-3 py-1 text-center font-mono text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>{exportNote}</span>
            )}
            {shareUrl && !shareCopied && (
              <span className={`truncate px-2 py-1 text-center font-mono text-[10px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`} title={shareUrl}>
                {shareUrl.slice(0, 50)}…
              </span>
            )}
    </>
  );

  // Status row shows only while there is something to report.
  const hasStatus =
    measurePoints.length > 0 || !!(exportNote && !isExporting) || !!(shareUrl && !shareCopied);

  return (
    <>
      <AnimatePresence>
        {activeMode === 'survey' && (
          <>
            {/* Snap-zone indicators while dragging — same zones, same
                z-index (z-40) as the notch sidebar. Left/right only. */}
            <div
              aria-hidden
              className={`pointer-events-none fixed bottom-0 left-0 top-0 z-40 w-16 transition-opacity duration-150 ${dragging ? 'opacity-100' : 'opacity-0'} ${dragSide === 'left' ? 'bg-[#5500a4]/30' : 'bg-[#5500a4]/15'}`}
            />
            <div
              aria-hidden
              className={`pointer-events-none fixed bottom-0 right-0 top-0 z-40 w-16 transition-opacity duration-150 ${dragging ? 'opacity-100' : 'opacity-0'} ${dragSide === 'right' ? 'bg-[#5500a4]/30' : 'bg-[#5500a4]/15'}`}
            />
            {/* Edge-docked toolbar: single vertical anchor (top-1/2) shared
                by expanded and collapsed states, flush to the docked side
                edge (left-0/right-0), z-30 — the exact notch sidebar
                values. Vertically centered + max-h keeps it clear of the
                footer in every state. Expand/collapse crossfades (no
                geometry animation), so the height can never spike. */}
            <motion.div
              ref={containerRef}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              style={{ top: `calc(50% + ${yOffset}px)` }}
              className={`glass-strong fixed z-30 flex max-h-[min(70vh,calc(100dvh-8rem))] -translate-y-1/2 flex-col items-center justify-center overflow-hidden py-2 max-md:max-h-[min(60vh,calc(100dvh-10rem))] ${left ? 'left-0 rounded-l-none pl-2 pr-1.5' : 'right-0 rounded-r-none pl-1.5 pr-2'} ${
                collapsed
                  ? 'w-[52px] ' + (left ? 'rounded-r-[22px]' : 'rounded-l-[22px]')
                  : 'w-max max-w-[85vw] max-md:fixed max-md:inset-x-3 max-md:w-auto max-md:rounded-2xl ' +
                    (left ? 'rounded-r-[20px] md:rounded-r-[20px]' : 'rounded-l-[20px] md:rounded-l-[20px]')
              }`}
            >
              {/* Drag handle: slim full-height strip on the edge-facing
                  side with a reserved gutter, matching the notch
                  sidebar — never overlaps content in either state. */}
              <div
                role="separator"
                aria-label={`Drag to dock ${left ? 'right' : 'left'} or slide vertically`}
                title="Drag to dock left/right or slide up/down"
                className={`absolute inset-y-0 z-10 flex w-[8px] cursor-grab touch-none items-center justify-center bg-white/[0.04] transition-colors hover:bg-white/10 active:cursor-grabbing ${left ? 'left-0' : 'right-0'}`}
                {...dragHandleProps}
                onPointerDown={(e) => {
                  dragHandleProps.onPointerDown(e);
                  slideStartRef.current = { pointerY: e.clientY, offset: yOffset };
                }}
                onPointerMove={(e) => {
                  dragHandleProps.onPointerMove(e);
                  const start = slideStartRef.current;
                  if (start) setYOffset(clampYOffset(start.offset + (e.clientY - start.pointerY)));
                }}
                onPointerUp={(e) => {
                  dragHandleProps.onPointerUp(e);
                  slideStartRef.current = null;
                  setYOffset((prev) => {
                    const clamped = clampYOffset(prev);
                    persistYOffset(clamped);
                    return clamped;
                  });
                }}
                onPointerCancel={() => {
                  dragHandleProps.onPointerCancel();
                  slideStartRef.current = null;
                }}
              >
                <span className="flex flex-col items-center gap-1" aria-hidden>
                  <span className="h-[3px] w-[3px] rounded-full bg-white/30" />
                  <span className="h-[3px] w-[3px] rounded-full bg-white/30" />
                  <span className="h-[3px] w-[3px] rounded-full bg-white/30" />
                </span>
              </div>
              {collapsed ? (
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  title="Expand survey toolbar"
                  aria-label="Expand survey toolbar"
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-white/10 ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                >
                  {/* Telescope: closest surveying-instrument glyph in the
                      project's lucide set (no theodolite/total-station
                      icon exists there) — no new dependency. */}
                  <Telescope className="h-5 w-5" aria-hidden />
                </button>
              ) : null}
              {!collapsed ? (
                <>
                  {/* Mobile: 2-col grid for symmetry; desktop: flex-wrap centered with breathing room for collapse button */}
                  <div
                    className={`grid max-h-[40vh] w-full max-w-[85vw] grid-cols-2 gap-1.5 overflow-y-auto px-8 py-2 max-md:max-w-[85vw] md:flex md:max-w-[85vw] md:flex-wrap md:items-center md:justify-center md:gap-1 md:py-1 ${left ? 'md:pl-2 md:pr-10' : 'md:pl-10 md:pr-2'}`}
                  >
                    {toolbarTools}
                  </div>
                  {hasStatus ? (
                    <div className="flex w-full flex-wrap items-center justify-center gap-1 px-3 pt-1">
                      {toolbarStatus}
                    </div>
                  ) : null}
                  {/* Collapse control — below tools on mobile (symmetric), edge on desktop */}
                  <button
                    type="button"
                    onClick={toggleCollapsed}
                    title="Collapse toolbar"
                    aria-label="Collapse toolbar"
                    className={`mt-2 flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-white/10 md:absolute md:top-1/2 md:mt-0 md:-translate-y-1/2 ${left ? 'md:right-1' : 'md:left-1'} ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                  >
                    {left ? <ChevronsLeft className="h-3.5 w-3.5" aria-hidden /> : <ChevronsRight className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                </>
              ) : null}

          </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
