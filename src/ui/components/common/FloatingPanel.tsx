import { useState, type ReactNode } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Grip, Minimize2, Maximize2, X } from 'lucide-react';

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
}

// Reusable floating panel with drag and minimize-to-bubble.
// - Expanded: glass panel, draggable via header, minimize/close in header
// - Minimized: compact bubble, draggable, tap to restore
// - Preserves position and state when toggling
// - Works with mouse and touch via Framer Motion drag
// - On mobile, renders as bottom sheet for touch-friendly UX
export function FloatingPanel({
  title,
  icon,
  initialPosition,
  children,
  onClose,
  bubbleLabel,
  className = '',
  defaultMinimized = false,
}: FloatingPanelProps) {
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);
  const dragControls = useDragControls();
  // Track whether the last interaction was a drag vs a tap — prevents
  // the bubble from reopening immediately after a drag release
  const hasDraggedRef = useState(() => ({ current: false }))[0];

  if (isMinimized) {
    return (
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
    );
  }

  return (
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
        className={`fixed z-30 hidden w-72 md:block ${className}`}
        style={{ left: 0, top: 0, x: initialPosition.x, y: initialPosition.y }}
      >
        <div className="glass flex flex-col overflow-hidden rounded-2xl">
          {/* Header — drag handle */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex cursor-grab touch-none items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3 active:cursor-grabbing"
          >
            <div className="flex items-center gap-2">
              <Grip className="h-3.5 w-3.5 text-white/30" aria-hidden />
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white">
                {icon}
              </span>
              <h2 className="text-[13px] font-semibold text-slate-100">{title}</h2>
            </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label={`Minimize ${title}`}
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label={`Close ${title}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
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
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white"
              aria-label={`Minimize ${title}`}
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white"
                aria-label={`Close ${title}`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">{children}</div>
      </div>
    </>
  );
}
