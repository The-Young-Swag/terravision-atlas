import { motion, AnimatePresence } from 'framer-motion';
import { Grid2x2 } from 'lucide-react';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useMapStore } from '../../../stores/mapStore';

type AppMode = 'explore' | 'monitor' | 'survey';

interface ModeDocksProps {
  activeMode: AppMode;
}

export function ModeDocks({ activeMode }: ModeDocksProps) {
  const isBrightBasemap = useBrightBasemap();
  const snapToGrid = useMapStore((s) => s.snapToGrid);
  const setSnapToGrid = useMapStore((s) => s.setSnapToGrid);

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
            <span className={`px-3 py-2 text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>Measure geodesic · Datum shift viz · A0 export — not fully implemented (see Geodetic panel for working Proj4/NTv2/EPSG)</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
