import { useEffect, useMemo, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { useMapStore } from '../../../stores/mapStore';
import { useRouteStore } from '../../../stores/routeStore';
import { useDisasterStore } from '../../../stores/disasterStore';
import type { DisasterSeverity } from '../../../types';
import { DISASTER_SEVERITY_COLORS } from '../../../core/map/disasterStyle';
import { ROUTE_LINE_COLOR, ROUTE_STATUS_CASING_COLOR } from '../../../core/map/routeStyle';
import { routeStatusSegments } from '../../../features/traffic/flowStatus';
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
  const [viewerEpoch, setViewerEpoch] = useState(0);

  const { center, zoom } = useMapStore();
  const basemap = useMapStore((s) => s.basemap);
  const satelliteSource = useMapStore((s) => s.satelliteSource);

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

        const applyWidgetStyles = () => {
          if (!viewer || viewer.isDestroyed()) return;

          const widgetContainer = container.querySelector('.cesium-widget-credits, .cesium-viewer-credits');
          if (widgetContainer) {
            (widgetContainer as HTMLElement).style.color = theme === 'light' ? '#475569' : '#cbd5e1';
          }

          const homeButton = container.querySelector('.cesium-home-button');
          if (homeButton) {
            (homeButton as HTMLElement).style.backgroundColor = theme === 'light' ? '#ffffff' : '#1e293b';
            (homeButton as HTMLElement).style.borderColor = theme === 'light' ? '#cbd5e1' : '#475569';
          }

          const zoomControls = container.querySelectorAll('.cesium-zoom-control button');
          zoomControls.forEach((btn) => {
            const b = btn as HTMLElement;
            b.style.backgroundColor = theme === 'light' ? '#ffffff' : '#1e293b';
            b.style.color = theme === 'light' ? '#1e293b' : '#f8fafc';
            b.style.borderColor = theme === 'light' ? '#cbd5e1' : '#475569';
          });

          const compass = container.querySelector('.cesium-compass');
          if (compass) {
            (compass as HTMLElement).style.filter = theme === 'light' ? 'invert(0)' : 'invert(1)';
          }

          const geocoder = container.querySelector('.cesium-geocoder');
          if (geocoder) {
            (geocoder as HTMLElement).style.backgroundColor = theme === 'light' ? '#ffffff' : '#1e293b';
            (geocoder as HTMLElement).style.color = theme === 'light' ? '#1e293b' : '#f8fafc';
          }
        };

        const ro = new ResizeObserver(() => {
          v.resize();
          applyWidgetStyles();
        });
        ro.observe(container);

        let frameId = 0;
        const applyLoop = () => {
          applyWidgetStyles();
          frameId = requestAnimationFrame(applyLoop);
        };
        applyLoop();

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
  }, [basemap, satelliteSource, center, zoom, theme]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    flyToCesium(viewer, center, zoom);
  }, [center, zoom]);

  const navRoute = useRouteStore((s) => s.route);
  const navJog = useRouteStore((s) => s.jogLoop);
  const navLine = navRoute ?? (navJog ? jogLoopAsEvacRoute(navJog) : null);
  const navTraffic = useRouteStore((s) => s.trafficAdjustment);
  const navStatusSegments = useMemo(
    () => (navLine && navTraffic ? routeStatusSegments(navLine.path.length, navTraffic.samples) : []),
    [navLine, navTraffic],
  );

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
    const addLine = (linePositions: Cesium.Cartesian3[], width: number, color: Cesium.Color, zIndex: number) => {
      entities.add({
        properties: { nav: true },
        polyline: {
          positions: linePositions,
          width,
          material: color,
          clampToGround: true,
          zIndex,
        },
      });
    };
    if (navStatusSegments.length === 0) {
      addLine(positions, 7, Cesium.Color.WHITE, 0);
      addLine(positions, 4, Cesium.Color.fromCssColorString(ROUTE_LINE_COLOR), 1);
    } else {
      for (const segment of navStatusSegments) {
        const from = Math.max(0, Math.min(segment.fromIndex, positions.length - 1));
        const to = Math.max(from + 1, Math.min(segment.toIndex, positions.length - 1));
        const part = positions.slice(from, to + 1);
        if (part.length < 2) continue;
        addLine(part, 7, Cesium.Color.fromCssColorString(ROUTE_STATUS_CASING_COLOR), 0);
        addLine(part, 4, Cesium.Color.fromCssColorString(segment.color), 1);
      }
    }
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
  }, [navLine, navStatusSegments, viewerEpoch]);

  const disasterEvents = useDisasterStore((s) => s.events);
  const [pickedDisasterId, setPickedDisasterId] = useState<string | null>(null);
  const disasterDsRef = useRef<Cesium.DataSource | null>(null);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return undefined;
    let cancelled = false;
    if (disasterDsRef.current) {
      void viewer.dataSources.remove(disasterDsRef.current, true);
      disasterDsRef.current = null;
    }
    const geojson = {
      type: 'FeatureCollection',
      features: disasterEvents.map((event) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [event.longitude, event.latitude] },
        properties: {
          disasterId: event.id,
          title: event.title,
          type: event.type,
          severity: event.severity,
          source: event.source,
          occurredAt: event.occurredAt,
        },
      })),
    };
    Cesium.GeoJsonDataSource.load(geojson, { clampToGround: true })
      .then((dataSource) => {
        if (cancelled || viewer.isDestroyed()) return;
        for (const entity of dataSource.entities.values) {
          const severity =
            (entity.properties?.severity?.getValue(Cesium.JulianDate.now()) as string | undefined) ?? 'low';
          const color = Cesium.Color.fromCssColorString(
            DISASTER_SEVERITY_COLORS[severity as DisasterSeverity] ?? DISASTER_SEVERITY_COLORS.low,
          );
          entity.billboard = undefined;
          entity.point = new Cesium.PointGraphics({
            pixelSize: severity === 'high' ? 12 : 9,
            color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          });
          entity.label = new Cesium.LabelGraphics({
            text: entity.properties?.title?.getValue(Cesium.JulianDate.now()) as string | undefined,
            font: '11px Inter, sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -16),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          });
        }
        void viewer.dataSources.add(dataSource);
        disasterDsRef.current = dataSource;
      })
      .catch(() => {
        // Keep the previous pins on load failure — an empty globe would
        // misrepresent a feed that may still be live elsewhere.
      });
    return () => {
      cancelled = true;
    };
  }, [disasterEvents, viewerEpoch]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return undefined;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position);
      const entity = picked?.id instanceof Cesium.Entity ? picked.id : undefined;
      const disasterId = entity?.properties?.disasterId?.getValue(Cesium.JulianDate.now()) as string | undefined;
      setPickedDisasterId(disasterId ?? null);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    return () => handler.destroy();
  }, [viewerEpoch]);

  const pickedDisaster = pickedDisasterId
    ? (disasterEvents.find((event) => event.id === pickedDisasterId) ?? null)
    : null;

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
      {/* Disaster pin details — real merged-feed fields, same glass style. */}
      {pickedDisaster && (
        <div className="absolute left-1/2 top-16 z-10 w-64 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0D1B2A]/95 p-3 backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12.5px] font-medium text-slate-100">{pickedDisaster.title}</p>
            <button
              type="button"
              onClick={() => setPickedDisasterId(null)}
              aria-label="Close disaster details"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>
          <p className="mt-1 font-mono text-[10px] text-slate-400">
            {pickedDisaster.type} · {pickedDisaster.severity} · {pickedDisaster.source}
          </p>
        </div>
      )}
      {/* 3D Globe tilt control — on-screen affordance for camera pitch.
          The middle-click-drag gesture still works; this provides a discoverable
          alternative with live feedback and a reset-to-top-down affordance.
          Cesium pitch convention: -90° is straight-down (top-down view),
          0° is horizontal (horizon view). */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5">
        <div className="glass-strong flex flex-col gap-1 rounded-xl p-2">
          <button
            type="button"
            onClick={() => {
              if (!viewerRef.current) return;
              const camera = viewerRef.current.camera;
              const pos = camera.positionCartographic;
              camera.flyTo({
                destination: Cesium.Cartesian3.fromRadians(pos.longitude, pos.latitude, pos.height),
                orientation: {
                  heading: camera.heading,
                  pitch: Math.min(0, camera.pitch + Cesium.Math.toRadians(10)),
                  roll: 0,
                },
                duration: 0.4,
              });
            }}
            className="glass-strong flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white/10 active:bg-white/20"
            aria-label="Tilt toward horizon"
            title="Tilt toward horizon"
          >
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!viewerRef.current) return;
              const camera = viewerRef.current.camera;
              const pos = camera.positionCartographic;
              camera.flyTo({
                destination: Cesium.Cartesian3.fromRadians(pos.longitude, pos.latitude, pos.height),
                orientation: {
                  heading: camera.heading,
                  pitch: Math.max(-Cesium.Math.PI_OVER_TWO, camera.pitch - Cesium.Math.toRadians(10)),
                  roll: 0,
                },
                duration: 0.4,
              });
            }}
            className="glass-strong flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white/10 active:bg-white/20"
            aria-label="Tilt toward top-down"
            title="Tilt toward top-down"
          >
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!viewerRef.current) return;
            const pos = viewerRef.current.camera.positionCartographic;
            viewerRef.current.camera.flyTo({
              destination: Cesium.Cartesian3.fromRadians(pos.longitude, pos.latitude, pos.height),
              orientation: {
                heading: viewerRef.current.camera.heading,
                pitch: -Cesium.Math.PI_OVER_TWO,
                roll: 0,
              },
              duration: 1.5,
            });
          }}
          className="glass-strong flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/10"
          aria-label="Reset to top-down view"
          title="Reset to top-down view"
        >
          <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </button>
      </div>
    </div>
  );
}