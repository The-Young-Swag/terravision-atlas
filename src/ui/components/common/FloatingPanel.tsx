import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
  /**
   * Extra-wide variant for the weather panel's date axis: 440px /
   * 520px at md gives the 7 day labels room without crowding.
   * Takes precedence over `wide`. Mobile is unaffected.
   */
  xlWide?: boolean;
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
  xlWide = false,
}: FloatingPanelProps) {
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);
  const dragControls = useDragControls();
  // Mobile-only drag state (desktop branch below is untouched): native
  // pointer handlers with live viewport clamping (mockup logic), so both
  // touch and mouse/pointer input drag deterministically. Position is kept
  // in left/top px, cascaded per panel id so open panels don't fully stack.
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const [mobileDragging, setMobileDragging] = useState(false);
  const mobileCascade = (() => {
    const order = ['layers', 'alerts', 'weather', 'evacuation', 'geodetic', 'shelters', 'fuel', 'storytelling'];
    const idx = Math.max(0, order.indexOf(id));
    return { x: 12 + (idx % 3) * 20, y: 108 + (idx % 4) * 30 };
  })();
  const [mobilePos, setMobilePos] = useState(mobileCascade);
  const mobilePosRef = useRef(mobileCascade);
  const mobileDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const setMobilePosBoth = (pos: { x: number; y: number }) => {
    mobilePosRef.current = pos;
    setMobilePos(pos);
  };
  // Viewport zones for the mobile clamp (named constants, not magic
  // numbers): the header/nav dropdown must stay clear above, and the
  // footer's collapse toggle must stay clear below.
  // The panel BODY may extend past the bottom edge on short screens —
  // only the header (grab handle) is guaranteed reachable. Clamping the
  // whole panel above the footer locked tall panels to horizontal-only
  // drag, since their height left zero vertical travel.
  const MOBILE_PANEL_MARGIN_PX = 8;
  const MOBILE_PANEL_TOP_ZONE_PX = 104;
  const MOBILE_PANEL_HANDLE_PX = 52;
  const MOBILE_PANEL_BOTTOM_ZONE_PX = 110;
  // Clamp a position inside the viewport (header above, grab handle kept
  // clear of the footer below).
  const clampMobilePos = (x: number, y: number) => {
    const node = mobilePanelRef.current;
    const margin = MOBILE_PANEL_MARGIN_PX;
    const width = node?.offsetWidth ?? 304;
    const maxY = Math.max(
      MOBILE_PANEL_TOP_ZONE_PX,
      window.innerHeight - MOBILE_PANEL_BOTTOM_ZONE_PX - MOBILE_PANEL_HANDLE_PX,
    );
    return {
      x: Math.max(margin, Math.min(x, window.innerWidth - width - margin)),
      y: Math.max(MOBILE_PANEL_TOP_ZONE_PX, Math.min(y, maxY)),
    };
  };
  // Clamp the cascade into small viewports on mount / id change.
  const mobileDragMove = useCallback((e: PointerEvent) => {
    const drag = mobileDragRef.current;
    if (!drag) return;
    setMobilePosBoth(
      clampMobilePos(drag.origX + (e.clientX - drag.startX), drag.origY + (e.clientY - drag.startY)),
    );
  }, []);
  const mobileDragEnd = useCallback(() => {
    mobileDragRef.current = null;
    setMobileDragging(false);
    window.removeEventListener('pointermove', mobileDragMove);
  }, [mobileDragMove]);
  useEffect(() => {
    setMobilePosBoth(clampMobilePos(mobilePosRef.current.x, mobilePosRef.current.y));
  }, [id]);
  // Unmount-only listener cleanup (re-subscribed if handlers change).
  useEffect(
    () => () => {
      window.removeEventListener('pointermove', mobileDragMove);
      window.removeEventListener('pointerup', mobileDragEnd);
      window.removeEventListener('pointercancel', mobileDragEnd);
    },
    [mobileDragEnd, mobileDragMove],
  );
  const mobileDragStart = (e: React.PointerEvent) => {
    // Buttons inside the header (minimize/close) stop propagation, so a
    // drag never starts from them — only from bare header surface.
    mobileDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: mobilePosRef.current.x,
      origY: mobilePosRef.current.y,
    };
    setMobileDragging(true);
    window.addEventListener('pointermove', mobileDragMove);
    // Up/cancel are one-shot: no removal bookkeeping needed in the end
    // handler, which also avoids a self-referential listener cycle.
    window.addEventListener('pointerup', mobileDragEnd, { once: true });
    window.addEventListener('pointercancel', mobileDragEnd, { once: true });
  };
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
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/85">
            <Maximize2 className="h-3.5 w-3.5" />
          </span>
        </motion.div>

        {/* Mobile bubble — staggered so multiple minimized panels don't fully
            overlap; each id maps to a stable vertical offset. */}
        {(() => {
          const order = ['layers', 'alerts', 'weather', 'evacuation', 'geodetic', 'shelters', 'fuel', 'storytelling'];
          const idx = order.indexOf(id);
          const bottom = idx >= 0 ? 5 + idx * 3.25 : 5;
          return (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              onClick={() => setIsMinimized(false)}
              className="fixed left-1/2 z-40 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-[#0D1B2A]/90 px-4 py-2.5 shadow-xl backdrop-blur-md md:hidden"
              style={{ bottom: `${bottom}rem` }}
              role="button"
              aria-label={`Restore ${title}`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white">
                {icon}
              </span>
              <span className="text-[13px] font-medium text-white">{bubbleLabel ?? title}</span>
              <Maximize2 className="h-3.5 w-3.5 text-white/85" />
            </motion.div>
          );
        })()}
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
        className={`fixed z-30 hidden ${xlWide ? 'w-[440px]' : wide ? 'w-[380px]' : 'w-72'} md:block ${xlWide ? 'md:w-[520px]' : wide ? 'md:w-[440px]' : ''} ${className}`}
        style={{ left: 0, top: 0, x: initialPosition.x, y: initialPosition.y }}
      >
        <div className="glass flex flex-col overflow-hidden rounded-2xl">
          {/* Header — drag handle */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex cursor-grab touch-none items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3 active:cursor-grabbing"
          >
            <div className="flex items-center gap-2">
              <Grip className={`h-3.5 w-3.5 ${isBrightBasemap ? 'text-slate-500' : 'text-white/50'}`} aria-hidden />
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
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-white/10 ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-white/80 hover:text-white'}`}
              aria-label={`Minimize ${title}`}
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
            <span className="mx-1 h-5 w-px bg-white/10" aria-hidden />
            <button
              onClick={() => closePanel(id)}
              onPointerDown={(e) => e.stopPropagation()}
              title={`Close ${title} — restore anytime from the top-right`}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-white/10 ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-white/80 hover:text-white'}`}
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
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-white/10 ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-white/80 hover:text-white'}`}
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

      {/* Mobile floating panel — draggable via header (touch-none so the
          map never pans underneath a drag), clamped live to the viewport,
          raised above siblings while dragging. Closed panels reopen from
          the mobile FAB bubble via the shared store.
          Mobile-only contrast rule: the shell uses the same translucent
          glass as desktop (never the opaque dark fill), so the shared
          bright-basemap text logic in panel content stays legible — dark
          text over bright map, light text over dark map. */}
      <motion.div
        ref={mobilePanelRef}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        style={{ left: mobilePos.x, top: mobilePos.y }}
        className={`glass fixed z-30 flex w-[min(19rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl md:hidden ${mobileDragging ? 'mobile-panel-dragging shadow-2xl' : 'shadow-xl'}`}
      >
        <div
          onPointerDown={mobileDragStart}
          className="flex cursor-grab touch-none items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3 active:cursor-grabbing"
        >
          <div className="flex items-center gap-2">
            <Grip className={`h-3.5 w-3.5 ${isBrightBasemap ? 'text-slate-500' : 'text-white/50'}`} aria-hidden />
            <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ${isBrightBasemap ? 'text-slate-700' : 'text-white'}`}>
              {icon}
            </span>
            <h2 className={`text-[14px] font-semibold ${isBrightBasemap ? 'text-slate-800' : 'text-slate-100'}`}>{title}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              onPointerDown={(e) => e.stopPropagation()}
              title={`Minimize ${title} to a bubble`}
              className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/10 ${isBrightBasemap ? 'text-slate-600' : 'text-white'}`}
              aria-label={`Minimize ${title}`}
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => closePanel(id)}
              onPointerDown={(e) => e.stopPropagation()}
              title={`Close ${title} — reopen from the tools bubble`}
              className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/10 ${isBrightBasemap ? 'text-slate-600' : 'text-white'}`}
              aria-label={`Close ${title}`}
            >
              <X className="h-4 w-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
                title={`Remove ${title} completely`}
                className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/10 ${isBrightBasemap ? 'text-slate-600' : 'text-white'}`}
                aria-label={`Remove ${title}`}
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[min(55vh,calc(100dvh-14rem))] flex-1 overflow-y-auto p-4 custom-scrollbar">{children}</div>
      </motion.div>
    </>
    </div>
  );
}
