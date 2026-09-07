import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid2x2, Ruler, X, Move3d, Printer, Satellite, Link2, Copy, MapPin, ChevronUp, Grip } from 'lucide-react';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useMapStore } from '../../../stores/mapStore';
import { downloadA0Png, exportA0Png } from '../../../features/export/print/a0Export';
import { bearingDegrees, formatBearing, formatDistanceKilometers, geodesicKilometers } from '../../../core/geodetic/measurements/distance';
import { formatAreaSqMeters, geodesicAreaSqMeters } from '../../../core/geodetic/measurements/area';
import { useSurveyStore } from '../../../stores/surveyStore';

type AppMode = 'explore' | 'monitor' | 'survey';
type DockSide = 'left' | 'right';

const DOCK_STORAGE_KEY = 'terravision.survey-toolbar.dock';
const COLLAPSE_STORAGE_KEY = 'terravision.survey-toolbar.collapsed';

function readDockSide(): DockSide {
  try {
    return localStorage.getItem(DOCK_STORAGE_KEY) === 'left' ? 'left' : 'right';
  } catch {
    return 'right';
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
  } catch {
    return false;
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

  // Collapsible/dockable state — lightweight, no extra hook file
  const [dockSide, setDockSide] = useState<DockSide>(readDockSide);
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const [isDragging, setIsDragging] = useState(false);
  const [snapIndicator, setSnapIndicator] = useState<DockSide | null>(null);
  // Number of dockable buttons (toolbar content) for collapsed icon mapping

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Drag-to-snap: drag the toolbar by its handle; on release snap to nearest
  // vertical edge (left/right only — top/bottom never allowed). The pointer
  // capture and threshold mirror the notch sidebar so the gesture feels
  // the same as the existing established interaction.
  const handleDragPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setSnapIndicator(null);
  };
  const handleDragPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    setSnapIndicator(e.clientX < window.innerWidth / 2 ? 'left' : 'right');
  };
  const handleDragPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    setSnapIndicator(null);
    const side: DockSide = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
    setDockSide(side);
    try { localStorage.setItem(DOCK_STORAGE_KEY, side); } catch { /* ignore */ }
  };
  const handleDragPointerCancel = () => {
    setIsDragging(false);
    setSnapIndicator(null);
  };

  const handleA0Export = async () => {
    if (viewMode !== '2d') {
      setExportNote('Switch to 2D Map to export — A0 renders the 2D view');
      return;
    }
    setExportNote(null);
    setIsExporting(true);
    try {
      const blob = await exportA0Png(center[0], center[1], zoom, basemap, satelliteSource, setExportNote);
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

  // Dock-side positioning — single vertical anchor matching the notch
  // sidebar's pattern. Both expanded and collapsed states share the same
  // vertical anchor (top: 50%, translateY: -50%) so the collapsed icon
  // sits at the same dock position the expanded toolbar occupies. The
  // horizontal buttons remain in their horizontal flex-wrap row (not
  // redesigned as a vertical column). The expanded/collapsed difference
  // is the container width (animated via CSS transition), matching the
  // notch sidebar's width-collapse behavior.
  // Stacking: z-30 to match the notch sidebar's exact value. Snap zones
  // at z-40 (above the toolbar) so the toolbar always sits above the
  // top nav bar (z-20).
  const dockStyle: React.CSSProperties = {
    left: dockSide === 'left' ? 0 : 'auto',
    right: dockSide === 'right' ? 0 : 'auto',
    top: '50%',
    transform: 'translateY(-50%)',
  };

  return (
    <>
      <AnimatePresence>
        {activeMode === 'monitor' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="glass-strong absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-2xl px-2 py-2"
          >
            <span className={`px-3 py-2 text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>Evacuation tools ready — shelter data is community-sourced, coverage varies</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Snap-zone indicators while dragging — left/right only */}
      <div
        aria-hidden
        className={`pointer-events-none fixed bottom-0 left-0 top-0 z-40 w-16 transition-opacity duration-150 ${isDragging ? 'opacity-100' : 'opacity-0'} ${snapIndicator === 'left' ? 'bg-[#5500a4]/30' : 'bg-[#5500a4]/15'}`}
      />
      <div
        aria-hidden
        className={`pointer-events-none fixed bottom-0 right-0 top-0 z-40 w-16 transition-opacity duration-150 ${isDragging ? 'opacity-100' : 'opacity-0'} ${snapIndicator === 'right' ? 'bg-[#5500a4]/30' : 'bg-[#5500a4]/15'}`}
      />

      <AnimatePresence>
        {activeMode === 'survey' && (
          <motion.div
            initial={{ opacity: 0, x: dockSide === 'left' ? -12 : 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dockSide === 'left' ? -12 : 12 }}
            style={dockStyle}
            className={`glass-strong z-30 flex items-center gap-1 rounded-2xl px-2 py-2 max-h-[70vh] ${isCollapsed ? 'flex-col w-12' : 'flex-row flex-wrap max-w-[90vw] justify-center'} ${dockSide === 'left' ? 'notch-dock-left' : 'notch-dock-right'} ${isDragging ? 'transition-none' : 'transition-[width] duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)]'}`}
          >
            {/* Drag handle + collapse/expand button — always present, in
                both collapsed and expanded states, consistent with the notch
                sidebar's drag handle on the edge-facing side. */}
            <button
              type="button"
              onPointerDown={handleDragPointerDown}
              onPointerMove={handleDragPointerMove}
              onPointerUp={handleDragPointerUp}
              onPointerCancel={handleDragPointerCancel}
              title={`Drag to dock ${dockSide === 'left' ? 'right' : 'left'}`}
              aria-label="Drag survey toolbar to dock left or right"
              className={`flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-lg transition active:cursor-grabbing hover:bg-white/10 ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
            >
              <Grip className="h-3.5 w-3.5" aria-hidden />
            </button>

            {/* When collapsed, show a single icon representing the toolbar;
                clicking it expands back. The icon is the Survey Tools (Ruler)
                icon, matching the panel's identity. */}
            {isCollapsed ? (
              <button
                type="button"
                onClick={toggleCollapsed}
                title="Expand survey toolbar"
                aria-label="Expand survey toolbar"
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-white/10 ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
              >
                <Ruler className="h-5 w-5" aria-hidden />
              </button>
            ) : (
              <>
                <button
                  onClick={() => setSnapToGrid(!snapToGrid)}
                  aria-pressed={snapToGrid}
                  title="Snap to the UTM 51N meter grid — map center and measure points (2D and Vector maps)"
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition ${snapToGrid ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                >
                  <Grid2x2 className="h-3.5 w-3.5" />
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
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition ${measureActive ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                >
                  <Ruler className="h-3.5 w-3.5" />
                  Measure geodesic
                </button>
                <div className="flex rounded-xl bg-white/[0.04] p-1 text-[11px]" role="group" aria-label="Measure mode">
                  {(['distance', 'area'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setMeasureMode(mode)}
                      aria-pressed={measureMode === mode}
                      title={mode === 'distance' ? 'Path distance across all segments' : 'Enclosed polygon area'}
                      className={`rounded-lg px-2.5 py-1.5 capitalize transition ${measureMode === mode ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                {measureMode === 'distance' && measurePoints.length > 0 && (
                  <span className={`px-2 py-2 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
                    {formatDistanceKilometers(measuredKm)}
                    {lastSegmentBearing ? ` · ${lastSegmentBearing}` : ''}
                  </span>
                )}
                {measureMode === 'area' && measurePoints.length > 0 && (
                  <span className={`px-2 py-2 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
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
                <button
                  onClick={() => setShowDatumViz(!showDatumViz)}
                  aria-pressed={showDatumViz}
                  title="Show the datum shift visualization panel"
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition ${showDatumViz ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                >
                  <Move3d className="h-3.5 w-3.5" />
                  Datum shift viz
                </button>
                {/* Live GPS tracking — uses browser Geolocation API (free, no key) */}
                <button
                  onClick={() => setGpsTracking(!gpsTracking)}
                  aria-pressed={gpsTracking}
                  disabled={gpsError !== null && !gpsTracking}
                  title={gpsTracking
                    ? `Live GPS tracking active — accuracy ${gpsAccuracy ? `${Math.round(gpsAccuracy)}m` : '?'} — click to stop`
                    : gpsError
                      ? `GPS error: ${gpsError} — click to retry`
                      : 'Start live GPS tracking (uses device location)'}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition ${gpsTracking ? 'bg-[#00d890]/20 text-[#00d890] border border-[#00d890]/30' : gpsError ? 'text-[#E63946] hover:text-[#E63946]' : isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                >
                  <Satellite className="h-3.5 w-3.5" />
                  {gpsTracking ? 'GPS live' : gpsError ? 'GPS error' : 'Live GPS'}
                </button>
                {/* Shareable session link */}
                <button
                  onClick={handleShareClick}
                  aria-label={shareCopied ? 'Copied!' : 'Copy shareable survey session link'}
                  title={shareCopied ? 'Link copied to clipboard' : 'Copy a link that restores this survey session (view, measurements, tools)'}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition ${shareCopied ? 'bg-[#00d890]/20 text-[#00d890] border border-[#00d890]/30' : isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {shareCopied ? <Copy className="h-3.5 w-3.5" /> : 'Share session'}
                </button>
                {/* New session button */}
                <button
                  onClick={handleNewSession}
                  aria-label="Start new survey session"
                  title="Clear all measurements and generate a new session ID"
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  New session
                </button>
                <button
                  onClick={() => void handleA0Export()}
                  disabled={isExporting}
                  title="Download the current 2D view as an A0-size PNG (2D Map view only)"
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition disabled:opacity-60 ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                >
                  <Printer className={`h-3.5 w-3.5 ${isExporting ? 'animate-pulse' : ''}`} />
                  {isExporting ? (exportNote ?? 'Exporting…') : 'A0 export'}
                </button>
                {exportNote && !isExporting && (
                  <span className={`px-3 py-2 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>{exportNote}</span>
                )}
                {shareUrl && !shareCopied && (
                  <span className={`px-2 py-1 font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`} title={shareUrl}>
                    {shareUrl.slice(0, 50)}…
                  </span>
                )}
                {/* Collapse button at the end of the expanded toolbar */}
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  title="Collapse toolbar to a single icon"
                  aria-label="Collapse toolbar"
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-white/10 ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                >
                  <ChevronUp className="h-3.5 w-3.5 rotate-180" aria-hidden />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
