import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { useMapStore } from '../../../stores/mapStore';
import { useRouteStore } from '../../../stores/routeStore';
import { ROUTE_LINE_COLOR } from '../../../core/map/routeStyle';
import { jogLoopAsEvacRoute } from '../../../features/routing/joggingLoop';
import {
  createCesiumViewer,
  flyToCesium,
  globeImageryCredit,
  type TerrainStatus,
} from '../../../core/map/cesium/createCesiumViewer';
import { useMapOverlayContrast } from '../../../hooks/useMapOverlayContrast';
import 'cesium/Build/Cesium/Widgets/widgets.css';

export function CesiumGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [terrain, setTerrain] = useState<TerrainStatus | null>(null);
  // Bumped when the async viewer creation finishes: route/pin overlays can
  // only attach to a live viewer, which does not exist on first render.
  const [viewerEpoch, setViewerEpoch] = useState(0);

  const { center, zoom } = useMapStore();
  const basemap = useMapStore((s) => s.basemap);
  const satelliteSource = useMapStore((s) => s.satelliteSource);

  // Adaptive contrast for in-map Cesium widgets
  const { theme } = useMapOverlayContrast();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || viewerRef.current) return;

    let cancelled = false;
    let viewer: Cesium.Viewer | null = null;

    createCesiumViewer({ container, center, zoom, basemap, satelliteSource })
      .then(({ viewer: v, terrain: terrainStatus }) => {
        if (cancelled) {
          v.destroy();
          return;
        }
        viewerRef.current = v;
        viewer = v;
        setTerrain(terrainStatus);
        setViewerEpoch((epoch) => epoch + 1);

        // Apply adaptive widget styles
        const applyWidgetStyles = () => {
          if (!viewer || viewer.isDestroyed()) return;

          const widgetContainer = container.querySelector('.cesium-widget-credits, .cesium-viewer-credits');
          if (widgetContainer) {
            (widgetContainer as HTMLElement).style.color = theme === 'light' ? '#475569' : '#cbd5e1';
          }

          // Home button
          const homeButton = container.querySelector('.cesium-home-button');
          if (homeButton) {
            (homeButton as HTMLElement).style.backgroundColor = theme === 'light' ? '#ffffff' : '#1e293b';
            (homeButton as HTMLElement).style.borderColor = theme === 'light' ? '#cbd5e1' : '#475569';
          }

          // Zoom controls
          const zoomControls = container.querySelectorAll('.cesium-zoom-control button');
          zoomControls.forEach((btn) => {
            const b = btn as HTMLElement;
            b.style.backgroundColor = theme === 'light' ? '#ffffff' : '#1e293b';
            b.style.color = theme === 'light' ? '#1e293b' : '#f8fafc';
            b.style.borderColor = theme === 'light' ? '#cbd5e1' : '#475569';
          });

          // Compass
          const compass = container.querySelector('.cesium-compass');
          if (compass) {
            (compass as HTMLElement).style.filter = theme === 'light' ? 'invert(0)' : 'invert(1)';
          }

          // Geocoder (if enabled)
          const geocoder = container.querySelector('.cesium-geocoder');
          if (geocoder) {
            (geocoder as HTMLElement).style.backgroundColor = theme === 'light' ? '#ffffff' : '#1e293b';
            (geocoder as HTMLElement).style.color = theme === 'light' ? '#1e293b' : '#f8fafc';
          }
        };

        // Handle resize
        const ro = new ResizeObserver(() => {
          v.resize();
          applyWidgetStyles();
        });
        ro.observe(container);

        // Apply styles after initial render and on each frame
        let frameId = 0;
        const applyLoop = () => {
          applyWidgetStyles();
          frameId = requestAnimationFrame(applyLoop);
        };
        applyLoop();

        // Store for cleanup
        (container as unknown as { __ro?: ResizeObserver; __frameId?: number }).__ro = ro;
        (container as unknown as { __frameId?: number }).__frameId = frameId;
      })
      .catch((err) => {
        console.error('[Cesium] failed to create viewer', err);
      });

    return () => {
      cancelled = true;
      const containerData = container as unknown as { __ro?: ResizeObserver; __frameId?: number };
      if (containerData.__ro) containerData.__ro.disconnect();
      if (containerData.__frameId) cancelAnimationFrame(containerData.__frameId);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        try {
          viewerRef.current.destroy();
        } catch {
          // ignore
        }
        viewerRef.current = null;
      }
      if (viewer) {
        try {
          if (!viewer.isDestroyed()) viewer.destroy();
        } catch {
          // ignore
        }
      }
    };
    // Only initialize once — center/zoom sync handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap, satelliteSource]); // Re-create viewer when basemap/satellite source changes

  // Sync center/zoom when store changes (e.g., search fly-to)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    flyToCesium(viewer, center, zoom);
  }, [center, zoom]);

  // Navigation route overlay: white-cased brand-blue polyline clamped to
  // terrain (Ion mesh when available) plus green start / red end points —
  // the same shared treatment as the 2D and Vector maps. The two coplanar
  // ground-clamped lines are ordered with polyline zIndex (casing below,
  // blue above): per Cesium's PolylineGraphics docs, zIndex orders ground
  // geometry when clampToGround is true, which resolves the overlap
  // deterministically instead of z-fighting. Polyline widths above 1px are
  // best-effort (platform-dependent); the blue hue outside the
  // traffic-speed palette carries the distinction.
  const navRoute = useRouteStore((s) => s.route);
  const navJog = useRouteStore((s) => s.jogLoop);
  const navLine = navRoute ?? (navJog ? jogLoopAsEvacRoute(navJog) : null);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const entities = viewer.entities;
    for (const entity of [...entities.values]) {
      if ((entity.properties?.getValue?.(Cesium.JulianDate.now()) as { nav?: boolean } | undefined)?.nav) {
        entities.remove(entity);
      }
    }
    if (!navLine || navLine.path.length < 2) return;
    const positions = navLine.path.map((point) => Cesium.Cartesian3.fromDegrees(point.lon, point.lat));
    const addLine = (width: number, color: Cesium.Color, zIndex: number) => {
      entities.add({
        properties: { nav: true },
        polyline: {
          positions,
          width,
          material: color,
          clampToGround: true,
          zIndex,
        },
      });
    };
    addLine(7, Cesium.Color.WHITE, 0);
    addLine(4, Cesium.Color.fromCssColorString(ROUTE_LINE_COLOR), 1);
    const addPin = (lon: number, lat: number, color: Cesium.Color) => {
      entities.add({
        properties: { nav: true },
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: 12,
          color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
    };
    const first = navLine.path[0];
    const last = navLine.path[navLine.path.length - 1];
    if (first) addPin(first.lon, first.lat, Cesium.Color.fromCssColorString('#00d890'));
    if (last) addPin(last.lon, last.lat, Cesium.Color.fromCssColorString('#E63946'));
  }, [navLine, viewerEpoch]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full bg-[#0A0E19]"
      aria-label="3D globe"
      role="region"
    >
      {/* Attribution: Cesium's built-in credit container is hidden (we use
          our own glass UI), so imagery + Ion credits render here and always
          reflect the currently active satellite source. */}
      <div className="pointer-events-none absolute bottom-1 right-2 z-10 rounded bg-black/45 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
        {globeImageryCredit(basemap, satelliteSource)}
        {terrain?.kind === 'ion' ? ' · Terrain © Cesium Ion' : null}
      </div>
      {/* Honest terrain-failure notice — never silently fall back to flat. */}
      {terrain && terrain.kind !== 'ion' && (
        <div className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-xl border border-amber-400/40 bg-black/70 px-4 py-2 text-center backdrop-blur">
          <p className="text-[12px] font-medium text-amber-300">
            Terrain unavailable — showing flat globe
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-300">
            {terrain.kind === 'no-token'
              ? 'VITE_CESIUM_ION_TOKEN is missing (see .env.example)'
              : `Cesium Ion error: ${terrain.message}`}
          </p>
        </div>
      )}
    </div>
  );
}
