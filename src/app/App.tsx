import { useState, lazy, Suspense, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Box, BookOpen, X } from 'lucide-react';
import type { AppMode } from '../types';
import { OpenLayersMap } from '../features/map/components/OpenLayersMap';
import { MapLibreMap } from '../features/map/components/MapLibreMap';
import { useMapStore } from '../features/map/store';
import { useSurveyStore } from '../stores/surveyStore';
import { TopBar } from './components/TopBar';
import { LayersPanel } from './components/LayersPanel';
import { GeodeticPanel } from '../ui/components/panels/GeodeticPanel';
import { CoordinatePanel } from '../ui/components/geodetic/CoordinatePanel';
import { LiveAlertsPanel } from '../ui/components/panels/LiveAlertsPanel';
import { FuelPanel } from '../features/fuel';
import { ModeDocks } from '../ui/components/docks/ModeDocks';
import { EvacuationPanel } from '../features/navigation';
import { ShelterPanel } from '../features/shelters';
import { WeatherPanel } from '../ui/components/weather/WeatherPanel';
import { StatusBar } from './components/StatusBar';
import { StoryBuilder } from '../features/storytelling';
import { MinecraftExport } from '../features/export/minecraft/MinecraftExport';
import { FloatingPanel } from '../ui/components/common/FloatingPanel';
import { NotchSidebar } from './components/NotchSidebar';
import { MobileToolFab } from './components/MobileToolFab';

const CesiumGlobe = lazy(() => import('../features/map/components/CesiumGlobe').then((m) => ({ default: m.CesiumGlobe })));

export default function App() {
  const [activeMode, setActiveMode] = useState<AppMode>('explore');
  const [fuelOpen, setFuelOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [minecraftOpen, setMinecraftOpen] = useState(false);
  const { viewMode, showDatumViz } = useMapStore();
  const decodeSessionFromUrl = useSurveyStore((s) => s.decodeSessionFromUrl);
  const applySessionState = useSurveyStore((s) => s.applySessionState);

  // Restore survey session from URL on initial load
  useEffect(() => {
    const sessionState = decodeSessionFromUrl(window.location.search);
    if (sessionState) {
      applySessionState(sessionState);
    }
  }, [decodeSessionFromUrl, applySessionState]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0A0E19] text-slate-100 selection:bg-[#5500a4]/30">
      {/* Map */}
      <div className="absolute inset-0">
        {viewMode === '3d' ? (
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center bg-[#0A0E19]">
                <div className="glass rounded-2xl px-6 py-8 text-center">
                  <Globe className="mx-auto mb-3 h-8 w-8 animate-pulse text-[#5500a4]" />
                  <p className="text-[14px] font-medium text-slate-200">Loading 3D Globe…</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-300">Cesium engine initializing</p>
                </div>
              </div>
            }
          >
            <CesiumGlobe />
          </Suspense>
        ) : viewMode === 'vector' ? (
          <MapLibreMap />
        ) : (
          <OpenLayersMap />
        )}
        {viewMode === '2d' && <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />}
      </div>

      <TopBar
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        setFuelOpen={setFuelOpen}
        setStoryOpen={setStoryOpen}
        setMinecraftOpen={setMinecraftOpen}
      />

      <LayersPanel />
      {activeMode === 'survey' && <GeodeticPanel />}
      {activeMode === 'survey' && showDatumViz && <CoordinatePanel />}
      {activeMode === 'explore' && <EvacuationPanel context="general" />}
      {activeMode === 'monitor' && <EvacuationPanel context="evacuation" />}
      {activeMode === 'monitor' && <ShelterPanel />}
      {(activeMode === 'explore' || activeMode === 'monitor') && <WeatherPanel />}
      <LiveAlertsPanel activeMode={activeMode} />
      <ModeDocks activeMode={activeMode} />
      <StatusBar activeMode={activeMode} />
      <NotchSidebar activeMode={activeMode} onModeChange={setActiveMode} />
      <MobileToolFab activeMode={activeMode} />

      <FuelPanel open={fuelOpen} onClose={() => setFuelOpen(false)} />

      {storyOpen && (
        <FloatingPanel id="storytelling" title="Storytelling" icon={<BookOpen className="h-3.5 w-3.5" />} initialPosition={{ x: 400, y: 100 }} onClose={() => setStoryOpen(false)} bubbleLabel="Storytelling">
          <StoryBuilder />
        </FloatingPanel>
      )}

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
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
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
    </div>
  );
}
