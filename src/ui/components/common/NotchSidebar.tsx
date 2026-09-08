import { useState } from 'react';
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
import { useMapStore } from '../../../stores/mapStore';
import { useDisasterStore } from '../../../stores/disasterStore';
import { useWeatherStore } from '../../../stores/weatherStore';
import { useRouteStore } from '../../../stores/routeStore';
import { useShelterStore } from '../../../stores/shelterStore';
import { useUiPanelStore } from '../../../stores/uiPanelStore';
import { describeWeatherCode } from '../../../features/weather/openMeteo';
import { useEdgeDock } from '../../../hooks/useEdgeDock';

type AppMode = 'explore' | 'monitor' | 'survey';

interface NotchSidebarProps {
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

const PIN_STORAGE_KEY = 'terravision.notch.pinned';
const DOCK_STORAGE_KEY = 'terravision.notch.dock';

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
  preview: string;
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

  const basemap = useMapStore((s) => s.basemap);
  const viewMode = useMapStore((s) => s.viewMode);
  const measureActive = useMapStore((s) => s.measureActive);
  const measurePoints = useMapStore((s) => s.measurePoints);
  const measureMode = useMapStore((s) => s.measureMode);
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
        ? `${weatherCurrent.temperatureC.toFixed(0)}°C · ${describeWeatherCode(weatherCurrent.weatherCode)}`
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
          bottom docking are never offered, so no zones exist for them. */}
      <div
        aria-hidden
        className={`pointer-events-none fixed bottom-0 left-0 top-0 z-40 w-16 transition-opacity duration-150 ${dragging ? 'opacity-100' : 'opacity-0'} ${dragSide === 'left' ? 'bg-[#5500a4]/30' : 'bg-[#5500a4]/15'}`}
      />
      <div
        aria-hidden
        className={`pointer-events-none fixed bottom-0 right-0 top-0 z-40 w-16 transition-opacity duration-150 ${dragging ? 'opacity-100' : 'opacity-0'} ${dragSide === 'right' ? 'bg-[#5500a4]/30' : 'bg-[#5500a4]/15'}`}
      />
    <nav
      aria-label="Panel access"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`glass fixed top-1/2 z-30 hidden max-h-[70vh] -translate-y-1/2 flex-col overflow-hidden md:flex ${
        expanded ? 'w-[296px]' : 'w-[52px]'
      } ${left ? 'notch-dock-left left-0 rounded-l-none' : 'notch-dock-right right-0 rounded-r-none'} ${
        expanded ? (left ? 'rounded-r-[20px]' : 'rounded-l-[20px]') : left ? 'rounded-r-[22px]' : 'rounded-l-[22px]'
      } ${dragging ? 'transition-none' : 'transition-[width,border-radius] duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)]'}`}
    >
      {/* Drag handle lives in its own reserved gutter on the
          edge-facing side (rows container pads clear of it), so it
          never overlaps the icon column in either docked side. */}
      <div
        role="separator"
        aria-label={`Drag to dock ${left ? 'right' : 'left'}`}
        title="Drag to dock left or right"
        className={`absolute top-1/2 z-10 flex h-11 w-[10px] -translate-y-1/2 cursor-grab touch-none items-center justify-center active:cursor-grabbing ${left ? 'left-0' : 'right-0'}`}
        {...dragHandleProps}
      >
        <span className="h-6 w-[2px] rounded-full bg-white/25" aria-hidden />
      </div>
      <div className={`custom-scrollbar flex flex-col gap-0.5 overflow-y-auto py-2 ${left ? 'pl-2.5' : 'pr-2.5'}`}>
        <AnimatePresence initial={false}>
          {visibleRows.map((row) => {
            const Icon = row.icon;
            return (
              <motion.button
                key={row.panelId}
                type="button"
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 48 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
                onClick={() => openRow(row)}
                title={`Open ${row.label}`}
                aria-label={`Open ${row.label}`}
                className="flex h-12 w-full shrink-0 items-center overflow-hidden px-2 text-left transition-colors hover:bg-white/5"
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
                {expanded && (
                  <span className="ml-3 flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
                    <span className="truncate text-[13px] font-medium leading-tight text-slate-100">{row.label}</span>
                    <span className="truncate text-[11.5px] leading-tight text-slate-400">{row.preview}</span>
                  </span>
                )}
                {expanded && row.count !== null && (
                  <span className="ml-2 shrink-0 rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-slate-300">
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
          onClick={togglePin}
          title={pinned ? 'Unpin — collapse on pointer leave' : 'Pin open'}
          aria-pressed={pinned}
          className={`flex h-11 shrink-0 items-center gap-2 border-t border-white/10 px-4 text-[12px] font-medium transition-colors hover:bg-white/5 ${pinned ? 'text-[#00d890]' : 'text-slate-400'}`}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden /> : <Pin className="h-3.5 w-3.5" aria-hidden />}
          {pinned ? 'Unpin' : 'Pin open'}
        </button>
      )}
    </nav>
    </>
  );
}
