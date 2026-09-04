import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid2x2, Ruler, X, Move3d, Printer } from 'lucide-react';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useMapStore } from '../../../stores/mapStore';
import { downloadA0Png, exportA0Png } from '../../../features/export/print/a0Export';
import { bearingDegrees, formatBearing, formatDistanceKilometers, geodesicKilometers } from '../../../core/geodetic/measurements/distance';

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

  const handleA0Export = async () => {
    // A0 rendering reads OpenLayers canvases, so it only runs in 2D Map view.
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
