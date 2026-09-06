import { useEffect, useMemo, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import * as turf from '@turf/turf';
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

  // Navigation route overlay: brand-blue polyline with white casing clamped
  // to terrain (Ion mesh when available) plus green start / red end points —
  // the same shared treatment as the 2D and Vector maps. With live flow
  // samples, per-segment colors from the shared flow-status bands replace
  // the blue core (dark casing for contrast) so the route communicates
  // traffic conditions. The two coplanar ground-clamped lines are ordered
  // with polyline zIndex (casing below, color above): per Cesium's
  // PolylineGraphics docs, zIndex orders ground geometry when clampToGround
  // is true, which resolves the overlap deterministically instead of
  // z-fighting. Polyline widths above 1px are best-effort
  // (platform-dependent).
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
    // Direction chevrons: V-shaped ground-clamped segments at intervals,
    // apex pointing along travel. Turf stations the points and bearings,
    // mirroring the 2D overlay; white casing + blue inner layer above the
    // route line via higher zIndex. Decorative — a failed computation never
    // blocks the route line itself.
    try {
      const geoLine = turf.lineString(navLine.path.map((point) => [point.lon, point.lat]));
      const lengthKm = turf.length(geoLine, { units: 'kilometers' });
      if (lengthKm > 0) {
        const wingKm = Math.min(0.4, Math.max(0.05, lengthKm * 0.012));
        for (const fraction of [0.2, 0.4, 0.6, 0.8]) {
          const along = turf.along(geoLine, fraction * lengthKm, { units: 'kilometers' });
          const before = turf.along(geoLine, Math.max(0, fraction * lengthKm - lengthKm * 0.01), {
            units: 'kilometers',
          });
          const after = turf.along(geoLine, Math.min(lengthKm, fraction * lengthKm + lengthKm * 0.01), {
            units: 'kilometers',
          });
          const bearing = turf.bearing(before, after);
          const [chevronLon, chevronLat] = along.geometry.coordinates;
          const apex = Cesium.Cartesian3.fromDegrees(chevronLon, chevronLat);
          const wing = (wingBearing: number) => {
            const dest = turf.destination(turf.point([chevronLon, chevronLat]), wingKm, wingBearing, {
              units: 'kilometers',
            });
            const [wingLon, wingLat] = dest.geometry.coordinates;
            return Cesium.Cartesian3.fromDegrees(wingLon, wingLat);
          };
          const chevronPositions = [wing(bearing + 150), apex, wing(bearing - 150)];
          entities.add({
            properties: { nav: true },
            polyline: {
              positions: chevronPositions,
              width: 5,
              material: Cesium.Color.WHITE,
              clampToGround: true,
              zIndex: 2,
            },
          });
          entities.add({
            properties: { nav: true },
            polyline: {
              positions: chevronPositions,
              width: 3,
              material: Cesium.Color.fromCssColorString(ROUTE_LINE_COLOR),
              clampToGround: true,
              zIndex: 3,
            },
          });
        }
      }
    } catch {
      // Chevron placement is decorative — a failed computation never blocks
      // the route line itself.
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

  // Live disaster pins: GeoJsonDataSource from the merged feed, styled per
  // entity (severity color/size + label) and clamped to the Ion terrain mesh
  // so pins sit on real elevation. Points + labels mirror the 2D pins
  // rather than inventing a separate icon language per map.
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

  // Disaster pin picking: left-click shows the event's real fields in a
  // glass card; clicking empty globe dismisses it.
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
    </div>
  );
}
