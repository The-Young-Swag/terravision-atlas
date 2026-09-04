import { useEffect, useRef } from 'react';
import { Map as MapLibre, NavigationControl, AttributionControl, Popup, setWorkerUrl } from 'maplibre-gl';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import { useMapStore } from '../../../stores/mapStore';
import { MAPLIBRE_STYLES } from '../../../core/map/maplibre/style';
import { setContoursVisible } from '../../../core/map/maplibre/contours';
import { niceGridStepDegrees, snapLonLat } from '../../../core/geodetic/grid/snap';
import { removeMeasureLayers, setMeasureVisible } from '../../../core/map/maplibre/measure';
import { setSearchMarkerVisible } from '../../../core/map/maplibre/search';
import { useSearchStore } from '../../../stores/searchStore';
import {
  TRAFFIC_INCIDENT_LAYER_ID,
  addIncidentLayers,
  removeIncidentLayers,
  setTrafficVisible,
} from '../../../core/map/maplibre/traffic';
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
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Crosshair cursor while the measure tool is armed.
  const measureActive = useMapStore((s) => s.measureActive);
  const measurePoints = useMapStore((s) => s.measurePoints);
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
      setSearchMarkerVisible(liveMap, useSearchStore.getState().marker);
    });
  }, [basemap]);

  // Search-result pin — mirrors the 2D marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    setSearchMarkerVisible(map, searchMarker);
  }, [searchMarker]);

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
