import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, Ruler, Map as MapIcon } from 'lucide-react';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';

type AppMode = 'explore' | 'monitor' | 'survey';

interface ModeDocksProps {
  activeMode: AppMode;
}

export function ModeDocks({ activeMode }: ModeDocksProps) {
  const isBrightBasemap = useBrightBasemap();

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
            <button className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] hover:bg-white/10 ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>
              <Navigation className="h-3.5 w-3.5" />
              Evacuation route
            </button>
            <span className="h-5 w-px bg-white/10" />
            <button className={`rounded-xl px-3 py-2 text-[12.5px] hover:bg-white/10 ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>Nearest shelter</button>
            <span className="h-5 w-px bg-white/10" />
            <button className="rounded-xl px-3 py-2 text-[12.5px] text-[#E63946] hover:bg-white/10">Report incident</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeMode === 'survey' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="glass-strong absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-2xl px-2 py-2"
          >
            <button className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] hover:bg-white/10 ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>
              <MapIcon className="h-3.5 w-3.5" />
              Snap to grid
            </button>
            <span className="h-5 w-px bg-white/10" />
            <button className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] hover:bg-white/10 ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>
              <Ruler className="h-3.5 w-3.5" />
              Measure geodesic
            </button>
            <span className="h-5 w-px bg-white/10" />
            <div className="flex items-center gap-2 px-3 py-2">
              <span className={`text-[12px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>Datum</span>
              <select className={`rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[12px] outline-none ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>
                <option>WGS84</option>
                <option>NAD83</option>
                <option>ETRS89</option>
                <option>PRS92</option>
              </select>
            </div>
            <span className="h-5 w-px bg-white/10" />
            <button className={`rounded-xl px-3 py-2 text-[12.5px] hover:bg-white/10 ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>Export A0</button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
