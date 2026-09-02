import { Layers, Satellite, Map as MapIcon, Mountain, Moon, Check } from 'lucide-react';
import { FloatingPanel } from '../common/FloatingPanel';
import { useMapStore } from '../../../stores/mapStore';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useMemo } from 'react';

export function LayersPanel() {
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

  const isBrightBasemap = useBrightBasemap();

  const centerLabel = useMemo(() => {
    const [lon, lat] = center;
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
  }, [center]);

  return (
    <FloatingPanel
      id="layers"
      title="Layers"
      icon={<Layers className="h-3.5 w-3.5" />}
      initialPosition={{ x: 16, y: 96 }}
      bubbleLabel="Layers"
    >
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className={`text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-500'}`}>Basemap</p>
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
                className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${isActive ? 'border-[#5500a4] bg-[#5500a4]/10 text-white' : isBrightBasemap ? 'border-white/10 bg-white/[0.04] text-slate-800 hover:text-slate-900' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:text-white'}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[12px] transition ${isActive ? 'border-[#5500a4]/30 bg-[#5500a4] text-white' : isBrightBasemap ? 'border-white/10 bg-white/5 text-slate-600 group-hover:text-slate-800' : 'border-white/10 bg-white/5 text-slate-400 group-hover:text-slate-200'}`}
                  style={!isActive ? { background: option.preview } : undefined}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className={`block text-[13px] font-medium leading-none ${isBrightBasemap && !isActive ? 'text-slate-800' : ''}`}>{option.label}</span>
                  <span className={`block text-[11px] ${isBrightBasemap && !isActive ? 'text-slate-600' : 'text-slate-400'}`}>{option.desc}</span>
                </span>
                {isActive ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5500a4] text-white">
                    <Check className="h-3 w-3" />
                  </span>
                ) : (
                  <span className="h-5 w-5 shrink-0 rounded-full border border-white/10 group-hover:border-white/20" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mb-4 space-y-1">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/5">
            <input type="checkbox" checked={showHazards} onChange={(e) => setShowHazards(e.target.checked)} className="rounded" />
            <span className={`text-[13px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>Live hazards</span>
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#E63946]" />
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/5">
            <input type="checkbox" checked={showTraffic} onChange={(e) => setShowTraffic(e.target.checked)} className="rounded" />
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
          <div className="glass flex rounded-xl p-1 text-[11px]">
            <button
              onClick={() => setViewMode('2d')}
              className={`flex-1 rounded-lg py-1.5 hover:bg-white/5 ${viewMode === '2d' ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-800' : 'text-slate-300'}`}
            >
              2D Map
            </button>
            <button
              onClick={() => setViewMode('vector')}
              className={`flex-1 rounded-lg py-1.5 hover:bg-white/5 ${viewMode === 'vector' ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-800' : 'text-slate-300'}`}
            >
              Vector
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`flex-1 rounded-lg py-1.5 hover:bg-white/5 ${viewMode === '3d' ? 'bg-[#5500a4] text-white' : isBrightBasemap ? 'text-slate-800' : 'text-slate-300'}`}
            >
              3D Globe
            </button>
          </div>
          <p className={`mt-2 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-500'}`}>
            {centerLabel} · Zoom {zoom.toFixed(1)} · {viewMode === '2d' ? 'OpenLayers' : viewMode === 'vector' ? 'MapLibre' : 'Cesium'}
          </p>
        </div>
      </div>
    </FloatingPanel>
  );
}
