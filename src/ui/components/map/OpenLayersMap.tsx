import { useEffect, useRef, useMemo } from 'react';
import Map from 'ol/Map';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import Point from 'ol/geom/Point';
import { fromLonLat, toLonLat } from 'ol/proj';
import { useMapStore } from '../../../stores/mapStore';
import { useDisasterStore } from '../../../stores/disasterStore';
import { createMap, updateBasemap } from '../../../core/map/openlayers/createMap';
import { createHazardLayer } from '../../../core/map/openlayers/hazardLayer';
import { createRouteLayer } from '../../../core/map/openlayers/routeLayer';
import { useRouteStore } from '../../../stores/routeStore';
import { createShelterLayer } from '../../../core/map/openlayers/shelterLayer';
import { useShelterStore } from '../../../stores/shelterStore';
import { createTrafficFlowLayer, createTrafficIncidentLayer } from '../../../core/map/openlayers/trafficLayer';
import { useTrafficStore } from '../../../stores/trafficStore';
import { tomtomApiKey } from '../../../features/traffic/tomtom';
import { refreshTraffic } from '../../../features/traffic/refresh';
import { incidentPopupHtml } from '../../../features/traffic/incidentPopup';
import '../../../features/traffic/incidentPopup.css';
import Overlay from 'ol/Overlay';
import { useMapOverlayContrast } from '../../../hooks/useMapOverlayContrast';
import 'ol/ol.css';

export function OpenLayersMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const hazardLayerRef = useRef<ReturnType<typeof createHazardLayer> | null>(null);
  const routeLayerRef = useRef<ReturnType<typeof createRouteLayer> | null>(null);
  const shelterLayerRef = useRef<ReturnType<typeof createShelterLayer> | null>(null);
  const trafficFlowLayerRef = useRef<ReturnType<typeof createTrafficFlowLayer> | null>(null);
  const trafficIncidentLayerRef = useRef<ReturnType<typeof createTrafficIncidentLayer> | null>(null);
  const trafficRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incidentPopupRef = useRef<Overlay | null>(null);
  const isProgrammaticRef = useRef(false);

  const { center, zoom, basemap, showHazards, showTraffic, setCenter, setZoom } = useMapStore();
  const { events: disasterEvents } = useDisasterStore();
  const { route, avoidRing } = useRouteStore();
  const shelters = useShelterStore((s) => s.shelters);
  const trafficStatus = useTrafficStore((s) => s.status);
  const trafficIncidents = useTrafficStore((s) => s.incidents);

  // Adaptive contrast for in-map overlays (hazard markers, etc.)
  const { markerStroke } = useMapOverlayContrast();

  const hazardFeatures = useMemo(
    () =>
      disasterEvents.map((event) => ({
        id: event.id,
        lon: event.longitude,
        lat: event.latitude,
        severity: event.severity,
        type: event.type,
      })),
    [disasterEvents],
  );

  // Refresh traffic incidents for the current view — debounced so a pan
  // never fires more than one lookup per pause, on top of the bbox cache.
  const refreshTrafficForView = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const extent = map.getView().calculateExtent(map.getSize());
    const [minLon, minLat] = toLonLat([extent[0], extent[1]]);
    const [maxLon, maxLat] = toLonLat([extent[2], extent[3]]);
    if (trafficRefreshTimer.current) clearTimeout(trafficRefreshTimer.current);
    trafficRefreshTimer.current = setTimeout(() => {
      void refreshTraffic({ minLon, minLat, maxLon, maxLat });
    }, 800);
  };

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = createMap({
      target: mapRef.current,
      center,
      zoom,
      basemap,
    });

    // Sync view changes back to store only after user finishes interacting.
    // Using 'moveend' instead of 'change:center'/'change:resolution' prevents
    // the feedback loop that caused shaking during drag.
    map.on('moveend', () => {
      if (isProgrammaticRef.current) {
        // Skip store update when the move was triggered programmatically
        isProgrammaticRef.current = false;
        return;
      }

      const view = map.getView();
      const viewCenter = view.getCenter();
      const viewZoom = view.getZoom();

      if (viewCenter) {
        const [lon, lat] = toLonLat(viewCenter);
        // Only update if meaningfully different (avoid micro-jitter)
        const [storeLon, storeLat] = center;
        const lonDiff = Math.abs(lon - storeLon);
        const latDiff = Math.abs(lat - storeLat);
        if (lonDiff > 0.0001 || latDiff > 0.0001) {
          setCenter([lon, lat]);
        }
      }

      if (typeof viewZoom === 'number') {
        const zoomDiff = Math.abs(viewZoom - zoom);
        if (zoomDiff > 0.05) {
          setZoom(viewZoom);
        }
      }

      if (useMapStore.getState().showTraffic) {
        refreshTrafficForView();
      }
    });

    // Initial hazard layer — uses live disaster events with adaptive stroke
    if (showHazards && hazardFeatures.length > 0) {
      const hazardLayer = createHazardLayer(hazardFeatures, markerStroke);
      map.addLayer(hazardLayer);
      hazardLayerRef.current = hazardLayer;
    }

    // Incident popup — shows real TomTom incident fields on marker click.
    const popupElement = document.createElement('div');
    const popup = new Overlay({
      element: popupElement,
      positioning: 'bottom-center',
      offset: [0, -10],
      stopEvent: true,
    });
    map.addOverlay(popup);
    incidentPopupRef.current = popup;

    const handleMapClick = (event: MapBrowserEvent) => {
      const feature = map.forEachFeatureAtPixel(event.pixel, (found) => found, {
        layerFilter: (layer) => layer.get('layerId') === 'traffic-incidents',
      });
      const geometry = feature?.getGeometry();
      const incidentId = feature?.get('incidentId');
      if (typeof incidentId !== 'string' || !(geometry instanceof Point)) {
        popup.setPosition(undefined);
        return;
      }
      const incident = useTrafficStore.getState().incidents.find((item) => item.id === incidentId);
      if (!incident) {
        popup.setPosition(undefined);
        return;
      }
      popupElement.innerHTML = incidentPopupHtml(incident);
      popup.setPosition(geometry.getCoordinates());
    };
    map.on('click', handleMapClick);

    // Store for external sync (mirrors MapLibreMap's __maplibre handle).
    (mapRef.current as unknown as { __olmap?: Map }).__olmap = map;
    mapInstanceRef.current = map;

    // Handle resize — OpenLayers needs explicit update when container changes
    const resizeObserver = new ResizeObserver(() => map.updateSize());
    resizeObserver.observe(mapRef.current);

    return () => {
      resizeObserver.disconnect();
      map.setTarget(undefined);
      mapInstanceRef.current = null;
    };
    // Only run once on mount — basemap/center updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update basemap when store changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    updateBasemap(map, basemap);
  }, [basemap]);

  // Toggle hazards and update when events change OR when markerStroke changes (basemap switch)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing hazard layer first
    if (hazardLayerRef.current) {
      map.removeLayer(hazardLayerRef.current);
      hazardLayerRef.current = null;
    }

    if (showHazards && hazardFeatures.length > 0) {
      const layer = createHazardLayer(hazardFeatures, markerStroke);
      map.addLayer(layer);
      hazardLayerRef.current = layer;
    }
  }, [showHazards, hazardFeatures, markerStroke]);

  // Evacuation route overlay — rebuilt whenever the route or avoid area changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (route && avoidRing) {
      const layer = createRouteLayer(route, avoidRing);
      map.addLayer(layer);
      routeLayerRef.current = layer;
    }
  }, [route, avoidRing]);

  // Shelter markers — rebuilt whenever the shelter list changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (shelterLayerRef.current) {
      map.removeLayer(shelterLayerRef.current);
      shelterLayerRef.current = null;
    }

    if (shelters.length > 0) {
      const layer = createShelterLayer(shelters);
      map.addLayer(layer);
      shelterLayerRef.current = layer;
    }
  }, [shelters]);

  // Traffic flow + incident layers — visible only while the traffic state
  // is ok, so a dead quota never leaves a blank or broken overlay behind.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (trafficFlowLayerRef.current) {
      map.removeLayer(trafficFlowLayerRef.current);
      trafficFlowLayerRef.current = null;
    }
    if (trafficIncidentLayerRef.current) {
      map.removeLayer(trafficIncidentLayerRef.current);
      trafficIncidentLayerRef.current = null;
    }
    incidentPopupRef.current?.setPosition(undefined);

    if (showTraffic && trafficStatus === 'ok') {
      const key = tomtomApiKey();
      if (key) {
        const flowLayer = createTrafficFlowLayer(key);
        map.addLayer(flowLayer);
        trafficFlowLayerRef.current = flowLayer;
      }
      if (trafficIncidents.length > 0) {
        const incidentLayer = createTrafficIncidentLayer(trafficIncidents);
        map.addLayer(incidentLayer);
        trafficIncidentLayerRef.current = incidentLayer;
      }
    }
  }, [showTraffic, trafficStatus, trafficIncidents]);

  useEffect(() => {
    if (!showTraffic) return;
    refreshTrafficForView();
  }, [showTraffic]);

  // Keep view in sync if store center/zoom changes externally (e.g., search fly-to)
  // Compare with current view to avoid animating when the change originated from the map itself
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const view = map.getView();
    const currentCenter = view.getCenter();
    if (!currentCenter) return;

    const [currentLon, currentLat] = toLonLat(currentCenter);
    const [targetLon, targetLat] = center;
    const lonDiff = Math.abs(currentLon - targetLon);
    const latDiff = Math.abs(currentLat - targetLat);

    // Only animate if the store center is meaningfully different from the view center
    if (lonDiff > 0.0005 || latDiff > 0.0005) {
      isProgrammaticRef.current = true;
      view.animate({ center: fromLonLat(center), duration: 500 });
      // Reset flag after animation completes
      setTimeout(() => {
        isProgrammaticRef.current = false;
      }, 600);
    }
  }, [center]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const view = map.getView();
    const currentZoom = view.getZoom();
    if (typeof currentZoom !== 'number') return;

    const zoomDiff = Math.abs(currentZoom - zoom);
    if (zoomDiff > 0.05) {
      isProgrammaticRef.current = true;
      view.animate({ zoom, duration: 400 });
      setTimeout(() => {
        isProgrammaticRef.current = false;
      }, 500);
    }
  }, [zoom]);

  return (
    <div
      ref={mapRef}
      className="absolute inset-0 h-full w-full bg-[#0A0E19]"
      aria-label="2D map"
      role="region"
    />
  );
}
