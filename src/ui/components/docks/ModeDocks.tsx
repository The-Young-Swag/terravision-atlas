import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid2x2, Ruler, X, Move3d, Printer, Satellite, Link2, Copy, MapPin } from 'lucide-react';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useMapStore } from '../../../stores/mapStore';
import { downloadA0Png, exportA0Png } from '../../../features/export/print/a0Export';
import { bearingDegrees, formatBearing, formatDistanceKilometers, geodesicKilometers } from '../../../core/geodetic/measurements/distance';
import { useSurveyStore } from '../../../stores/surveyStore';

type AppMode = 'explore' | 'monitor' | 'survey';

interface ModeDocksProps {
  activeMode: AppMode;
}

export function ModeDocks({ activeMode }: ModeDocksProps) {
  const isBrightBasemap = useBrightBasemap();
  const snapToGrid = useMapStore((s) => s.snapToGrid);
  const setSnapToGrid = useMapStore((s) => s.setSnapToGrid);
  const measureActive = useMapStore((s) => s.measureActive);
  const measurePoints = useMapStore((s) => s.measurePoints);
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

  const measuredKm = geodesicKilometers(measurePoints);
  const measuredBearing =
    measurePoints.length === 2 ? formatBearing(bearingDegrees(measurePoints[0], measurePoints[1])) : null;

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

      <AnimatePresence>
        {activeMode === 'survey' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="glass-strong absolute bottom-20 left-1/2 z-10 flex max-w-[90vw] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-2xl px-2 py-2"
          >
            <button
              onClick={() => setSnapToGrid(!snapToGrid)}
              aria-pressed={snapToGrid}
              title="Snap map center to grid lines (2D and Vector maps)"
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
              title="Measure geodesic distance: click two points on the map (Esc exits)"
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition ${measureActive ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
            >
              <Ruler className="h-3.5 w-3.5" />
              Measure geodesic
            </button>
            {measurePoints.length > 0 && (
              <span className={`px-2 py-2 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
                {formatDistanceKilometers(measuredKm)}
                {measuredBearing ? ` · ${measuredBearing}` : ''}
              </span>
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
