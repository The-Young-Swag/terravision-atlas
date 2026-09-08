import { useCallback, useState } from 'react';

export type EdgeDockSide = 'left' | 'right';

interface UseEdgeDockOptions {
  /** localStorage key for the dock side. */
  dockKey: string;
  /** Side used when nothing is persisted yet. */
  defaultSide?: EdgeDockSide;
}

interface UseEdgeDockReturn {
  dockSide: EdgeDockSide;
  /** True when docked left (mirrors radius/handle orientation). */
  left: boolean;
  dragging: boolean;
  dragSide: EdgeDockSide | null;
  commitDock: (side: EdgeDockSide) => void;
  /** Spread onto the drag-handle element. */
  dragHandleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: () => void;
  };
}

/**
 * Shared edge-dock + drag-to-snap behavior, extracted verbatim from the
 * notch sidebar so dockable UI elements share one implementation instead
 * of maintaining parallel copies. Only left/right docks exist — a drag
 * toward top/bottom snaps to whichever side is horizontally nearer.
 * Collapse/expand stays per-component (hover/pin vs. click-toggle differ).
 */
export function useEdgeDock({ dockKey, defaultSide = 'left' }: UseEdgeDockOptions): UseEdgeDockReturn {
  const [dockSide, setDockSide] = useState<EdgeDockSide>(() => {
    try {
      return localStorage.getItem(dockKey) === 'right' ? 'right' : defaultSide;
    } catch {
      return defaultSide;
    }
  });
  const [dragging, setDragging] = useState(false);
  const [dragSide, setDragSide] = useState<EdgeDockSide | null>(null);

  const commitDock = useCallback(
    (side: EdgeDockSide) => {
      setDockSide(side);
      try {
        localStorage.setItem(dockKey, side);
      } catch {
        // persistence is a nicety — the dock still moves for the session
      }
    },
    [dockKey],
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setDragSide(null);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setDragSide(e.clientX < window.innerWidth / 2 ? 'left' : 'right');
    },
    [dragging],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setDragging(false);
      setDragSide(null);
      commitDock(e.clientX < window.innerWidth / 2 ? 'left' : 'right');
    },
    [dragging, commitDock],
  );

  const handlePointerCancel = useCallback(() => {
    setDragging(false);
    setDragSide(null);
  }, []);

  return {
    dockSide,
    left: dockSide === 'left',
    dragging,
    dragSide,
    commitDock,
    dragHandleProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}
