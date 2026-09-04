import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid2x2, Ruler, X } from 'lucide-react';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useMapStore } from '../../../stores/mapStore';
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
            <span className={`px-3 py-2 text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>Datum shift viz · A0 export — not fully implemented (see Geodetic panel for working Proj4/NTv2/EPSG)</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
