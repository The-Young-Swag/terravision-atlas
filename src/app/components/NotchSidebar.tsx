import { useCallback, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CloudSun,
  HousePlus,
  Layers,
  Navigation,
  Pin,
  PinOff,
  Ruler,
} from 'lucide-react';
import { useMapStore } from '../../features/map/store';
import { useDisasterStore } from '../../features/disasters';
import { useWeatherStore } from '../../features/weather';
import { useRouteStore } from '../../features/navigation';
import { useShelterStore } from '../../features/shelters';
import { useUiPanelStore } from '../../stores/uiPanelStore';
import { useSurveyStore } from '../../features/survey';
import { describeWeatherCode, weatherColorForCode } from '../../features/weather';
import { useEdgeDock } from '../../hooks/useEdgeDock';
import type { AppMode } from '../../types';

interface NotchSidebarProps {
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

const PIN_STORAGE_KEY = 'terravision.notch.pinned';
const DOCK_STORAGE_KEY = 'terravision.notch.dock';
const NOTCH_Y_KEY = 'terravision.notch.y';
const SLIDE_EDGE_MARGIN = 8;

function readNotchYOffset(): number {
  try {
    const raw = Number(localStorage.getItem(NOTCH_Y_KEY));
    return Number.isFinite(raw) ? raw : -40;
  } catch {
    return -40;
  }
}

function readPinned(): boolean {
  try {
    return localStorage.getItem(PIN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

// Panel inventory, verified against the codebase (Item 12B §2):
// - layers → LayersPanel, always mounted, FloatingPanel id "layers"
// - alerts → LiveAlertsPanel, always mounted, id "alerts"
// - weather → WeatherPanel (explore/monitor only), id "weather"
// - navigation → EvacuationPanel (explore as Navigation, monitor as
//   Evacuation routing; same FloatingPanel id "evacuation"), always one of them
// - survey → GeodeticPanel (survey only), id "geodetic"
// - shelter → ShelterPanel (monitor only), id "shelters"
// Storytelling / Minecraft Export / Fuel stay standalone — no rows here.
interface NotchRow {
  panelId: string;
  label: string;
  icon: typeof Layers;
  accent: string;
  /** 'all' = core set, always present; otherwise removed outside these modes. */
  modes: AppMode[] | 'all';
  /** Plain strings everywhere except the weather row, whose condition
      label reuses the shared condition-color mapping. */
  preview: ReactNode;
  count: number | null;
  dot: boolean;
}

const VIEW_MODE_LABEL: Record<string, string> = { '2d': '2D map', vector: 'Vector', '3d': '3D globe' };

/**
 * Unified notch sidebar: one collapsible edge-docked element holding every
 * panel entry point (Codenotch pattern). Collapsed = 52px glyph pill;
 * expanded (hover or pinned) = 296px rows with live previews from real
 * panel state. Clicking a row opens that panel via the existing
 * close/restore store — the notch never contains panel content itself.
 */
export function NotchSidebar({ activeMode, onModeChange }: NotchSidebarProps) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(readPinned);
  const { left, dragging, dragSide, dragHandleProps } = useEdgeDock({
    dockKey: DOCK_STORAGE_KEY,
    defaultSide: 'left',
  });
  const [yOffset, setYOffset] = useState(readNotchYOffset);
  const containerRef = useRef<HTMLElement>(null);
  const slideStartRef = useRef<{ pointerY: number; offset: number } | null>(null);

  const clampYOffset = useCallback((value: number) => {
    const height = containerRef.current?.offsetHeight ?? 0;
    const maxTravel = Math.max(0, (window.innerHeight - height) / 2 - SLIDE_EDGE_MARGIN);
    return Math.min(maxTravel, Math.max(-maxTravel, value));
  }, []);

  const persistYOffset = useCallback((value: number) => {
    try {
      localStorage.setItem(NOTCH_Y_KEY, String(Math.round(value)));
    } catch {
      // ignore storage errors
    }
  }, []);

  const basemap = useMapStore((s) => s.basemap);
  const viewMode = useMapStore((s) => s.viewMode);
  const measureActive = useSurveyStore((s) => s.measureActive);
  const measurePoints = useSurveyStore((s) => s.measurePoints);
  const measureMode = useSurveyStore((s) => s.measureMode);
  const snapToGrid = useMapStore((s) => s.snapToGrid);
  const disasterEvents = useDisasterStore((s) => s.events);
  const weatherCurrent = useWeatherStore((s) => s.current);
  const weatherLocation = useWeatherStore((s) => s.location);
  const weatherLoading = useWeatherStore((s) => s.loading);
  const route = useRouteStore((s) => s.route);
  const jogLoop = useRouteStore((s) => s.jogLoop);
  const routeStart = useRouteStore((s) => s.start);
  const routeDestination = useRouteStore((s) => s.destination);
  const shelters = useShelterStore((s) => s.shelters);
  const reopenPanel = useUiPanelStore((s) => s.reopenPanel);

  const expanded = (hovered || pinned) && !dragging;

  const highSeverity = disasterEvents.filter((e) => e.severity === 'high').length;
  const routePreview = route
    ? `${route.distanceKm.toFixed(1)} km · ${route.durationMinutes.toFixed(0)} min`
    : jogLoop
      ? `Loop ${jogLoop.distanceKm.toFixed(1)} km`
      : routeStart || routeDestination
        ? 'Picking points…'
        : 'No route set';
  const rows: NotchRow[] = [
    {
      panelId: 'layers',
      label: 'Layers',
      icon: Layers,
      accent: '#8b7bff',
      modes: 'all',
      preview: `${basemap[0].toUpperCase()}${basemap.slice(1)} · ${VIEW_MODE_LABEL[viewMode] ?? viewMode}`,
      count: null,
      dot: false,
    },
    {
      panelId: 'alerts',
      label: 'Live Alerts',
      icon: AlertTriangle,
      accent: '#ff6b6b',
      modes: 'all',
      preview: disasterEvents.length > 0 ? `${disasterEvents.length} active` : 'No active events',
      count: disasterEvents.length > 0 ? disasterEvents.length : null,
      dot: highSeverity > 0,
    },
    {
      panelId: 'weather',
      label: 'Weather',
      icon: CloudSun,
      accent: '#38bdf8',
      modes: ['explore', 'monitor'],
      preview: weatherCurrent
        ? (
          <>
            {weatherCurrent.temperatureC.toFixed(0)}°C ·{' '}
            <span style={{ color: weatherColorForCode(weatherCurrent.weatherCode) }}>
              {describeWeatherCode(weatherCurrent.weatherCode)}
            </span>
          </>
        )
        : weatherLoading
          ? 'Loading…'
          : weatherLocation
            ? 'No data yet'
            : 'Follows map center',
      count: null,
      dot: false,
    },
    {
      panelId: 'evacuation',
      label: activeMode === 'monitor' ? 'Evacuation Routing' : 'Navigation',
      icon: Navigation,
      accent: '#00d890',
      modes: ['explore', 'monitor'],
      preview: routePreview,
      count: null,
      dot: false,
    },
    {
      panelId: 'geodetic',
      label: 'Survey Tools',
      icon: Ruler,
      accent: '#f59e0b',
      modes: ['survey'],
      preview: measureActive
        ? `${measureMode === 'distance' ? 'Distance' : 'Area'} · ${measurePoints.length} pts`
        : snapToGrid
          ? 'Snap to grid on'
          : 'Measure · Datum · Grid',
      count: null,
      dot: false,
    },
    {
      panelId: 'shelters',
      label: 'Shelter Locator',
      icon: HousePlus,
      accent: '#a78bfa',
      modes: ['monitor'],
      preview: shelters.length > 0 ? `${shelters.length} nearby` : 'Find near map center',
      count: shelters.length > 0 ? shelters.length : null,
      dot: false,
    },
  ];
  // Mode-exclusive rows are removed (not hidden) outside their mode, driven
  // off the same activeMode prop as the panels themselves — no parallel
  // mode tracking. Core rows never leave.
  const visibleRows = rows.filter((row) => row.modes === 'all' || row.modes.includes(activeMode));

  const openRow = (row: NotchRow) => {
    // A core row's panel only mounts in certain modes (weather/evacuation
    // in explore+monitor). Switching via the existing mode action first
    // keeps the click's promise ("opens that panel") true in every mode.
    if (row.modes !== 'all' && !row.modes.includes(activeMode)) {
      onModeChange(row.modes[0]);
    }
    reopenPanel(row.panelId);
  };

  const togglePin = () => {
    setPinned((next) => {
      const value = !next;
      try {
        localStorage.setItem(PIN_STORAGE_KEY, String(value));
      } catch {
        // persistence is a nicety — the toggle still works for the session
      }
      return value;
    });
  };

  return (
    <>
      {/* Snap-zone indicators while dragging. Left/right only — top and
          bottom docking are never offered, so no zones exist for them.
          Desktop only: mobile uses the FAB bubble instead. */}
      <div
        aria-hidden
        className={`pointer-events-none fixed bottom-0 left-0 top-0 z-40 w-16 transition-opacity duration-150 max-md:hidden ${dragging ? 'opacity-100' : 'opacity-0'} ${dragSide === 'left' ? 'bg-[#5500a4]/30' : 'bg-[#5500a4]/15'}`}
      />
      <div
        aria-hidden
        className={`pointer-events-none fixed bottom-0 right-0 top-0 z-40 w-16 transition-opacity duration-150 max-md:hidden ${dragging ? 'opacity-100' : 'opacity-0'} ${dragSide === 'right' ? 'bg-[#5500a4]/30' : 'bg-[#5500a4]/15'}`}
      />
    <nav
      ref={containerRef as unknown as React.RefObject<HTMLElement>}
      aria-label="Panel access"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        // Touch: tap collapsed pill to pin open (hover never fires on mobile)
        if (!expanded && !dragging) {
          setPinned(true);
          try {
            localStorage.setItem(PIN_STORAGE_KEY, 'true');
          } catch {
            // ignore storage errors (private mode)
          }
        }
      }}
      style={{ top: `calc(50% + ${yOffset}px)` }}
      // Desktop only (hidden below md): mobile uses the FAB bubble menu.
      className={`glass fixed z-30 flex max-h-[70vh] -translate-y-1/2 flex-col overflow-hidden max-md:hidden ${
        expanded ? 'w-[296px] max-w-[90vw]' : 'w-[52px]'
      } ${left ? 'notch-dock-left left-0 rounded-l-none' : 'notch-dock-right right-0 rounded-r-none'} ${
        expanded ? (left ? 'rounded-r-[20px]' : 'rounded-l-[20px]') : left ? 'rounded-r-[22px]' : 'rounded-l-[22px]'
      } ${dragging ? 'transition-none' : 'transition-[width,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'}`}
    >
      {/* Drag handle: slim strip on edge side; supports dock left/right and vertical slide */}
      <div
        role="separator"
        aria-label={`Drag to dock ${left ? 'right' : 'left'} or slide vertically`}
        title="Drag to dock left/right or slide up/down"
        className={`absolute inset-y-0 z-10 flex w-[8px] cursor-grab touch-none items-center justify-center bg-white/[0.04] transition-colors hover:bg-white/10 active:cursor-grabbing ${left ? 'left-0' : 'right-0'}`}
        {...dragHandleProps}
        onPointerDown={(e) => {
          dragHandleProps.onPointerDown(e);
          slideStartRef.current = { pointerY: e.clientY, offset: yOffset };
        }}
        onPointerMove={(e) => {
          dragHandleProps.onPointerMove(e);
          const start = slideStartRef.current;
          if (start) setYOffset(clampYOffset(start.offset + (e.clientY - start.pointerY)));
        }}
        onPointerUp={(e) => {
          dragHandleProps.onPointerUp(e);
          slideStartRef.current = null;
          setYOffset((prev) => {
            const clamped = clampYOffset(prev);
            persistYOffset(clamped);
            return clamped;
          });
        }}
        onPointerCancel={() => {
          dragHandleProps.onPointerCancel();
          slideStartRef.current = null;
        }}
      >
        <span className="flex flex-col items-center gap-1" aria-hidden>
          <span className="h-[3px] w-[3px] rounded-full bg-white/30" />
          <span className="h-[3px] w-[3px] rounded-full bg-white/30" />
          <span className="h-[3px] w-[3px] rounded-full bg-white/30" />
        </span>
      </div>
      <div className={`custom-scrollbar flex flex-col gap-0.5 divide-y divide-white/[0.06] overflow-y-auto py-2 ${left ? 'pl-2 pr-1' : 'pl-1 pr-2'}`}>
        <AnimatePresence initial={false}>
          {visibleRows.map((row) => {
            const Icon = row.icon;
            return (
              <motion.button
                key={row.panelId}
                type="button"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 48 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                onClick={(e) => {
                  e.stopPropagation();
                  openRow(row);
                }}
                title={`Open ${row.label}`}
                aria-label={`Open ${row.label}`}
                className={`flex h-12 w-full shrink-0 items-center overflow-hidden px-2 text-left transition-colors hover:bg-white/5 ${expanded ? '' : 'justify-center'}`}
              >
                <span
                  className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                  style={{ color: row.accent, backgroundColor: `${row.accent}29` }}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                  {row.dot && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-[#0D1B2A] bg-[#ff4d4d]" aria-hidden />
                  )}
                </span>
                {/* Text cross-fades with outer width; layout removed to avoid shift on preview change */}
                <span
                  className={`${expanded ? 'ml-3 max-w-[220px] opacity-100' : 'ml-0 max-w-0 opacity-0'} flex min-w-0 flex-1 flex-col justify-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]`}
                  aria-hidden={!expanded}
                >
                  <span className="truncate text-[13px] font-medium leading-tight text-slate-100">{row.label}</span>
                  <span className="truncate text-[11.5px] leading-tight text-slate-300">{row.preview}</span>
                </span>
                {expanded && row.count !== null && (
                  <span className="ml-2 shrink-0 whitespace-nowrap rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-slate-300">
                    {row.count}
                  </span>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {expanded && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePin();
          }}
          title={pinned ? 'Unpin — collapse on pointer leave' : 'Pin open'}
          aria-pressed={pinned}
          className={`flex h-11 shrink-0 items-center gap-2 border-t border-white/10 px-4 text-[12px] font-medium transition-colors hover:bg-white/5 ${pinned ? 'text-[#00d890]' : 'text-slate-300'}`}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden /> : <Pin className="h-3.5 w-3.5" aria-hidden />}
          {pinned ? 'Unpin' : 'Pin open'}
        </button>
      )}
    </nav>
    </>
  );
}
