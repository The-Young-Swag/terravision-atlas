import { useState, useMemo } from 'react';
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
  Crosshair,
  Ruler,
  Navigation,
  X,
} from 'lucide-react';

type AppMode = 'explore' | 'monitor' | 'survey';
type UnitSystem = 'metric' | 'imperial';
type EfficiencyUnit = 'kml' | 'l100km' | 'mpg';

interface FuelState {
  distance: number;
  efficiency: number;
  efficiencyUnit: EfficiencyUnit;
  price: number;
  unitSystem: UnitSystem;
}

const mockAlerts = [
  {
    id: '1',
    severity: 'high' as const,
    label: 'HIGH · Earthquake',
    color: '#E63946',
    title: 'M6.1 — 40km NE of Baguio City',
    time: '2m ago',
  },
  {
    id: '2',
    severity: 'medium' as const,
    label: 'MEDIUM · Wildfire',
    color: '#FF9F1C',
    title: 'Detected via FIRMS — Zambales foothills',
    time: '14m ago',
  },
  {
    id: '3',
    severity: 'low' as const,
    label: 'LOW · Flood watch',
    color: '#2EC4B6',
    title: 'GloFAS forecast — Pampanga River basin',
    time: '41m ago',
  },
];

function calculateFuel(state: FuelState) {
  const { distance, efficiency, efficiencyUnit, price, unitSystem } = state;

  let fuelNeeded = 0;
  let kmPerLEquivalent = 0;

  if (unitSystem === 'metric') {
    const kmPerL =
      efficiencyUnit === 'kml' ? efficiency : efficiency > 0 ? 100 / efficiency : 0;
    kmPerLEquivalent = kmPerL;
    fuelNeeded = kmPerL > 0 ? distance / kmPerL : 0;
  } else {
    // imperial: distance in miles, efficiency in MPG, price per gallon, fuel in gallons
    const mpg = efficiency;
    kmPerLEquivalent = mpg * 0.425144;
    fuelNeeded = mpg > 0 ? distance / mpg : 0;
  }

  const totalCost = fuelNeeded * price;
  const costPerUnit = distance > 0 ? totalCost / distance : 0;
  const gaugePercent = Math.max(0, Math.min(100, ((kmPerLEquivalent - 5) / 15) * 100));

  return { fuelNeeded, totalCost, costPerUnit, gaugePercent };
}

export default function App() {
  const [activeMode, setActiveMode] = useState<AppMode>('explore');
  const [basemap, setBasemap] = useState<'satellite' | 'streets' | 'terrain' | 'dark'>(
    'satellite',
  );
  const [fuelOpen, setFuelOpen] = useState(false);
  const [fuelState, setFuelState] = useState<FuelState>({
    distance: 120,
    efficiency: 14,
    efficiencyUnit: 'kml',
    price: 65,
    unitSystem: 'metric',
  });

  const fuelResult = useMemo(() => calculateFuel(fuelState), [fuelState]);

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

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0A0E19] text-slate-100 selection:bg-[#5500a4]/30">
      {/* Map canvas */}
      <div className="map-canvas absolute inset-0">
        {/* Contour lines */}
        <svg
          className="absolute inset-0 h-full w-full opacity-60"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M -50 300 C 200 250, 350 380, 600 320 S 950 250, 1200 340 S 1500 300, 1600 320"
            stroke="rgba(255,255,255,0.14)"
            fill="none"
            strokeWidth="1"
          />
          <path
            d="M -50 420 C 250 380, 400 480, 650 430 S 1000 370, 1250 460 S 1500 420, 1600 440"
            stroke="rgba(255,255,255,0.14)"
            fill="none"
            strokeWidth="1"
          />
          <path
            d="M -50 540 C 220 500, 420 600, 700 560 S 1050 500, 1300 580"
            stroke="rgba(255,255,255,0.14)"
            fill="none"
            strokeWidth="1"
          />
        </svg>

        {/* Simulated hazard markers */}
        <div className="absolute left-[34%] top-[38%]">
          <span className="absolute -inset-3 animate-ping rounded-full bg-[#E63946]/30" />
          <span className="relative block h-3 w-3 rounded-full bg-[#E63946] shadow-[0_0_0_3px_rgba(230,57,70,0.25)]" />
        </div>
        <div className="absolute left-[61%] top-[57%]">
          <span
            className="absolute -inset-3 animate-ping rounded-full bg-[#FF9F1C]/25"
            style={{ animationDuration: '2.4s' }}
          />
          <span className="relative block h-3 w-3 rounded-full bg-[#FF9F1C] shadow-[0_0_0_3px_rgba(255,140,0,0.22)]" />
        </div>
        <div className="absolute left-[47%] top-[24%]">
          <span className="relative block h-2.5 w-2.5 rounded-full bg-[#2EC4B6] shadow-[0_0_0_3px_rgba(46,196,182,0.2)]" />
        </div>

        {/* Center crosshair hint */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20">
          <Crosshair className="h-6 w-6" />
        </div>
      </div>

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

        {/* Mode switcher — segmented control */}
        <div className="glass hidden items-center gap-1 rounded-full p-1 text-[13px] font-medium text-slate-300 md:flex">
          {(['explore', 'monitor', 'survey'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`relative rounded-full px-4 py-1.5 capitalize transition ${
                activeMode === mode ? 'text-[#0B0F1A]' : 'hover:text-white'
              }`}
              aria-pressed={activeMode === mode}
            >
              {activeMode === mode && (
                <motion.span
                  layoutId="mode-thumb"
                  className="absolute inset-0 rounded-full bg-[#EAF0F7] shadow"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative">{mode}</span>
            </button>
          ))}
        </div>

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
              className={`rounded-full px-3 py-1.5 capitalize ${activeMode === mode ? 'bg-white text-[#0B0F1A]' : ''}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Left layers panel */}
      <aside className="glass absolute left-4 top-24 z-10 hidden w-64 rounded-2xl p-4 md:block">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-slate-200">
            <Layers className="h-4 w-4 text-slate-400" />
            Layers
          </h2>
          <button className="text-[12px] text-slate-400 hover:text-white">Reset</button>
        </div>

        <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Basemap</p>
        <div className="mb-4 grid grid-cols-4 gap-2">
          {(
            [
              ['satellite', 'linear-gradient(135deg,#1b3a2e,#0c1f18)'],
              ['streets', 'linear-gradient(135deg,#3a3f4b,#20232b)'],
              ['terrain', 'linear-gradient(135deg,#5a4a2f,#2c2416)'],
              ['dark', 'linear-gradient(135deg,#111726,#050810)'],
            ] as const
          ).map(([id, bg]) => (
            <button
              key={id}
              onClick={() => setBasemap(id)}
              aria-label={`Basemap ${id}`}
              className={`h-10 rounded-lg border transition ${
                basemap === id
                  ? 'border-[#6EB4FF] ring-2 ring-[#6EB4FF]/30'
                  : 'border-white/10 hover:border-white/20'
              }`}
              style={{ background: bg }}
            />
          ))}
        </div>

        <div className="mb-4 space-y-1">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/5">
            <input type="checkbox" defaultChecked className="rounded" />
            <span className="text-[13px] text-slate-200">Live hazards</span>
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#E63946]" />
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/5">
            <input type="checkbox" className="rounded" />
            <span className="text-[13px] text-slate-200">Traffic</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/5">
            <input type="checkbox" className="rounded" />
            <span className="text-[13px] text-slate-200">Terrain contours</span>
          </label>
        </div>

        <div className="border-t border-white/10 pt-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">View</p>
          <div className="glass flex rounded-xl p-1 text-[12.5px] text-slate-300">
            <button className="flex-1 rounded-lg bg-[#5500a4] py-1.5 text-white">2D Map</button>
            <button className="flex-1 rounded-lg py-1.5 hover:bg-white/5">3D Globe</button>
          </div>
          <p className="mt-2 font-mono text-[11px] text-slate-500">
            Host: 0.0.0.0:4900 · Vite 8 · Tailwind 4
          </p>
        </div>
      </aside>

      {/* Right alerts / incident center */}
      <aside className="glass absolute right-4 top-24 z-10 hidden w-72 rounded-2xl p-4 md:block">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-slate-200">
            {activeMode === 'monitor' ? 'Incident center' : 'Live alerts'}
          </h2>
          <span className="font-mono text-[10px] text-slate-400">3 active</span>
        </div>

        {activeMode === 'monitor' && (
          <div className="mb-3 flex gap-1.5">
            {['All', 'High', 'Medium', 'Low'].map((c, i) => (
              <span
                key={c}
                className={`rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] ${i === 0 ? 'bg-white/15 text-white' : 'text-slate-300'}`}
              >
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {mockAlerts.map((alert) => (
            <div
              key={alert.id}
              className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/[0.08]"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold" style={{ color: alert.color }}>
                  {alert.label}
                </span>
                <span className="font-mono text-[10px] text-slate-500">{alert.time}</span>
              </div>
              <p className="text-[12.5px] text-slate-300">{alert.title}</p>
            </div>
          ))}
        </div>

        <button className="mt-3 w-full rounded-xl bg-[#5500a4] py-2 text-[12.5px] font-medium text-white transition hover:brightness-110">
          Open disaster dashboard
        </button>
      </aside>

      {/* Mode docks */}
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

      {/* Bottom status bar */}
      <footer className="glass absolute bottom-4 left-4 right-4 z-10 flex flex-col gap-2 rounded-2xl px-4 py-2 font-mono text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <span>15.1450°N, 120.5887°E</span>
          {activeMode === 'survey' && <span>EPSG:32651 · UTM 51N</span>}
          {activeMode === 'monitor' && <span className="text-[#FF9F1C]">3 active incidents nearby</span>}
          <span className="hidden sm:inline">Zoom 11</span>
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
          {activeMode === 'explore' ? 'Pan & zoom the map' : activeMode === 'monitor' ? 'Monitoring 3 events' : 'Survey tools active'}
        </span>
      </div>

      {/* Fuel calculator modal */}
      <AnimatePresence>
        {fuelOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setFuelOpen(false);
            }}
          >
            <motion.div
              initial={{ y: 16, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 16, scale: 0.98 }}
              className="glass-strong w-full max-w-[420px] rounded-3xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Fuel className="h-5 w-5 text-[#5500a4]" />
                  <h2 className="text-[15px] font-semibold">Fuel efficiency calculator</h2>
                </div>
                <button
                  onClick={() => setFuelOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
                  aria-label="Close fuel calculator"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

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

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="mb-1 text-[11px] text-slate-400">Fuel needed</p>
                    <p className="font-mono text-[18px] font-semibold">
                      {fuelResult.fuelNeeded.toFixed(1)} {unitLabels.fuelSuffix}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="mb-1 text-[11px] text-slate-400">Total cost</p>
                    <p className="font-mono text-[18px] font-semibold text-[#00d890]">
                      ₱{fuelResult.totalCost.toFixed(2)}
                    </p>
                  </div>
                  <div className="col-span-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                    <span className="text-[12px] text-slate-400">Cost per {unitLabels.distanceSuffix}</span>
                    <span className="font-mono text-[13px] text-slate-200">
                      ₱{fuelResult.costPerUnit.toFixed(2)} / {unitLabels.distanceSuffix}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-center font-mono text-[11px] text-slate-500">
                  Example: 25 km · 8.5 L/100km · ₱1.60/L → 2.1 L · ₱3.40 · 5.2 kg CO₂
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Branding footer hint */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-slate-400 backdrop-blur md:flex">
        <Globe className="h-3 w-3" />
        {fuelState.unitSystem === 'metric' ? 'Explore · Monitor · Survey' : 'Atlas engine · OpenLayers · Cesium · MapLibre'}
        <span className="h-3 w-px bg-white/10" />
        <AlertTriangle className="h-3 w-3 text-[#FF9F1C]" />
        Zero-cost · Client-side · Offline-ready
      </div>
    </div>
  );
}
