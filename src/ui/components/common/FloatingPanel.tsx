import { useState, type ReactNode } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Grip, Minimize2, Maximize2, X, XCircle } from 'lucide-react';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useUiPanelStore } from '../../../stores/uiPanelStore';

interface FloatingPanelProps {
  id: string;
  title: string;
  icon: ReactNode;
  initialPosition: { x: number; y: number };
  children: ReactNode;
  onClose?: () => void;
  bubbleLabel?: string;
  className?: string;
  defaultMinimized?: boolean;
  /**
   * Wide variant for long/dense panels (Navigation, Live alerts, Weather).
   * Reuses the width pattern the Fuel calculator established
   * (380px / 440px at md) so all roomy panels share one size; short panels
   * stay at the default w-72. Mobile is unaffected (bottom sheet).
   */
  wide?: boolean;
}

// Reusable floating panel with drag and minimize-to-bubble.
// - Expanded: glass panel, draggable via header, minimize/close in header
// - Minimized: compact bubble, draggable, tap to restore
// - Preserves position and state when toggling
// - Works with mouse and touch via Framer Motion drag
// - On mobile, renders as bottom sheet for touch-friendly UX
export function FloatingPanel({
  id,
  title,
  icon,
  initialPosition,
  children,
  onClose,
  bubbleLabel,
  className = '',
  defaultMinimized = false,
  wide = false,
}: FloatingPanelProps) {
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);
  const dragControls = useDragControls();
  // Panel-chrome text/icons follow the shared dynamic font-color utility.
  // (Minimize bubbles and the mobile sheet keep static white: their
  // backgrounds are fixed dark, so they never need adapting.)
  const isBrightBasemap = useBrightBasemap();
  const closePanel = useUiPanelStore((s) => s.closePanel);
  const isClosed = useUiPanelStore((s) => s.closedPanels[id] === true);
  // Track whether the last interaction was a drag vs a tap — prevents
  // the bubble from reopening immediately after a drag release
  const hasDraggedRef = useState(() => ({ current: false }))[0];

  if (isMinimized) {
    // display:none (not unmount) so minimize/bubble drag state and all
    // panel content survive a toolbar close/restore cycle.
    return (
      <div style={isClosed ? { display: 'none' } : undefined} aria-hidden={isClosed || undefined}>
      <>
        {/* Desktop bubble — draggable */}
        <motion.div
          drag
          dragControls={dragControls}
          dragMomentum={false}
          dragElastic={0}
          initial={{ x: initialPosition.x, y: initialPosition.y, scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onDragStart={() => {
            hasDraggedRef.current = false;
          }}
          onDrag={(_: unknown, info: { offset: { x: number; y: number } }) => {
            if (Math.abs(info.offset.x) > 5 || Math.abs(info.offset.y) > 5) {
              hasDraggedRef.current = true;
            }
          }}
          onDragEnd={() => {
            // Delay reset so the subsequent click can be checked
            setTimeout(() => {
              hasDraggedRef.current = false;
            }, 100);
          }}
          onClick={() => {
            if (hasDraggedRef.current) return;
            setIsMinimized(false);
          }}
          className="fixed z-40 hidden cursor-grab items-center gap-2 rounded-full border border-white/20 bg-[#0D1B2A]/90 px-3 py-2 shadow-xl backdrop-blur-md active:cursor-grabbing md:flex md:px-4 md:py-2.5"
          style={{ left: 0, top: 0, x: initialPosition.x, y: initialPosition.y }}
          role="button"
          aria-label={`Restore ${title}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsMinimized(false);
            }
          }}
          onPointerDown={(e) => dragControls.start(e)}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white">
            {icon}
          </span>
          <span className="text-[13px] font-medium text-white">{bubbleLabel ?? title}</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/70">
            <Maximize2 className="h-3.5 w-3.5" />
          </span>
        </motion.div>

        {/* Mobile bubble — bottom, easy to grab */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-[#0D1B2A]/90 px-4 py-2.5 shadow-xl backdrop-blur-md md:hidden"
          role="button"
          aria-label={`Restore ${title}`}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white">
            {icon}
          </span>
          <span className="text-[13px] font-medium text-white">{bubbleLabel ?? title}</span>
          <Maximize2 className="h-3.5 w-3.5 text-white/70" />
        </motion.div>
      </>
      </div>
    );
  }

  return (
    // display:none (not unmount) so position drag state and every input
    // inside survives a toolbar close/restore cycle.
    <div style={isClosed ? { display: 'none' } : undefined} aria-hidden={isClosed || undefined}>
    <>
      {/* Desktop floating panel */}
      <motion.div
        drag
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0.1}
        initial={{ x: initialPosition.x, y: initialPosition.y, opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className={`fixed z-30 hidden ${wide ? 'w-[380px]' : 'w-72'} md:block ${wide ? 'md:w-[440px]' : ''} ${className}`}
        style={{ left: 0, top: 0, x: initialPosition.x, y: initialPosition.y }}
      >
        <div className="glass flex flex-col overflow-hidden rounded-2xl">
          {/* Header — drag handle */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex cursor-grab touch-none items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3 active:cursor-grabbing"
          >
            <div className="flex items-center gap-2">
              <Grip className={`h-3.5 w-3.5 ${isBrightBasemap ? 'text-slate-500' : 'text-white/30'}`} aria-hidden />
              <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-white/10 ${isBrightBasemap ? 'text-slate-700' : 'text-white'}`}>
                {icon}
              </span>
              <h2 className={`text-[13px] font-semibold ${isBrightBasemap ? 'text-slate-800' : 'text-slate-100'}`}>{title}</h2>
            </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              onPointerDown={(e) => e.stopPropagation()}
              title={`Minimize ${title} to a bubble`}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-white/10 ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-white/60 hover:text-white'}`}
              aria-label={`Minimize ${title}`}
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
            <span className="mx-1 h-5 w-px bg-white/10" aria-hidden />
            <button
              onClick={() => closePanel(id)}
              onPointerDown={(e) => e.stopPropagation()}
              title={`Close ${title} — restore anytime from the top-right`}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-white/10 ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-white/60 hover:text-white'}`}
              aria-label={`Close ${title}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {onClose && (
              <>
                <span className="mx-1 h-5 w-px bg-white/10" aria-hidden />
                <button
                  onClick={onClose}
                  onPointerDown={(e) => e.stopPropagation()}
                  title={`Remove ${title} completely`}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-white/10 ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-white/60 hover:text-white'}`}
                  aria-label={`Remove ${title}`}
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">{children}</div>
      </div>
    </motion.div>

      {/* Mobile bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex max-h-[65vh] flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#0D1B2A]/95 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white">
              {icon}
            </span>
            <h2 className="text-[14px] font-semibold text-white">{title}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              title={`Minimize ${title} to a bubble`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white"
              aria-label={`Minimize ${title}`}
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => closePanel(id)}
              title={`Close ${title} — restore anytime from the top-right`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white"
              aria-label={`Close ${title}`}
            >
              <X className="h-4 w-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                title={`Remove ${title} completely`}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white"
                aria-label={`Remove ${title}`}
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">{children}</div>
      </div>
    </>
    </div>
  );
}
