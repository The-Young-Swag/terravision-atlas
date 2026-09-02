import { Search, Settings2, Fuel, Compass, BookOpen, Box } from 'lucide-react';
import { motion } from 'framer-motion';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';

type AppMode = 'explore' | 'monitor' | 'survey';

function getModeColor(mode: AppMode): string {
  switch (mode) {
    case 'explore':
      return 'bg-[#059669]';
    case 'monitor':
      return 'bg-[#dc2626]';
    case 'survey':
      return 'bg-[#2563eb]';
    default:
      return 'bg-[#059669]';
  }
}

interface TopBarProps {
  activeMode: AppMode;
  setActiveMode: (mode: AppMode) => void;
  setFuelOpen: (open: boolean) => void;
  setStoryOpen: (open: boolean) => void;
  setMinecraftOpen: (open: boolean) => void;
}

export function TopBar({
  activeMode,
  setActiveMode,
  setFuelOpen,
  setStoryOpen,
  setMinecraftOpen,
}: TopBarProps) {
  const isBrightBasemap = useBrightBasemap();

  return (
    <>
      {/* Top bar */}
      <header className="absolute left-4 right-4 top-4 z-20 flex items-center gap-3">
        <div className="glass-strong flex shrink-0 items-center gap-2.5 rounded-2xl px-4 py-2.5">
          <Compass className="h-5 w-5 text-[#5500a4]" aria-hidden />
          <span className={`text-[15px] font-semibold tracking-tight ${isBrightBasemap ? 'text-slate-900' : 'text-slate-100'}`}>TerraVision</span>
          <span className={`text-[11px] font-medium tracking-widest ${isBrightBasemap ? 'text-slate-700' : 'text-slate-400'}`}>ATLAS</span>
        </div>

        <div className="glass flex max-w-md flex-1 items-center gap-2.5 rounded-2xl px-4 py-2.5">
          <Search className={`h-4 w-4 shrink-0 ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`} aria-hidden />
          <input
            className={`flex-1 bg-transparent text-[13.5px] focus:outline-none ${isBrightBasemap ? 'text-slate-800 placeholder:text-slate-500' : 'text-slate-200 placeholder:text-slate-400'}`}
            placeholder="Search place, coordinate, or event…"
            aria-label="Search"
          />
        </div>

        {/* Mode switcher — Explore / Monitor / Survey with per-mode colors */}
        <div className={`glass hidden items-center gap-1 rounded-full p-1 text-[13px] font-medium md:flex ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
          {(['explore', 'monitor', 'survey'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`relative rounded-full px-4 py-1.5 capitalize transition ${activeMode === mode ? 'text-white' : isBrightBasemap ? 'hover:text-slate-900' : 'hover:text-white'}`}
              aria-pressed={activeMode === mode}
            >
              {activeMode === mode && (
                <motion.span
                  layoutId="mode-thumb"
                  className={`absolute inset-0 rounded-full shadow ${getModeColor(mode)}`}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative">{mode}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setStoryOpen(true)}
          className={`glass flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
          aria-label="Open storytelling"
        >
          <BookOpen className="h-[18px] w-[18px]" />
        </button>

        <button
          onClick={() => setMinecraftOpen(true)}
          className={`glass flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
          aria-label="Open Minecraft export"
        >
          <Box className="h-[18px] w-[18px]" />
        </button>

        <button
          onClick={() => setFuelOpen(true)}
          className={`glass flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
          aria-label="Open fuel calculator"
        >
          <Fuel className="h-[18px] w-[18px]" />
        </button>

        <button
          className={`glass hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition md:flex ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
          aria-label="Settings"
        >
          <Settings2 className="h-[18px] w-[18px]" />
        </button>
      </header>

      {/* Mobile mode switcher */}
      <div className="absolute left-4 right-4 top-[4.75rem] z-20 flex justify-center md:hidden">
        <div className={`glass flex items-center gap-1 rounded-full p-1 text-[13px] font-medium ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
          {(['explore', 'monitor', 'survey'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`rounded-full px-3 py-1.5 capitalize transition ${activeMode === mode ? `${getModeColor(mode)} text-white shadow` : isBrightBasemap ? 'hover:text-slate-900' : 'hover:text-white'}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
