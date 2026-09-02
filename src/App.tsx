import { useState, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Settings2,
  Fuel,
  Compass,
  Layers,
  Map as MapIcon,
  Globe,
  AlertTriangle,
  Ruler,
  Navigation,
  X,
  Satellite,
  Mountain,
  Moon,
  Check,
  BookOpen,
  Box,
} from 'lucide-react';
import { OpenLayersMap } from './ui/components/map/OpenLayersMap';
import { FloatingPanel } from './ui/components/common/FloatingPanel';
import { useMapStore } from './stores/mapStore';
import { MapLibreMap } from './ui/components/map/MapLibreMap';
import { useDisaster } from './hooks/useDisaster';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { transformCoordinate, getEpsgList } from './core/geodetic/projections/epsg';

dayjs.extend(relativeTime);

const CesiumGlobe = lazy(() =>
  import('./ui/components/map/CesiumGlobe').then((m) => ({ default: m.CesiumGlobe })),
);

import { calculateFuel as calcFuel, formatCarbon } from './features/fuel/calculator/fuelMath';
import type { EfficiencyUnit, UnitSystem } from './features/fuel/calculator/fuelMath';
import { VEHICLE_PROFILES } from './features/fuel/profiles/vehicleProfiles';
import { FuelChart } from './ui/components/fuel/FuelChart';
import { StoryBuilder } from './features/storytelling/builder/StoryBuilder';
import { MinecraftExport } from './features/export/minecraft/MinecraftExport';
import { Car, Truck, Bike, Bus } from 'lucide-react';

type AppMode = 'explore' | 'monitor' | 'survey';

interface FuelState {
  distance: number;
  efficiency: number;
  efficiencyUnit: EfficiencyUnit;
  price: number;
  unitSystem: UnitSystem;
  vehicleId: string;
  fuelType: 'gasoline' | 'diesel' | 'electric';
}

const severityConfig = {
  high: { label: 'HIGH', color: '#E63946' },
  medium: { label: 'MEDIUM', color: '#FF9F1C' },
  low: { label: 'LOW', color: '#2EC4B6' },
} as const;

function formatTimeAgo(iso: string): string {
  return dayjs(iso).fromNow();
}

function getVehicleIcon(icon: string) {
  switch (icon) {
    case 'suv':
      return Bus;
    case 'motorcycle':
      return Bike;
    case 'truck':
      return Truck;
    default:
      return Car;
  }
}

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

export default function App() {
  const [activeMode, setActiveMode] = useState<AppMode>('explore');
  const [fuelOpen, setFuelOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [minecraftOpen, setMinecraftOpen] = useState(false);
  const [alertQuery, setAlertQuery] = useState('');
  const [targetEpsg, setTargetEpsg] = useState('EPSG:32651');
  const { events: disasterEvents, loading: disasterLoading, lastUpdated, refresh: refreshDisasters } =
    useDisaster();
  const disasterCount = disasterEvents.length;
  const [fuelState, setFuelState] = useState<FuelState>({
    distance: 120,
    efficiency: 14,
    efficiencyUnit: 'kml',
    price: 65,
    unitSystem: 'metric',
    vehicleId: 'car',
    fuelType: 'gasoline',
  });

  const {
    basemap,
    viewMode,
    showHazards,
    showTraffic,
    showTerrainContours,
    center,
    zoom,
    setBasemap,
    setViewMode,
    setShowHazards,
    setShowTraffic,
    setShowTerrainContours,
  } = useMapStore();

  const isBrightBasemap = basemap === 'streets' || basemap === 'terrain';

  const filteredDisasterEvents = useMemo(() => {
    if (!alertQuery.trim()) return disasterEvents;
    const q = alertQuery.toLowerCase();
    return disasterEvents.filter((e) => e.title.toLowerCase().includes(q));
  }, [disasterEvents, alertQuery]);

  const displayEvents = useMemo(() => filteredDisasterEvents.slice(0, 5), [filteredDisasterEvents]);

  const fuelResult = useMemo(
    () =>
      calcFuel({
        distance: fuelState.distance,
        efficiency: fuelState.efficiency,
        efficiencyUnit: fuelState.efficiencyUnit,
        price: fuelState.price,
        unitSystem: fuelState.unitSystem,
        fuelType: fuelState.fuelType,
      }),
    [fuelState],
  );

  const unitLabels = useMemo(() => {
    if (fuelState.unitSystem === 'metric') {
      return {
        distance: 'Trip distance (km)',
        price: 'Fuel price (₱ per liter)',
        fuelSuffix: 'L',
        distanceSuffix: 'km',
      };
    }
    return {
      distance: 'Trip distance (mi)',
      price: 'Fuel price (₱ per gallon)',
      fuelSuffix: 'gal',
      distanceSuffix: 'mi',
    };
  }, [fuelState.unitSystem]);

  const centerLabel = useMemo(() => {
    const [lon, lat] = center;
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
  }, [center]);

  const geodeticTransformed = useMemo(() => {
    try {
      const [x, y] = transformCoordinate('EPSG:4326', targetEpsg, center);
      return { x, y, error: null as string | null };
    } catch (err) {
      return { x: 0, y: 0, error: err instanceof Error ? err.message : 'Transform failed' };
    }
  }, [center, targetEpsg]);

  const wgs84Label = useMemo(
    () => `${center[1].toFixed(5)}°N, ${center[0].toFixed(5)}°E`,
    [center],
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0A0E19] text-slate-100 selection:bg-[#5500a4]/30">
      {/* Real 2D map or 3D placeholder — map is the primary workspace */}
      <div className="absolute inset-0">
        {viewMode === '2d' ? (
          <OpenLayersMap />
        ) : viewMode === 'vector' ? (
          <MapLibreMap />
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center bg-[#0A0E19]">
                <div className="glass rounded-2xl px-6 py-8 text-center">
                  <Globe className="mx-auto mb-3 h-8 w-8 animate-pulse text-[#5500a4]" />
                  <p className="text-[14px] font-medium text-slate-200">Loading 3D Globe…</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">Cesium engine initializing</p>
                </div>
              </div>
            }
          >
            <CesiumGlobe />
          </Suspense>
        )}

        {/* Subtle overlay for depth when in 2D — keeps glass panels legible without obscuring map */}
        {viewMode === '2d' && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
        )}
      </div>

      {/* Bright basemap readability overlay */}
      {isBrightBasemap && (
        <div className="pointer-events-none absolute inset-0 bg-black/10" aria-hidden />
      )}

      {/* Top bar */}
      <header className="absolute left-4 right-4 top-4 z-20 flex items-center gap-3">
        <div className="glass-strong flex shrink-0 items-center gap-2.5 rounded-2xl px-4 py-2.5">
          <Compass className="h-5 w-5 text-[#5500a4]" aria-hidden />
          <span className="text-[15px] font-semibold tracking-tight">TerraVision</span>
          <span className="text-[11px] font-medium tracking-widest text-slate-400">ATLAS</span>
        </div>

        <div className="glass flex max-w-md flex-1 items-center gap-2.5 rounded-2xl px-4 py-2.5 text-slate-300">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input
            className="flex-1 bg-transparent text-[13.5px] placeholder:text-slate-400 focus:outline-none"
            placeholder="Search place, coordinate, or event…"
            aria-label="Search"
          />
          <kbd className="hidden rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:block">
            ⌘K
          </kbd>
        </div>

        {/* Mode switcher — Explore / Monitor / Survey with per-mode colors */}
        <div className="glass hidden items-center gap-1 rounded-full p-1 text-[13px] font-medium text-slate-300 md:flex">
          {(['explore', 'monitor', 'survey'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`relative rounded-full px-4 py-1.5 capitalize transition ${
                activeMode === mode ? 'text-white' : 'hover:text-white'
              }`}
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
          className="glass flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-300 transition hover:text-white"
          aria-label="Open storytelling"
        >
          <BookOpen className="h-[18px] w-[18px]" />
        </button>

        <button
          onClick={() => setMinecraftOpen(true)}
          className="glass flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-300 transition hover:text-white"
          aria-label="Open Minecraft export"
        >
          <Box className="h-[18px] w-[18px]" />
        </button>

        <button
          onClick={() => setFuelOpen(true)}
          className="glass flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-300 transition hover:text-white"
          aria-label="Open fuel calculator"
        >
          <Fuel className="h-[18px] w-[18px]" />
        </button>

        <button
          className="glass hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-300 transition hover:text-white md:flex"
          aria-label="Settings"
        >
          <Settings2 className="h-[18px] w-[18px]" />
        </button>
      </header>

      {/* Mobile mode switcher */}
      <div className="absolute left-4 right-4 top-[4.75rem] z-20 flex justify-center md:hidden">
        <div className="glass flex items-center gap-1 rounded-full p-1 text-[13px] font-medium text-slate-300">
          {(['explore', 'monitor', 'survey'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`rounded-full px-3 py-1.5 capitalize transition ${
                activeMode === mode ? `${getModeColor(mode)} text-white shadow` : 'hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Layers — draggable floating panel */}
      <FloatingPanel
        id="layers"
        title="Layers"
        icon={<Layers className="h-3.5 w-3.5" />}
        initialPosition={{ x: 16, y: 96 }}
        bubbleLabel="Layers"
      >
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className={`text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-500'}`}>
              Basemap
            </p>
            <button
              onClick={() => {
                setBasemap('satellite');
                setShowHazards(true);
                setShowTraffic(false);
                setShowTerrainContours(false);
              }}
              className={`text-[12px] ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
            >
              Reset
            </button>
          </div>

          <div className="mb-4 space-y-1.5">
            {(
              [
                {
                  id: 'satellite' as const,
                  label: 'Satellite',
                  desc: 'Esri World Imagery',
                  icon: Satellite,
                  preview: 'linear-gradient(135deg,#1e3a2e 0%,#0f1f18 100%)',
                },
                {
                  id: 'streets' as const,
                  label: 'Streets',
                  desc: 'OpenStreetMap',
                  icon: MapIcon,
                  preview: 'linear-gradient(135deg,#3a3f4b 0%,#20232b 100%)',
                },
                {
                  id: 'terrain' as const,
                  label: 'Terrain',
                  desc: 'OpenTopoMap',
                  icon: Mountain,
                  preview: 'linear-gradient(135deg,#5a4a2f 0%,#2c2416 100%)',
                },
                {
                  id: 'dark' as const,
                  label: 'Dark',
                  desc: 'Grayscale · Wikimedia',
                  icon: Moon,
                  preview: 'linear-gradient(135deg,#111726 0%,#050810 100%)',
                },
              ] as const
            ).map((option) => {
              const Icon = option.icon;
              const isActive = basemap === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => setBasemap(option.id)}
                  aria-label={`Basemap ${option.label}`}
                  aria-pressed={isActive}
                  className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                    isActive
                      ? 'border-[#5500a4] bg-[#5500a4]/10 text-white'
                      : isBrightBasemap
                        ? 'border-black/10 bg-white/60 text-slate-700 hover:border-black/15 hover:bg-white/80 hover:text-slate-900'
                        : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/15 hover:bg-white/[0.07] hover:text-white'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[12px] transition ${
                      isActive
                        ? 'border-[#5500a4]/30 bg-[#5500a4] text-white'
                        : 'border-white/10 bg-white/5 text-slate-400 group-hover:text-slate-200'
                    }`}
                    style={!isActive ? { background: option.preview } : undefined}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[13px] font-medium leading-none">{option.label}</span>
                    <span className={`block text-[11px] ${isBrightBasemap && !isActive ? 'text-slate-500' : 'text-slate-400'}`}>
                      {option.desc}
                    </span>
                  </span>
                  {isActive ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5500a4] text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : (
                    <span
                      className={`h-5 w-5 shrink-0 rounded-full border group-hover:border-white/20 ${
                        isBrightBasemap ? 'border-black/10' : 'border-white/10'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mb-4 space-y-1">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/5">
              <input
                type="checkbox"
                checked={showHazards}
                onChange={(e) => setShowHazards(e.target.checked)}
                className="rounded"
              />
              <span className={`text-[13px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>Live hazards</span>
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#E63946]" />
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/5">
              <input
                type="checkbox"
                checked={showTraffic}
                onChange={(e) => setShowTraffic(e.target.checked)}
                className="rounded"
              />
              <span className={`text-[13px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>Traffic</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/5">
              <input
                type="checkbox"
                checked={showTerrainContours}
                onChange={(e) => setShowTerrainContours(e.target.checked)}
                className="rounded"
              />
              <span className={`text-[13px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>Terrain contours</span>
            </label>
          </div>

          <div className="border-t border-white/10 pt-3">
            <p className={`mb-2 text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-500'}`}>View</p>
            <div className={`glass flex rounded-xl p-1 text-[11px] ${isBrightBasemap ? 'bg-white/40' : ''} text-slate-300`}>
              <button
                onClick={() => setViewMode('2d')}
                className={`flex-1 rounded-lg py-1.5 ${viewMode === '2d' ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-700 hover:bg-black/5' : 'hover:bg-white/5'}`}
              >
                2D Map
              </button>
              <button
                onClick={() => setViewMode('vector')}
                className={`flex-1 rounded-lg py-1.5 ${viewMode === 'vector' ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-700 hover:bg-black/5' : 'hover:bg-white/5'}`}
              >
                Vector
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`flex-1 rounded-lg py-1.5 ${viewMode === '3d' ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-700 hover:bg-black/5' : 'hover:bg-white/5'}`}
              >
                3D Globe
              </button>
            </div>
            <p className={`mt-2 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-500'}`}>
              {centerLabel} · Zoom {zoom.toFixed(1)} ·{' '}
              {viewMode === '2d' ? 'OpenLayers' : viewMode === 'vector' ? 'MapLibre' : 'Cesium'}
            </p>
          </div>
        </div>
      </FloatingPanel>

      {/* Geodetic — draggable floating panel, only in Survey mode */}
      {activeMode === 'survey' && (
        <FloatingPanel
          id="geodetic"
          title="Geodetic"
          icon={<Ruler className="h-3.5 w-3.5" />}
          initialPosition={{ x: 16, y: 420 }}
          bubbleLabel="Geodetic"
        >
          <div>
            <div className="mb-3">
              <p className={`mb-1 text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-500'}`}>
                WGS84 (EPSG:4326)
              </p>
              <p className={`font-mono text-[12px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>{wgs84Label}</p>
            </div>

            <div className="mb-3">
              <label className={`mb-1 block text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-500'}`}>
                Target projection
              </label>
              <select
                value={targetEpsg}
                onChange={(e) => setTargetEpsg(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 font-mono text-[12px] outline-none focus:border-[#5500a4]/50 ${
                  isBrightBasemap
                    ? 'border-black/10 bg-white/70 text-slate-800'
                    : 'border-white/10 bg-white/5 text-slate-200'
                }`}
              >
                {getEpsgList().map((epsg) => (
                  <option key={epsg.code} value={epsg.code} className="bg-[#0D1B2A]">
                    {epsg.code} — {epsg.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={`rounded-xl border p-3 ${isBrightBasemap ? 'border-black/10 bg-white/60' : 'border-white/10 bg-white/[0.04]'}`}>
              <p className={`mb-1 text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-500'}`}>{targetEpsg}</p>
              {geodeticTransformed.error ? (
                <p className="font-mono text-[11px] text-[#E63946]">{geodeticTransformed.error}</p>
              ) : (
                <p className={`font-mono text-[12px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>
                  E: {geodeticTransformed.x.toFixed(2)}
                  <br />
                  N: {geodeticTransformed.y.toFixed(2)} <span className={isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}>m</span>
                </p>
              )}
            </div>

            <p className={`mt-3 text-center font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-500'}`}>
              Powered by Proj4js · 5,000+ EPSG via custom grids
            </p>
          </div>
        </FloatingPanel>
      )}

      {/* Live Alerts / Incident center — draggable floating panel with search */}
      <FloatingPanel
        id="alerts"
        title={activeMode === 'monitor' ? 'Incident center' : 'Live alerts'}
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        initialPosition={{ x: 900, y: 96 }}
        bubbleLabel={activeMode === 'monitor' ? 'Incident center' : 'Live alerts'}
      >
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className={`font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
              {disasterLoading ? 'updating…' : `${disasterCount} active`}
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search
              className={`absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isBrightBasemap ? 'text-slate-500' : 'text-slate-400'}`}
              aria-hidden
            />
            <input
              value={alertQuery}
              onChange={(e) => setAlertQuery(e.target.value)}
              placeholder="Search by country, city, town…"
              aria-label="Search alerts by location"
              className={`w-full rounded-xl border py-2 pl-8 pr-3 text-[12.5px] outline-none focus:border-[#5500a4]/50 ${
                isBrightBasemap
                  ? 'border-black/10 bg-white/70 text-slate-800 placeholder:text-slate-500'
                  : 'border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-400'
              }`}
            />
          </div>

          {activeMode === 'monitor' && (
            <div className="mb-3 flex gap-1.5">
              {['All', 'High', 'Medium', 'Low'].map((c, i) => (
                <span
                  key={c}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    i === 0
                      ? isBrightBasemap
                        ? 'border-black/10 bg-slate-800 text-white'
                        : 'border-white/10 bg-white/15 text-white'
                      : isBrightBasemap
                        ? 'border-black/10 bg-white/60 text-slate-700'
                        : 'border-white/10 bg-white/5 text-slate-300'
                  }`}
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {disasterLoading && disasterEvents.length === 0 ? (
              <div className={`py-8 text-center font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
                Loading live data…
              </div>
            ) : disasterEvents.length === 0 ? (
              <div className={`py-8 text-center text-[12px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>No active events</div>
            ) : filteredDisasterEvents.length === 0 ? (
              <div className={`py-8 text-center text-[12px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
                No alerts match &lsquo;{alertQuery}&rsquo;
              </div>
            ) : (
              displayEvents.map((event) => {
                const cfg = severityConfig[event.severity];
                return (
                  <div
                    key={event.id}
                    className={`cursor-pointer rounded-xl border p-3 transition ${
                      isBrightBasemap
                        ? 'border-black/10 bg-white/60 hover:bg-white/80'
                        : 'border-white/10 bg-white/5 hover:bg-white/[0.08]'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>
                        {cfg.label} · {event.type}
                      </span>
                      <span className={`font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-500'}`}>
                        {formatTimeAgo(event.occurredAt)}
                      </span>
                    </div>
                    <p className={`text-[12.5px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-300'}`}>{event.title}</p>
                    <p className={`mt-1 font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-500'}`}>{event.source}</p>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => refreshDisasters()}
            className="mt-3 w-full rounded-xl bg-[#5500a4] py-2 text-[12.5px] font-medium text-white transition hover:brightness-110"
          >
            {disasterLoading ? 'Refreshing…' : 'Refresh live data'}
          </button>
          {lastUpdated && (
            <p className={`mt-2 text-center font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-500'}`}>
              Updated {formatTimeAgo(lastUpdated)}
            </p>
          )}
        </div>
      </FloatingPanel>

      {/* Mode docks — floating, draggable intent via Framer Motion */}
      <AnimatePresence>
        {activeMode === 'monitor' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="glass-strong absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-2xl px-2 py-2"
          >
            <button className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] text-slate-200 hover:bg-white/10">
              <Navigation className="h-3.5 w-3.5" />
              Evacuation route
            </button>
            <span className="h-5 w-px bg-white/10" />
            <button className="rounded-xl px-3 py-2 text-[12.5px] text-slate-200 hover:bg-white/10">
              Nearest shelter
            </button>
            <span className="h-5 w-px bg-white/10" />
            <button className="rounded-xl px-3 py-2 text-[12.5px] text-[#E63946] hover:bg-white/10">
              Report incident
            </button>
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
            <button className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] text-slate-200 hover:bg-white/10">
              <MapIcon className="h-3.5 w-3.5" />
              Snap to grid
            </button>
            <span className="h-5 w-px bg-white/10" />
            <button className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] text-slate-200 hover:bg-white/10">
              <Ruler className="h-3.5 w-3.5" />
              Measure geodesic
            </button>
            <span className="h-5 w-px bg-white/10" />
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-[12px] text-slate-400">Datum</span>
              <select className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[12px] outline-none">
                <option>WGS84</option>
                <option>NAD83</option>
                <option>ETRS89</option>
                <option>PRS92</option>
              </select>
            </div>
            <span className="h-5 w-px bg-white/10" />
            <button className="rounded-xl px-3 py-2 text-[12.5px] text-slate-200 hover:bg-white/10">
              Export A0
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom status bar — live map state */}
      <footer className="glass absolute bottom-4 left-4 right-4 z-10 flex flex-col gap-2 rounded-2xl px-4 py-2 font-mono text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <span>{centerLabel}</span>
          {activeMode === 'survey' && <span>EPSG:32651 · UTM 51N</span>}
          {activeMode === 'monitor' && (
            <span className="text-[#FF9F1C]">{disasterCount} active incidents nearby</span>
          )}
          <span className="hidden sm:inline">Zoom {zoom.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1.5 font-sans text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00d890]" />
          Live · updated 12s ago
        </div>
        <div className="hidden items-center gap-4 sm:flex">
          <span>1 : 150,000</span>
          <span>50 km</span>
        </div>
      </footer>

      {/* Floating action hint for mobile */}
      <div className="absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 gap-2 md:hidden">
        <span className="glass rounded-full px-3 py-1.5 text-[11px] text-slate-300">
          {activeMode === 'explore'
            ? 'Pan & zoom the map'
            : activeMode === 'monitor'
              ? `Monitoring ${disasterCount} events`
              : 'Survey tools active'}
        </span>
      </div>

      {/* Fuel Efficiency Calculator — draggable floating panel */}
      {fuelOpen && (
        <FloatingPanel
          id="fuel"
          title="Fuel efficiency calculator"
          icon={<Fuel className="h-3.5 w-3.5" />}
          initialPosition={{ x: 350, y: 80 }}
          onClose={() => setFuelOpen(false)}
          bubbleLabel="Fuel calculator"
          className="!w-[380px] md:!w-[440px]"
        >
          <div>
            <div className="mb-4 flex rounded-xl border border-white/10 bg-white/5 p-1 text-[13px] text-slate-300">
              <button
                onClick={() => setFuelState((s) => ({ ...s, unitSystem: 'metric' }))}
                className={`flex-1 rounded-lg py-1.5 ${fuelState.unitSystem === 'metric' ? 'bg-[#5500a4] text-white' : ''}`}
              >
                Metric (km, L)
              </button>
              <button
                onClick={() => setFuelState((s) => ({ ...s, unitSystem: 'imperial' }))}
                className={`flex-1 rounded-lg py-1.5 ${fuelState.unitSystem === 'imperial' ? 'bg-[#5500a4] text-white' : ''}`}
              >
                Imperial (mi, gal)
              </button>
            </div>

            {/* Vehicle profiles — quick presets */}
            <div className="mb-4">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Vehicle profile</p>
              <div className="grid grid-cols-4 gap-2">
                {VEHICLE_PROFILES.map((profile) => {
                  const Icon = getVehicleIcon(profile.icon);
                  const isActive = fuelState.vehicleId === profile.id;
                  return (
                    <button
                      key={profile.id}
                      onClick={() =>
                        setFuelState((s) => ({
                          ...s,
                          vehicleId: profile.id,
                          efficiency: profile.efficiency,
                          efficiencyUnit: profile.efficiencyUnit,
                          fuelType: profile.fuelType,
                        }))
                      }
                      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition ${
                        isActive
                          ? 'border-[#5500a4] bg-[#5500a4]/15 text-white'
                          : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/15 hover:bg-white/[0.07] hover:text-white'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="text-[11px] font-medium leading-none">{profile.name}</span>
                      <span className="text-[10px] text-slate-400">{profile.efficiency} km/L</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-center font-mono text-[10px] text-slate-500">
                {VEHICLE_PROFILES.find((p) => p.id === fuelState.vehicleId)?.description} ·{' '}
                {fuelState.fuelType}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500">
                  {unitLabels.distance}
                </label>
                <input
                  type="number"
                  value={fuelState.distance}
                  onChange={(e) =>
                    setFuelState((s) => ({ ...s, distance: Number(e.target.value) || 0 }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-[14px] outline-none focus:border-[#5500a4]/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500">
                  Fuel efficiency
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={fuelState.efficiency}
                    onChange={(e) =>
                      setFuelState((s) => ({ ...s, efficiency: Number(e.target.value) || 0 }))
                    }
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-[14px] outline-none focus:border-[#5500a4]/50"
                  />
                  <select
                    value={fuelState.efficiencyUnit}
                    onChange={(e) =>
                      setFuelState((s) => ({
                        ...s,
                        efficiencyUnit: e.target.value as EfficiencyUnit,
                      }))
                    }
                    className="w-32 rounded-xl border border-white/10 bg-white/5 px-2.5 text-[13px] outline-none"
                    disabled={fuelState.unitSystem === 'imperial'}
                  >
                    {fuelState.unitSystem === 'metric' ? (
                      <>
                        <option value="kml">km/L</option>
                        <option value="l100km">L/100km</option>
                      </>
                    ) : (
                      <option value="mpg">MPG (US)</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500">
                  {unitLabels.price}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={fuelState.price}
                  onChange={(e) =>
                    setFuelState((s) => ({ ...s, price: Number(e.target.value) || 0 }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-[14px] outline-none focus:border-[#5500a4]/50"
                />
              </div>
            </div>

            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="mb-3">
                <div className="mb-1.5 flex justify-between text-[11px] text-slate-400">
                  <span>Thirsty</span>
                  <span>Average</span>
                  <span>Efficient</span>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-gradient-to-r from-[#E63946] via-[#FF9F1C] to-[#2EC4B6]">
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0B0F1A] bg-white shadow"
                    style={{ left: `${fuelResult.gaugePercent}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-1 text-[11px] text-slate-400">Fuel needed</p>
                  <p className="font-mono text-[16px] font-semibold">
                    {fuelResult.fuelNeeded.toFixed(1)} {unitLabels.fuelSuffix}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-1 text-[11px] text-slate-400">Total cost</p>
                  <p className="font-mono text-[16px] font-semibold text-[#00d890]">
                    ₱{fuelResult.totalCost.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-1 text-[11px] text-slate-400">Carbon</p>
                  <p className="font-mono text-[13px] font-semibold text-[#FF9F1C]">
                    {formatCarbon(fuelResult.carbonKg)}
                  </p>
                </div>
                <div className="col-span-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                  <span className="text-[12px] text-slate-400">Cost per {unitLabels.distanceSuffix}</span>
                  <span className="font-mono text-[13px] text-slate-200">
                    ₱{fuelResult.costPerUnit.toFixed(2)} / {unitLabels.distanceSuffix}
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Breakdown
                </p>
                <FuelChart
                  fuelNeeded={fuelResult.fuelNeeded}
                  totalCost={fuelResult.totalCost}
                  carbonKg={fuelResult.carbonKg}
                  fuelUnit={unitLabels.fuelSuffix as 'L' | 'gal'}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const csv = `distance,efficiency,price,fuelNeeded,totalCost,carbon\n${fuelState.distance},${fuelState.efficiency},${fuelState.price},${fuelResult.fuelNeeded.toFixed(2)},${fuelResult.totalCost.toFixed(2)},${fuelResult.carbonKg.toFixed(2)}`;
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'terravision-fuel.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-medium text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="rounded-xl bg-[#5500a4] px-3 py-2 text-[12px] font-medium text-white hover:brightness-110"
                >
                  Print / PDF
                </button>
              </div>
              <p className="mt-3 text-center font-mono text-[11px] text-slate-500">
                Example: 25 km · 8.5 L/100km · ₱1.60/L → 2.1 L · ₱3.40 · {formatCarbon(2.1 * 2.31)}
              </p>
            </div>
          </div>
        </FloatingPanel>
      )}

      {/* Storytelling — draggable floating panel */}
      {storyOpen && (
        <FloatingPanel
          id="storytelling"
          title="Storytelling"
          icon={<BookOpen className="h-3.5 w-3.5" />}
          initialPosition={{ x: 400, y: 100 }}
          onClose={() => setStoryOpen(false)}
          bubbleLabel="Storytelling"
        >
          <StoryBuilder />
        </FloatingPanel>
      )}

      {/* Minecraft export modal — keep as centered modal (not required to float) */}
      <AnimatePresence>
        {minecraftOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setMinecraftOpen(false);
            }}
          >
            <motion.div
              initial={{ y: 16, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 16, scale: 0.98 }}
              className="glass-strong max-h-[85vh] w-full max-w-md overflow-hidden rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 border-b border-white/10 bg-[#0D1B2A]/95 px-5 py-3 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Box className="h-5 w-5 text-[#00d890]" />
                    <h2 className="text-[15px] font-semibold">Minecraft Export</h2>
                  </div>
                  <button
                    onClick={() => setMinecraftOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
                    aria-label="Close Minecraft export"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-5">
                <MinecraftExport />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Branding footer hint */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-slate-400 backdrop-blur md:flex">
        <Globe className="h-3 w-3" />
        {fuelState.unitSystem === 'metric'
          ? 'Explore · Monitor · Survey'
          : 'Atlas engine · OpenLayers · Cesium · MapLibre'}
        <span className="h-3 w-px bg-white/10" />
        <AlertTriangle className="h-3 w-3 text-[#FF9F1C]" />
        Zero-cost · Client-side · Offline-ready
      </div>
    </div>
  );
}
