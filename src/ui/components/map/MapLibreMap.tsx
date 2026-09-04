import { useEffect, useRef } from 'react';
import { Map as MapLibre, Marker, NavigationControl, AttributionControl, Popup, setWorkerUrl } from 'maplibre-gl';
import { useRouteStore } from '../../../stores/routeStore';
import { reverseNominatim } from '../../../features/search/geocode';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import { useMapStore } from '../../../stores/mapStore';
import { MAPLIBRE_STYLES } from '../../../core/map/maplibre/style';
import { setContoursVisible } from '../../../core/map/maplibre/contours';
import { niceGridStepDegrees, snapLonLat } from '../../../core/geodetic/grid/snap';
import { removeMeasureLayers, setMeasureVisible } from '../../../core/map/maplibre/measure';
import { setRouteVisible } from '../../../core/map/maplibre/route';
import { setSearchMarkerVisible } from '../../../core/map/maplibre/search';
import { useSearchStore } from '../../../stores/searchStore';
import {
  TRAFFIC_INCIDENT_LAYER_ID,
  addIncidentLayers,
  removeIncidentLayers,
  setTrafficVisible,
} from '../../../core/map/maplibre/traffic';
import { setAvoidPreview, setAvoidVisible } from '../../../core/map/maplibre/avoid';
import { MIN_AVOID_RADIUS_KM, previewCircle } from '../../../features/routing/avoidZone';
import { useTrafficStore } from '../../../stores/trafficStore';
import { tomtomApiKey } from '../../../features/traffic/tomtom';
import { refreshTraffic } from '../../../features/traffic/refresh';
import { incidentPopupHtml } from '../../../features/traffic/incidentPopup';
import '../../../features/traffic/incidentPopup.css';
import { useMapOverlayContrast } from '../../../hooks/useMapOverlayContrast';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapLibre loads its vector-tile parser in a Web Worker whose URL defaults
// to a sibling of the bundled main module — a file Vite neither pre-bundles
// nor emits, so it 404s and every vector source stalls in "loading" forever
// (raster tiles are unaffected, which is why this went unnoticed while the
// style was raster-only). The worker files are vendored under public/maplibre
// (kept in sync via `npm run sync:maplibre-worker`, wired into predev and
// prebuild) and served as static siblings, which works in both dev and build.
setWorkerUrl(`${import.meta.env.BASE_URL}maplibre/maplibre-gl-worker.mjs`);

export function MapLibreMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);

  const { center, zoom, basemap, showTerrainContours, showTraffic } = useMapStore();
  const trafficStatus = useTrafficStore((s) => s.status);
  const trafficIncidents = useTrafficStore((s) => s.incidents);
  const incidentPopupRef = useRef<Popup | null>(null);

  // Adaptive contrast for in-map UI (controls, attribution)
  const { theme, textPrimary, attributionText } = useMapOverlayContrast();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = new MapLibre({
      container,
      style: MAPLIBRE_STYLES[basemap],
      center,
      zoom,
      attributionControl: false,
    });

    // Custom NavigationControl with adaptive colors
    const navControl = new NavigationControl({ showCompass: false });
    map.addControl(navControl, 'bottom-right');

    // Custom AttributionControl with adaptive colors
    const attributionControl = new AttributionControl({ compact: true });
    map.addControl(attributionControl, 'bottom-right');

    // Apply adaptive styles to maplibre controls after they're rendered
    const applyControlStyles = () => {
      if (!container) return;

      // NavigationControl buttons (zoom in/out)
      const navButtons = container.querySelectorAll('.maplibre-ctrl-zoom-in, .maplibre-ctrl-zoom-out');
      navButtons.forEach((btn) => {
        const button = btn as HTMLElement;
        button.style.backgroundColor = theme === 'light' ? '#ffffff' : '#1e293b';
        button.style.color = theme === 'light' ? '#1e293b' : '#f8fafc';
        button.style.border = theme === 'light' ? '1px solid #cbd5e1' : '1px solid #475569';
      });

      // Compass (if shown)
      const compass = container.querySelector('.maplibre-ctrl-compass');
      if (compass) {
        (compass as HTMLElement).style.filter = theme === 'light' ? 'invert(0)' : 'invert(1)';
      }

      // AttributionControl
      const attribution = container.querySelector('.maplibre-ctrl-attrib');
      if (attribution) {
        const attr = attribution as HTMLElement;
        attr.style.color = attributionText;
        attr.style.backgroundColor = theme === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(30,41,59,0.9)';
      }

      // Attribution toggle button
      const attribToggle = container.querySelector('.maplibre-ctrl-attrib-toggle');
      if (attribToggle) {
        const toggle = attribToggle as HTMLElement;
        toggle.style.color = textPrimary;
        toggle.style.backgroundColor = theme === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(30,41,59,0.9)';
      }
    };

    // Apply initially and on style/basemap changes
    setTimeout(applyControlStyles, 100);

    // Sync view changes back to store on moveend
    let isProgrammatic = false;

    map.on('moveend', () => {
      if (isProgrammatic) {
        isProgrammatic = false;
        return;
      }
      const c = map.getCenter();
      const z = map.getZoom();
      const store = useMapStore.getState();
      if (store.snapToGrid) {
        const resolution = (156543.03392804097 * Math.cos((c.lat * Math.PI) / 180)) / 2 ** z;
        const snapped = snapLonLat(c.lng, c.lat, niceGridStepDegrees(resolution, c.lat));
        store.setCenter([snapped.lon, snapped.lat]);
      } else {
        store.setCenter([c.lng, c.lat]);
      }
      store.setZoom(z);
    });

    // Geodesic measure tool: picks points while armed (third click restarts).
    map.on('click', (event) => {
      const state = useMapStore.getState();
      if (!state.measureActive) return;
      state.pushMeasurePoint([event.lngLat.lng, event.lngLat.lat]);
    });

    // Evacuation pin placement while a Start/Destination pick is armed.
    map.on('click', (event) => {
      const routeState = useRouteStore.getState();
      if (!routeState.pickMode) return;
      const { lng, lat } = event.lngLat;
      void reverseNominatim(lat, lng)
        .then((place) => ({ lon: lng, lat, label: place?.displayName.split(',')[0] ?? 'Pinned location' }))
        .then((pin) => {
          const live = useRouteStore.getState();
          if (live.pickMode === 'start') {
            live.setStart(pin);
            live.setPickMode(live.destination ? null : 'destination');
          } else if (live.pickMode === 'destination') {
            live.setDestination(pin);
            live.setPickMode(null);
          }
        })
        .catch(() => undefined);
    });

    // Avoid-zone draw tool: press-drag-release sketches a circle while
    // armed, with a live radius tooltip following the cursor (positioned
    // via map.project). Release finalizes the same circle Valhalla gets.
    const drawTooltip = document.createElement('div');
    drawTooltip.style.cssText =
      'position:absolute;display:none;pointer-events:none;background:rgba(13,27,42,.92);' +
      'border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:4px 8px;' +
      'font:11px monospace;color:#f8fafc;white-space:nowrap;z-index:30;';
    map.getCanvasContainer().appendChild(drawTooltip);

    const onDrawDown = (event: { lngLat: { lng: number; lat: number }; originalEvent: MouseEvent }) => {
      if (!useRouteStore.getState().drawAvoidArmed || event.originalEvent.button !== 0) {
        // Not drawing: clear any leftover preview (e.g. after Escape).
        drawCenterRef.current = null;
        drawTooltip.style.display = 'none';
        if (mapRef.current) setAvoidPreview(mapRef.current, null);
        return;
      }
      event.originalEvent.preventDefault();
      drawCenterRef.current = { lon: event.lngLat.lng, lat: event.lngLat.lat };
      map.dragPan.disable();
    };
    const onDrawMove = (event: { lngLat: { lng: number; lat: number } }) => {
      const center = drawCenterRef.current;
      const liveMap = mapRef.current;
      if (!center || !liveMap || !useRouteStore.getState().drawAvoidArmed) return;
      const { circle, atCap } = previewCircle(center.lon, center.lat, event.lngLat.lng, event.lngLat.lat);
      setAvoidPreview(liveMap, circle);
      const point = liveMap.project(event.lngLat);
      drawTooltip.textContent = atCap
        ? `${circle.radiusKm.toFixed(1)} km (max) — release to set`
        : `${circle.radiusKm.toFixed(1)} km — release to set`;
      drawTooltip.style.display = 'block';
      drawTooltip.style.left = `${point.x + 14}px`;
      drawTooltip.style.top = `${point.y - 10}px`;
    };
    const onDrawUp = (event: { lngLat: { lng: number; lat: number } }) => {
      const center = drawCenterRef.current;
      drawCenterRef.current = null;
      map.dragPan.enable();
      if (!center || !useRouteStore.getState().drawAvoidArmed) {
        if (mapRef.current) setAvoidPreview(mapRef.current, null);
        drawTooltip.style.display = 'none';
        return;
      }
      const { circle } = previewCircle(center.lon, center.lat, event.lngLat.lng, event.lngLat.lat);
      const store = useRouteStore.getState();
      if (mapRef.current) setAvoidPreview(mapRef.current, null);
      drawTooltip.style.display = 'none';
      if (circle.radiusKm >= MIN_AVOID_RADIUS_KM) {
        store.setAvoidCircle(circle);
      }
      store.setDrawAvoidArmed(false);
    };
    map.on('mousedown', onDrawDown);
    map.on('mousemove', onDrawMove);
    map.on('mouseup', onDrawUp);

    // Escape cancels an in-progress draw immediately (clears the preview,
    // disarms the tool, restores panning).
    const onDrawKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !useRouteStore.getState().drawAvoidArmed) return;
      drawCenterRef.current = null;
      drawTooltip.style.display = 'none';
      if (mapRef.current) setAvoidPreview(mapRef.current, null);
      map.dragPan.enable();
      useRouteStore.getState().setDrawAvoidArmed(false);
    };
    window.addEventListener('keydown', onDrawKey);

    // Re-apply styles when map style changes (basemap switch)
    map.on('style.load', applyControlStyles);
    map.on('render', () => {
      // Re-apply on first few renders to catch dynamic control creation
    });

    // Store for external sync
    (container as unknown as { __maplibre?: MapLibre }).__maplibre = map;
    (container as unknown as { __isProgrammatic?: () => void }).__isProgrammatic = () => {
      isProgrammatic = true;
    };

    mapRef.current = map;

    return () => {
      map.off('mousedown', onDrawDown);
      map.off('mousemove', onDrawMove);
      map.off('mouseup', onDrawUp);
      window.removeEventListener('keydown', onDrawKey);
      drawTooltip.remove();
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Crosshair cursor while the measure tool is armed.
  const measureActive = useMapStore((s) => s.measureActive);
  const measurePoints = useMapStore((s) => s.measurePoints);
  const evacStart = useRouteStore((s) => s.start);
  const evacDestination = useRouteStore((s) => s.destination);
  const evacRoute = useRouteStore((s) => s.route);
  const avoidCircle = useRouteStore((s) => s.avoidCircle);
  const drawAvoidArmed = useRouteStore((s) => s.drawAvoidArmed);
  const drawCenterRef = useRef<{ lon: number; lat: number } | null>(null);
  const startMarkerRef = useRef<Marker | null>(null);
  const destinationMarkerRef = useRef<Marker | null>(null);
  const searchMarker = useSearchStore((s) => s.marker);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = measureActive ? 'crosshair' : '';
  }, [measureActive]);

  // Measure overlay — line and dots for the picked points.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (measureActive && measurePoints.length > 0) {
      setMeasureVisible(map, measurePoints);
    } else {
      removeMeasureLayers(map);
    }
  }, [measureActive, measurePoints]);

  // Terrain contour overlay — generated client-side from AWS Terrarium tiles.
  // The map style is never replaced after creation, so dynamically added
  // sources survive for the life of the map; removal on toggle-off keeps
  // tile fetching to zero when the overlay is hidden.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      setContoursVisible(map, showTerrainContours);
    } else if (showTerrainContours) {
      map.once('load', () => {
        if (mapRef.current) setContoursVisible(map, true);
      });
    }
  }, [showTerrainContours]);

  // Traffic incidents for an approximate view box — debounced; the shared
  // status this sets is what gates the flow layers in both map views.
  useEffect(() => {
    if (!showTraffic) return undefined;
    const halfDegrees = 180 / 2 ** zoom;
    const timer = setTimeout(() => {
      void refreshTraffic({
        minLon: center[0] - halfDegrees,
        minLat: center[1] - halfDegrees,
        maxLon: center[0] + halfDegrees,
        maxLat: center[1] + halfDegrees,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [showTraffic, center, zoom]);

  // Traffic flow overlay — same TomTom tiles as the 2D view, shown only
  // while the shared status is ok so quota failures hide it everywhere.
  // Incident markers ride along; clicking one pops up its TomTom details.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const visible = showTraffic && trafficStatus === 'ok';
    setTrafficVisible(map, visible, tomtomApiKey());
    incidentPopupRef.current?.remove();
    incidentPopupRef.current = null;
    if (!visible) {
      removeIncidentLayers(map);
      return undefined;
    }
    addIncidentLayers(map, trafficIncidents);
    const handleIncidentClick = (event: MapLayerMouseEvent) => {
      const incidentId = event.features?.[0]?.properties?.incidentId;
      if (typeof incidentId !== 'string') return;
      const incident = useTrafficStore.getState().incidents.find((item) => item.id === incidentId);
      if (!incident) return;
      incidentPopupRef.current?.remove();
      incidentPopupRef.current = new Popup({ closeButton: true, maxWidth: '260px' })
        .setLngLat([incident.lon, incident.lat])
        .setHTML(incidentPopupHtml(incident))
        .addTo(map);
    };
    map.on('click', TRAFFIC_INCIDENT_LAYER_ID, handleIncidentClick);
    return () => {
      map.off('click', TRAFFIC_INCIDENT_LAYER_ID, handleIncidentClick);
      incidentPopupRef.current?.remove();
      incidentPopupRef.current = null;
    };
  }, [showTraffic, trafficStatus, trafficIncidents]);

  // Base Map reactivity — the four Vector styles mirror the 2D basemaps.
  // setStyle drops runtime sources, so contour/traffic overlays are
  // re-applied from live store state once the new style loads.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const currentTiles = (map.getStyle()?.sources?.basemap as { tiles?: string[] } | undefined)?.tiles;
    const targetTiles = (MAPLIBRE_STYLES[basemap].sources.basemap as { tiles?: string[] }).tiles;
    if (JSON.stringify(currentTiles) === JSON.stringify(targetTiles)) return;
    map.setStyle(MAPLIBRE_STYLES[basemap]);
    map.once('style.load', () => {
      const liveMap = mapRef.current;
      if (!liveMap) return;
      const mapState = useMapStore.getState();
      const trafficState = useTrafficStore.getState();
      setContoursVisible(liveMap, mapState.showTerrainContours);
      setTrafficVisible(liveMap, mapState.showTraffic && trafficState.status === 'ok', tomtomApiKey());
      setAvoidVisible(liveMap, useRouteStore.getState().avoidCircle);
      setRouteVisible(liveMap, useRouteStore.getState().route);
      setSearchMarkerVisible(liveMap, useSearchStore.getState().marker);
    });
  }, [basemap]);

  // Search-result pin — mirrors the 2D marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    setSearchMarkerVisible(map, searchMarker);
  }, [searchMarker]);

  // Evacuation pins as native draggable markers (green start, red
  // destination). Drag end re-geocodes so labels track the pin.
  // Cleanup removes the markers: without it, refs keep pointing at markers
  // of a destroyed map across remounts, and the new map would never get any.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    const syncMarker = (
      ref: { current: Marker | null },
      pin: { lon: number; lat: number; label: string } | null,
      role: 'start' | 'destination',
      color: string,
    ) => {
      if (!pin) {
        ref.current?.remove();
        ref.current = null;
        return;
      }
      if (!ref.current) {
        const marker = new Marker({ color, draggable: true });
        marker.setLngLat([pin.lon, pin.lat]);
        marker.addTo(map);
        marker.on('dragend', () => {
          const { lng, lat } = marker.getLngLat();
          void reverseNominatim(lat, lng)
            .then((place) => ({ lon: lng, lat, label: place?.displayName.split(',')[0] ?? 'Pinned location' }))
            .then((moved) => {
              const live = useRouteStore.getState();
              if (role === 'start') live.setStart(moved);
              else live.setDestination(moved);
            })
            .catch(() => undefined);
        });
        ref.current = marker;
      } else {
        ref.current.setLngLat([pin.lon, pin.lat]);
      }
    };

    syncMarker(startMarkerRef, evacStart, 'start', '#22c55e');
    syncMarker(destinationMarkerRef, evacDestination, 'destination', '#ef4444');

    return () => {
      startMarkerRef.current?.remove();
      destinationMarkerRef.current?.remove();
      startMarkerRef.current = null;
      destinationMarkerRef.current = null;
    };
  }, [evacStart, evacDestination]);

  // Finalized avoid zone — hatched overlay, visible with or without a route.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    setAvoidVisible(map, avoidCircle);
  }, [avoidCircle]);

  // Avoid-draw arming: crosshair cursor and pan-drag state. Stale previews
  // are discarded lazily by the next pointer-down (see onDrawDown).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    map.getCanvas().style.cursor = drawAvoidArmed ? 'crosshair' : '';
    if (!drawAvoidArmed) {
      map.dragPan.enable();
    }
    return undefined;
  }, [drawAvoidArmed]);

  // Evacuation route line — added after the avoid hatch so it draws above.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    setRouteVisible(map, evacRoute);
  }, [evacRoute]);

  // Sync center/zoom when store changes externally — only fly when meaningfully different
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentCenter = map.getCenter();
    const lonDiff = Math.abs(currentCenter.lng - center[0]);
    const latDiff = Math.abs(currentCenter.lat - center[1]);

    if (lonDiff > 0.0005 || latDiff > 0.0005) {
      const container = containerRef.current as unknown as { __isProgrammatic?: () => void };
      container?.__isProgrammatic?.();
      map.flyTo({ center, duration: 500 });
      setTimeout(() => {
        // reset isProgrammatic after flyTo
      }, 600);
    }
  }, [center]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const currentZoom = map.getZoom();
    if (Math.abs(currentZoom - zoom) > 0.05) {
      const container = containerRef.current as unknown as { __isProgrammatic?: () => void };
      container?.__isProgrammatic?.();
      map.flyTo({ zoom, duration: 400 });
    }
  }, [zoom]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full bg-[#0A0E19]"
      aria-label="Vector map"
      role="region"
    />
  );
}
