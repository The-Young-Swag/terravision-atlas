import { useEffect, useRef, useMemo } from 'react';
import Map from 'ol/Map';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { fromLonLat, toLonLat } from 'ol/proj';
import { useMapStore } from '../../../stores/mapStore';
import { useDisasterStore } from '../../../stores/disasterStore';
import { createMap, updateBasemap } from '../../../core/map/openlayers/createMap';
import { createHazardLayer } from '../../../core/map/openlayers/hazardLayer';
import { createRouteLayer } from '../../../core/map/openlayers/routeLayer';
import { routeStatusSegments } from '../../../features/traffic/flowStatus';
import { jogLoopAsEvacRoute } from '../../../features/routing/joggingLoop';
import { createAvoidLayer } from '../../../core/map/openlayers/avoidLayer';
import { circleToRing, previewCircle, MIN_AVOID_RADIUS_KM } from '../../../features/routing/avoidZone';
import DragPan from 'ol/interaction/DragPan';
import { createEvacPinLayer } from '../../../core/map/openlayers/pinLayer';
import Translate from 'ol/interaction/Translate';
import { useRouteStore } from '../../../stores/routeStore';
import { createShelterLayer } from '../../../core/map/openlayers/shelterLayer';
import { useShelterStore } from '../../../stores/shelterStore';
import { createSearchMarkerLayer } from '../../../core/map/openlayers/searchLayer';
import { useSearchStore } from '../../../stores/searchStore';
import { reverseNominatim } from '../../../features/search/geocode';
import { niceGridStepDegrees, snapLonLat } from '../../../core/geodetic/grid/snap';
import { createMeasureLayer } from '../../../core/map/openlayers/measureLayer';
import { geodesicKilometers, formatDistanceKilometers } from '../../../core/geodetic/measurements/distance';
import { createTrafficFlowLayer, createTrafficIncidentLayer } from '../../../core/map/openlayers/trafficLayer';
import { TRAFFIC_FLOW_DIM_OPACITY, TRAFFIC_FLOW_FULL_OPACITY } from '../../../core/map/routeStyle';
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
  const measureLayerRef = useRef<ReturnType<typeof createMeasureLayer> | null>(null);
  const isProgrammaticRef = useRef(false);

  const { center, zoom, basemap, satelliteSource, showHazards, showTraffic, setCenter, setZoom } = useMapStore();
  const measureActive = useMapStore((s) => s.measureActive);
  const measurePoints = useMapStore((s) => s.measurePoints);
  const searchMarker = useSearchStore((s) => s.marker);
  const searchMarkerLayerRef = useRef<ReturnType<typeof createSearchMarkerLayer> | null>(null);
  const reversePopupRef = useRef<Overlay | null>(null);
  const { events: disasterEvents } = useDisasterStore();
  const { route, avoidCircle } = useRouteStore();
  const jogLoop = useRouteStore((s) => s.jogLoop);
  // The jogging loop shares the route line treatment (neutral verdict).
  const routeLine = route ?? (jogLoop ? jogLoopAsEvacRoute(jogLoop) : null);
  // Live flow samples recolor the route by traffic status (no extra
  // requests — the same samples behind the traffic-aware ETA).
  const routeTraffic = useRouteStore((s) => s.trafficAdjustment);
  const routeTrafficSegments = useMemo(
    () => (routeLine && routeTraffic ? routeStatusSegments(routeLine.path.length, routeTraffic.samples) : []),
    [routeLine, routeTraffic],
  );
  const drawAvoidArmed = useRouteStore((s) => s.drawAvoidArmed);
  const avoidLayerRef = useRef<ReturnType<typeof createAvoidLayer> | null>(null);
  const drawPreviewLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const drawCenterRef = useRef<[number, number] | null>(null);
  const evacStart = useRouteStore((s) => s.start);
  const evacDestination = useRouteStore((s) => s.destination);
  const pinLayerRef = useRef<ReturnType<typeof createEvacPinLayer> | null>(null);
  const pinTranslateRef = useRef<Translate | null>(null);
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
      satelliteSource,
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
        const [rawLon, rawLat] = toLonLat(viewCenter);
        // Snap-to-grid survey tool: round to a resolution-adaptive graticule
        // step so reported coordinates land exactly on grid lines.
        const resolution = view.getResolution();
        const snapped =
          useMapStore.getState().snapToGrid && resolution !== undefined
            ? snapLonLat(rawLon, rawLat, niceGridStepDegrees(resolution, rawLat))
            : { lon: rawLon, lat: rawLat };
        // Only update if meaningfully different (avoid micro-jitter)
        const [storeLon, storeLat] = center;
        const lonDiff = Math.abs(snapped.lon - storeLon);
        const latDiff = Math.abs(snapped.lat - storeLat);
        if (lonDiff > 0.0001 || latDiff > 0.0001) {
          setCenter([snapped.lon, snapped.lat]);
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

    // Reverse-geocode popup on right-click. Contextmenu is a separate DOM
    // event from click, so incident popups and measure clicks are unaffected.
    // (Mobile long-press is intentionally not wired: it conflicts with
    // touch-pan gestures on this map.)
    const reversePopupElement = document.createElement('div');
    const reversePopup = new Overlay({
      element: reversePopupElement,
      positioning: 'bottom-center',
      offset: [0, -10],
      stopEvent: true,
    });
    map.addOverlay(reversePopup);
    reversePopupRef.current = reversePopup;

    const handleContextMenu = async (event: MouseEvent) => {
      event.preventDefault();
      const pixel = map.getEventPixel(event);
      const coordinate = map.getCoordinateFromPixel(pixel);
      if (!coordinate) return;
      const [lon, lat] = toLonLat(coordinate);
      try {
        const place = await reverseNominatim(lat, lon);
        if (!place) {
          reversePopupElement.innerHTML =
            '<div class="incident-popup"><p class="incident-title">No address found here</p></div>';
        } else {
          const safe = place.displayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          reversePopupElement.innerHTML = `<div class="incident-popup"><p class="incident-title">Address</p><p class="incident-desc">${safe}</p></div>`;
        }
        reversePopup.setPosition(coordinate);
      } catch {
        reversePopup.setPosition(undefined);
      }
    };
    map.getViewport().addEventListener('contextmenu', handleContextMenu);

    // Geodesic measure tool: picks points while armed (third click restarts).
    map.on('click', (event: MapBrowserEvent) => {
      const state = useMapStore.getState();
      if (!state.measureActive) return;
      const [lon, lat] = toLonLat(event.coordinate);
      state.pushMeasurePoint([lon, lat]);
    });

    // Evacuation pin placement: only while a Start/Destination pick is
    // armed. Clicks on traffic incident markers are left to the popup.
    map.on('click', (event: MapBrowserEvent) => {
      const routeState = useRouteStore.getState();
      if (!routeState.pickMode) return;
      const blocked = map.forEachFeatureAtPixel(event.pixel, () => true, {
        layerFilter: (layer) => layer.get('layerId') === 'traffic-incidents',
      });
      if (blocked) return;
      const [lon, lat] = toLonLat(event.coordinate);
      void (async () => {
        const place = await reverseNominatim(lat, lon).catch(() => null);
        const live = useRouteStore.getState();
        const pin = { lon, lat, label: place?.displayName.split(',')[0] ?? 'Pinned location' };
        if (live.pickMode === 'start') {
          live.setStart(pin);
          live.setPickMode(live.destination ? null : 'destination');
        } else if (live.pickMode === 'destination') {
          live.setDestination(pin);
          live.setPickMode(null);
        }
      })();
    });

    // Avoid-zone draw tool: press-drag-release sketches a circle while
    // armed. The live radius comes from turf; release finalizes the same
    // circle object the Valhalla request will use.
    const drawTooltip = document.createElement('div');
    drawTooltip.style.cssText =
      'position:absolute;display:none;pointer-events:none;background:rgba(13,27,42,.92);' +
      'border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:4px 8px;' +
      'font:11px monospace;color:#f8fafc;white-space:nowrap;z-index:30;';
    map.getTargetElement().appendChild(drawTooltip);

    const hideDrawPreview = () => {
      if (drawPreviewLayerRef.current) {
        map.removeLayer(drawPreviewLayerRef.current);
        drawPreviewLayerRef.current = null;
      }
      drawCenterRef.current = null;
      drawTooltip.style.display = 'none';
    };

    const onDrawDown = (event: MouseEvent) => {
      if (!useRouteStore.getState().drawAvoidArmed || event.button !== 0) {
        // Not drawing: clear any leftover preview (e.g. after Escape).
        drawCenterRef.current = null;
        drawTooltip.style.display = 'none';
        if (drawPreviewLayerRef.current) {
          map.removeLayer(drawPreviewLayerRef.current);
          drawPreviewLayerRef.current = null;
        }
        return;
      }
      const pixel = map.getEventPixel(event);
      const [lon, lat] = toLonLat(map.getCoordinateFromPixel(pixel));
      drawCenterRef.current = [lon, lat];
    };
    const onDrawMove = (event: MouseEvent) => {
      const center = drawCenterRef.current;
      if (!center || !useRouteStore.getState().drawAvoidArmed) return;
      const pixel = map.getEventPixel(event);
      const [lon, lat] = toLonLat(map.getCoordinateFromPixel(pixel));
      const { circle, atCap } = previewCircle(center[0], center[1], lon, lat);
      if (drawPreviewLayerRef.current) {
        map.removeLayer(drawPreviewLayerRef.current);
      }
      const preview = createAvoidLayer(circleToRing(circle));
      map.addLayer(preview);
      drawPreviewLayerRef.current = preview;
      drawTooltip.textContent = atCap
        ? `${circle.radiusKm.toFixed(1)} km (max) — release to set`
        : `${circle.radiusKm.toFixed(1)} km — release to set`;
      drawTooltip.style.display = 'block';
      drawTooltip.style.left = `${pixel[0] + 14}px`;
      drawTooltip.style.top = `${pixel[1] - 10}px`;
    };
    const onDrawUp = (event: MouseEvent) => {
      const center = drawCenterRef.current;
      drawCenterRef.current = null;
      if (!center || !useRouteStore.getState().drawAvoidArmed) {
        hideDrawPreview();
        return;
      }
      const pixel = map.getEventPixel(event);
      const [lon, lat] = toLonLat(map.getCoordinateFromPixel(pixel));
      const { circle } = previewCircle(center[0], center[1], lon, lat);
      const store = useRouteStore.getState();
      hideDrawPreview();
      if (circle.radiusKm >= MIN_AVOID_RADIUS_KM) {
        store.setAvoidCircle(circle);
      }
      store.setDrawAvoidArmed(false);
    };
    const viewport = map.getViewport();
    viewport.addEventListener('mousedown', onDrawDown);
    viewport.addEventListener('mousemove', onDrawMove);
    viewport.addEventListener('mouseup', onDrawUp);

    // Escape cancels an in-progress draw immediately.
    const onDrawKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !useRouteStore.getState().drawAvoidArmed) return;
      drawCenterRef.current = null;
      drawTooltip.style.display = 'none';
      if (drawPreviewLayerRef.current) {
        map.removeLayer(drawPreviewLayerRef.current);
        drawPreviewLayerRef.current = null;
      }
      useRouteStore.getState().setDrawAvoidArmed(false);
    };
    window.addEventListener('keydown', onDrawKey);
    (mapRef.current as unknown as { __olmap?: Map }).__olmap = map;
    mapInstanceRef.current = map;

    // Handle resize — OpenLayers needs explicit update when container changes
    const resizeObserver = new ResizeObserver(() => map.updateSize());
    resizeObserver.observe(mapRef.current);

    return () => {
      resizeObserver.disconnect();
      map.getViewport()?.removeEventListener('contextmenu', handleContextMenu);
      viewport.removeEventListener('mousedown', onDrawDown);
      viewport.removeEventListener('mousemove', onDrawMove);
      viewport.removeEventListener('mouseup', onDrawUp);
      window.removeEventListener('keydown', onDrawKey);
      drawTooltip.remove();
      map.setTarget(undefined);
      mapInstanceRef.current = null;
    };
    // Only run once on mount — basemap/center updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update basemap when store changes
  // (basemap slot or satellite source within the slot)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    updateBasemap(map, basemap, satelliteSource);
  }, [basemap, satelliteSource]);

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

  // Evacuation route overlay — rebuilt whenever the route or avoid area changes.
  // The route renders above the traffic flow layer (explicit z-index, not
  // add-order) and dims flow underneath so the route reads as dominant
  // while traffic stays visible for context.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (routeLine) {
      const layer = createRouteLayer(routeLine, routeTrafficSegments);
      layer.setZIndex(10);
      map.addLayer(layer);
      routeLayerRef.current = layer;
    }

    for (const candidate of map.getLayers().getArray()) {
      if (candidate.get('layerId') === 'traffic-flow') {
        candidate.setOpacity(routeLine ? TRAFFIC_FLOW_DIM_OPACITY : TRAFFIC_FLOW_FULL_OPACITY);
      }
    }
  }, [routeLine, routeTrafficSegments]);

  // Standalone avoid-zone overlay — visible with or without a route.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (avoidLayerRef.current) {
      map.removeLayer(avoidLayerRef.current);
      avoidLayerRef.current = null;
    }

    if (avoidCircle) {
      const layer = createAvoidLayer(circleToRing(avoidCircle));
      layer.setZIndex(9);
      map.addLayer(layer);
      avoidLayerRef.current = layer;
    }
  }, [avoidCircle]);

  // Measure overlay — line, markers and distance label for picked points
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (measureLayerRef.current) {
      map.removeLayer(measureLayerRef.current);
      measureLayerRef.current = null;
    }

    if (measureActive && measurePoints.length > 0) {
      const layer = createMeasureLayer(
        measurePoints,
        formatDistanceKilometers(geodesicKilometers(measurePoints)),
      );
      map.addLayer(layer);
      measureLayerRef.current = layer;
    }
  }, [measureActive, measurePoints]);

  // Crosshair cursor while the measure tool is armed.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.getViewport().style.cursor = measureActive ? 'crosshair' : '';
  }, [measureActive]);

  // Search-result pin — replaced on every search, cleared with the query.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (searchMarkerLayerRef.current) {
      map.removeLayer(searchMarkerLayerRef.current);
      searchMarkerLayerRef.current = null;
    }

    if (searchMarker) {
      const layer = createSearchMarkerLayer(searchMarker);
      map.addLayer(layer);
      searchMarkerLayerRef.current = layer;
    }
  }, [searchMarker]);

  // Evacuation pins — rebuilt on pin changes; draggable via Translate,
  // which re-geocodes on drop so labels track the new position.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (pinTranslateRef.current) {
      map.removeInteraction(pinTranslateRef.current);
      pinTranslateRef.current = null;
    }
    if (pinLayerRef.current) {
      map.removeLayer(pinLayerRef.current);
      pinLayerRef.current = null;
    }

    if (!evacStart && !evacDestination) return;
    const layer = createEvacPinLayer(evacStart, evacDestination);
    // Waypoint markers stay above the route line; incident markers above all.
    layer.setZIndex(11);
    map.addLayer(layer);
    pinLayerRef.current = layer;

    const translate = new Translate({ layers: [layer] });
    translate.on('translateend', (event) => {
      const feature = event.features.item(0);
      const role = feature?.get('pinRole');
      const geometry = feature?.getGeometry();
      if ((role !== 'start' && role !== 'destination') || !(geometry instanceof Point)) return;
      const [lon, lat] = toLonLat(geometry.getCoordinates());
      void reverseNominatim(lat, lon)
        .then((place) => ({ lon, lat, label: place?.displayName.split(',')[0] ?? 'Pinned location' }))
        .then((pin) => {
          const live = useRouteStore.getState();
          if (role === 'start') live.setStart(pin);
          else live.setDestination(pin);
        })
        .catch(() => undefined);
    });
    map.addInteraction(translate);
    pinTranslateRef.current = translate;
  }, [evacStart, evacDestination]);

  // Avoid-draw arming: crosshair cursor and pan-drag state. Stale previews
  // are discarded lazily by the next pointer-down (see onDrawDown).
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return undefined;
    const viewport = map.getViewport();
    viewport.style.cursor = drawAvoidArmed ? 'crosshair' : '';
    const pan = map
      .getInteractions()
      .getArray()
      .find((interaction): interaction is DragPan => interaction instanceof DragPan);
    if (pan) pan.setActive(!drawAvoidArmed);
    return () => {
      if (pan) pan.setActive(true);
    };
  }, [drawAvoidArmed]);

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
        // A displayed route dims flow (see the route effect); a flow layer
        // created while a route is already up must start dimmed too.
        if (useRouteStore.getState().route ?? useRouteStore.getState().jogLoop) {
          flowLayer.setOpacity(TRAFFIC_FLOW_DIM_OPACITY);
        }
        map.addLayer(flowLayer);
        trafficFlowLayerRef.current = flowLayer;
      }
      if (trafficIncidents.length > 0) {
        const incidentLayer = createTrafficIncidentLayer(trafficIncidents);
        incidentLayer.setZIndex(12);
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
