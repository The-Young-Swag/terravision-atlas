import { useEffect, useRef, useMemo } from 'react';
import Map from 'ol/Map';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { fromLonLat, toLonLat } from 'ol/proj';
import { MEASURE_CLOSE_TOLERANCE_PX, useMapStore } from '../../../features/map/store';
import { useDisasterStore } from '../../../stores/disasterStore';
import { createMap, updateBasemap } from '../../../features/map/openlayers/createMap';
import { createHazardLayer } from '../../../core/map/openlayers/hazardLayer';
import { createHikingTrailsLayer } from '../../../core/map/openlayers/trailsLayer';
import {
  createRouteLayer,
  jogLoopAsEvacRoute,
  attachAvoidDrawOpenLayers,
  renderAvoidCircleOpenLayers,
  applyAvoidCursorOpenLayers,
  useRouteStore,
} from '../../../features/navigation';
import DragPan from 'ol/interaction/DragPan';
import { createEvacPinLayer } from '../../../core/map/openlayers/pinLayer';
import Translate from 'ol/interaction/Translate';
import { createShelterLayer, useShelterStore, shelterPopupHtml } from '../../../features/shelters';
import '../../../features/shelters/shelterPopup.css';
import { createSearchMarkerLayer } from '../../../core/map/openlayers/searchLayer';
import { useSearchStore } from '../../../stores/searchStore';
import { reverseNominatim } from '../../../features/search';
import { niceMeterStep, snapToUtmGrid } from '../../../core/geodetic/grid/snap';
import { createMeasureLayer } from '../../../core/map/openlayers/measureLayer';
import { geodesicKilometers, formatDistanceKilometers } from '../../../core/geodetic/measurements/distance';
import { geodesicAreaSqMeters, formatAreaSqMeters } from '../../../core/geodetic/measurements/area';
import {
  createTrafficFlowLayer,
  createTrafficIncidentLayer,
  useTrafficStore,
  tomtomApiKey,
  refreshTraffic,
  incidentPopupHtml,
} from '../../../features/traffic';
import '../../../features/traffic/incidentPopup.css';
import { TRAFFIC_FLOW_OPACITY } from '../../../features/map/routeStyle';
import { createWeatherLayer, weatherPopupHtml, useWeatherStore } from '../../../features/weather';
import '../../../features/weather/popup.css';
import Overlay from 'ol/Overlay';
import { useMapOverlayContrast } from '../../../hooks/useMapOverlayContrast';
import 'ol/ol.css';

export function OpenLayersMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const hazardLayerRef = useRef<ReturnType<typeof createHazardLayer> | null>(null);
  const trailsLayerRef = useRef<ReturnType<typeof createHikingTrailsLayer> | null>(null);
  const routeLayerRef = useRef<ReturnType<typeof createRouteLayer> | null>(null);
  const shelterLayerRef = useRef<ReturnType<typeof createShelterLayer> | null>(null);
  const trafficFlowLayerRef = useRef<ReturnType<typeof createTrafficFlowLayer> | null>(null);
  const trafficIncidentLayerRef = useRef<ReturnType<typeof createTrafficIncidentLayer> | null>(null);
  const trafficRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incidentPopupRef = useRef<Overlay | null>(null);
  const shelterPopupRef = useRef<Overlay | null>(null);
  const measureLayerRef = useRef<ReturnType<typeof createMeasureLayer> | null>(null);
  const isProgrammaticRef = useRef(false);

  const { center, zoom, basemap, satelliteSource, streetsSource, showHazards, showTraffic, showHikingTrails, setCenter, setZoom } = useMapStore();
  const measureActive = useMapStore((s) => s.measureActive);
  const measurePoints = useMapStore((s) => s.measurePoints);
  const measureMode = useMapStore((s) => s.measureMode);
  const measureClosed = useMapStore((s) => s.measureClosed);
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
  const routeTrafficSamples = useMemo(() => routeTraffic?.samples ?? [], [routeTraffic]);
  const drawAvoidArmed = useRouteStore((s) => s.drawAvoidArmed);
  const avoidLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const evacStart = useRouteStore((s) => s.start);
  const evacDestination = useRouteStore((s) => s.destination);
  const pinLayerRef = useRef<ReturnType<typeof createEvacPinLayer> | null>(null);
  const pinTranslateRef = useRef<Translate | null>(null);
  const measureDragRef = useRef<{ index: number; startPixel: [number, number] } | null>(null);
  const measureDragSuppressRef = useRef(false);
  const shelters = useShelterStore((s) => s.shelters);
  const trafficStatus = useTrafficStore((s) => s.status);
  const trafficIncidents = useTrafficStore((s) => s.incidents);
  const weatherLocation = useWeatherStore((s) => s.location);
  const weatherLayerRef = useRef<ReturnType<typeof createWeatherLayer> | null>(null);
  const weatherPopupRef = useRef<Overlay | null>(null);

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
      streetsSource,
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
        // Snap-to-grid survey tool: UTM 51N meter grid at a
        // resolution-adaptive step so reported coordinates land exactly on
        // grid lines.
        const resolution = view.getResolution();
        const snapped =
          useMapStore.getState().snapToGrid && resolution !== undefined
            ? snapToUtmGrid(rawLon, rawLat, niceMeterStep(resolution))
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

    // Initial hiking-trails overlay, same lifecycle as hazards above
    if (showHikingTrails) {
      const trailsLayer = createHikingTrailsLayer();
      trailsLayer.setZIndex(8);
      map.addLayer(trailsLayer);
      trailsLayerRef.current = trailsLayer;
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

    // Shelter popup — same Overlay pattern, real Overpass fields only.
    const shelterPopupElement = document.createElement('div');
    const shelterPopup = new Overlay({
      element: shelterPopupElement,
      positioning: 'bottom-center',
      offset: [0, -10],
      stopEvent: true,
    });
    map.addOverlay(shelterPopup);
    shelterPopupRef.current = shelterPopup;

    // Weather popup — current conditions at the weather marker.
    const weatherPopupElement = document.createElement('div');
    const weatherPopup = new Overlay({
      element: weatherPopupElement,
      positioning: 'bottom-center',
      offset: [0, -10],
      stopEvent: true,
    });
    map.addOverlay(weatherPopup);
    weatherPopupRef.current = weatherPopup;

    const handleMapClick = (event: MapBrowserEvent) => {
      const feature = map.forEachFeatureAtPixel(event.pixel, (found) => found, {
        layerFilter: (layer) => layer.get('layerId') === 'traffic-incidents',
      });
      const geometry = feature?.getGeometry();
      const incidentId = feature?.get('incidentId');
      if (typeof incidentId !== 'string' || !(geometry instanceof Point)) {
        popup.setPosition(undefined);
      } else {
        const incident = useTrafficStore.getState().incidents.find((item) => item.id === incidentId);
        if (!incident) {
          popup.setPosition(undefined);
        } else {
          popupElement.innerHTML = incidentPopupHtml(incident);
          popup.setPosition(geometry.getCoordinates());
          shelterPopup.setPosition(undefined);
          weatherPopup.setPosition(undefined);
          return;
        }
      }
      const shelterFeature = map.forEachFeatureAtPixel(event.pixel, (found) => found, {
        layerFilter: (layer) => layer.get('layerId') === 'shelters',
      });
      const shelterGeometry = shelterFeature?.getGeometry();
      const shelterId = shelterFeature?.get('shelterId');
      if (typeof shelterId !== 'string' || !(shelterGeometry instanceof Point)) {
        shelterPopup.setPosition(undefined);
        return;
      }
      const shelter = useShelterStore.getState().shelters.find((item) => item.id === shelterId);
      if (!shelter) {
        shelterPopup.setPosition(undefined);
      } else {
        shelterPopupElement.innerHTML = shelterPopupHtml(shelter);
        shelterPopup.setPosition(shelterGeometry.getCoordinates());
        weatherPopup.setPosition(undefined);
        return;
      }
      const weatherFeature = map.forEachFeatureAtPixel(event.pixel, (found) => found, {
        layerFilter: (layer) => layer.get('layerId') === 'weather',
      });
      const weatherGeometry = weatherFeature?.getGeometry();
      if (weatherFeature?.get('weatherMarker') !== true || !(weatherGeometry instanceof Point)) {
        weatherPopup.setPosition(undefined);
        return;
      }
      const weather = useWeatherStore.getState();
      if (!weather.current || !weather.location) {
        weatherPopup.setPosition(undefined);
        return;
      }
      weatherPopupElement.innerHTML = weatherPopupHtml(weather.current, weather.location.label);
      weatherPopup.setPosition(weatherGeometry.getCoordinates());
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

    // Geodesic measure tool: picks points while armed. With snap-to-grid
    // armed, vertices land on the same UTM grid as the reported center.
    map.on('click', (event: MapBrowserEvent) => {
      if (measureDragSuppressRef.current) {
        measureDragSuppressRef.current = false;
        return;
      }
      const state = useMapStore.getState();
      if (!state.measureActive) return;
      const [lon, lat] = toLonLat(event.coordinate);
      const resolution = map.getView().getResolution() ?? 0;
      const snapped =
        state.snapToGrid && resolution > 0
          ? snapToUtmGrid(lon, lat, niceMeterStep(resolution))
          : { lon, lat };
      const first = state.measureMode === 'area' && !state.measureClosed ? state.measurePoints[0] : undefined;
      if (first && state.measurePoints.length >= 3) {
        const firstPx = map.getPixelFromCoordinate(fromLonLat(first));
        const dx = event.pixel[0] - firstPx[0];
        const dy = event.pixel[1] - firstPx[1];
        if (Math.hypot(dx, dy) <= MEASURE_CLOSE_TOLERANCE_PX) {
          state.setMeasureClosed(true);
          return;
        }
      }
      state.pushMeasurePoint([snapped.lon, snapped.lat]);
    });

    // Measure vertex dragging: press-drag-release on a vertex repositions it
    // with live recalculation in the dock; a plain click still appends.
    // Raw viewport pointer events (not map.on) — OpenLayers has no
    // pointerdown/pointerup map events, only pointermove/pointerdrag.
    const measureViewport = map.getViewport();
    const viewportPixel = (event: PointerEvent): [number, number] => {
      const rect = measureViewport.getBoundingClientRect();
      return [event.clientX - rect.left, event.clientY - rect.top];
    };
    const onMeasurePointerDown = (event: PointerEvent) => {
      const state = useMapStore.getState();
      if (!state.measureActive || event.button !== 0) return;
      const pixel = viewportPixel(event);
      const feature = map.forEachFeatureAtPixel(pixel, (found) => found, {
        layerFilter: (layer) => layer.get('layerId') === 'measure',
      });
      const index = feature?.get('vertexIndex');
      if (typeof index !== 'number') return;
      measureDragRef.current = { index, startPixel: pixel };
      const pan = map
        .getInteractions()
        .getArray()
        .find((interaction): interaction is DragPan => interaction instanceof DragPan);
      if (pan) pan.setActive(false);
    };
    const onMeasurePointerMove = (event: PointerEvent) => {
      const drag = measureDragRef.current;
      if (!drag || event.buttons === 0) return;
      const state = useMapStore.getState();
      const coordinate = map.getCoordinateFromPixel(viewportPixel(event));
      if (!coordinate) return;
      const [lon, lat] = toLonLat(coordinate);
      const resolution = map.getView().getResolution() ?? 0;
      const snapped =
        state.snapToGrid && resolution > 0
          ? snapToUtmGrid(lon, lat, niceMeterStep(resolution))
          : { lon, lat };
      state.setMeasurePoint(drag.index, [snapped.lon, snapped.lat]);
    };
    const onMeasurePointerUp = (event: PointerEvent) => {
      const drag = measureDragRef.current;
      if (!drag) return;
      const pixel = viewportPixel(event);
      const dx = pixel[0] - drag.startPixel[0];
      const dy = pixel[1] - drag.startPixel[1];
      measureDragRef.current = null;
      if (Math.hypot(dx, dy) > 4) measureDragSuppressRef.current = true;
      const pan = map
        .getInteractions()
        .getArray()
        .find((interaction): interaction is DragPan => interaction instanceof DragPan);
      if (pan) pan.setActive(true);
    };
    measureViewport.addEventListener('pointerdown', onMeasurePointerDown);
    measureViewport.addEventListener('pointermove', onMeasurePointerMove);
    measureViewport.addEventListener('pointerup', onMeasurePointerUp);

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

    // Avoid-zone draw tool lives in features/navigation (press-drag-release
    // sketches a circle while armed; see attachAvoidDrawOpenLayers).
    const detachAvoidDraw = attachAvoidDrawOpenLayers(map);
    (mapRef.current as unknown as { __olmap?: Map }).__olmap = map;
    mapInstanceRef.current = map;

    // Handle resize — OpenLayers needs explicit update when container changes
    const resizeObserver = new ResizeObserver(() => map.updateSize());
    resizeObserver.observe(mapRef.current);

    return () => {
      resizeObserver.disconnect();
      map.getViewport()?.removeEventListener('contextmenu', handleContextMenu);
      detachAvoidDraw();
      measureViewport.removeEventListener('pointerdown', onMeasurePointerDown);
      measureViewport.removeEventListener('pointermove', onMeasurePointerMove);
      measureViewport.removeEventListener('pointerup', onMeasurePointerUp);
      map.setTarget(undefined);
      mapInstanceRef.current = null;
    };
    // Only run once on mount — basemap/center updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update basemap when store changes
  // (basemap slot, satellite source, or streets source within the slot)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    updateBasemap(map, basemap, satelliteSource, streetsSource);
  }, [basemap, satelliteSource, streetsSource]);

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

  // Hiking-trails overlay — Waymarked Trails tiles above the basemap.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (trailsLayerRef.current) {
      map.removeLayer(trailsLayerRef.current);
      trailsLayerRef.current = null;
    }

    if (showHikingTrails) {
      const layer = createHikingTrailsLayer();
      layer.setZIndex(8);
      map.addLayer(layer);
      trailsLayerRef.current = layer;
    }
  }, [showHikingTrails]);

  // Evacuation route overlay — rebuilt whenever the route or avoid area changes.
  // The route renders above the traffic flow layer (explicit z-index, not
  // add-order). Traffic flow stays at FULL OPACITY; the route's traffic-
  // colored outline is the visual signal.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (routeLine) {
      const layer = createRouteLayer(routeLine, routeTrafficSamples);
      layer.setZIndex(10);
      map.addLayer(layer);
      routeLayerRef.current = layer;
    }

    // Traffic flow stays at full opacity; no dimming.
    for (const candidate of map.getLayers().getArray()) {
      if (candidate.get('layerId') === 'traffic-flow') {
        candidate.setOpacity(TRAFFIC_FLOW_OPACITY);
      }
    }
  }, [routeLine, routeTrafficSamples]);

  // Standalone avoid-zone overlay — visible with or without a route.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    renderAvoidCircleOpenLayers(map, avoidLayerRef, avoidCircle);
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
      const closed = measureMode === 'area' && measureClosed;
      const text = closed
        ? formatAreaSqMeters(geodesicAreaSqMeters(measurePoints))
        : formatDistanceKilometers(geodesicKilometers(measurePoints));
      const layer = createMeasureLayer(measurePoints, text, closed);
      map.addLayer(layer);
      measureLayerRef.current = layer;
    }
  }, [measureActive, measurePoints, measureMode, measureClosed]);

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
    return applyAvoidCursorOpenLayers(map, drawAvoidArmed);
  }, [drawAvoidArmed]);

  // Shelter markers — rebuilt whenever the shelter list changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (shelterLayerRef.current) {
      map.removeLayer(shelterLayerRef.current);
      shelterLayerRef.current = null;
    }
    // A rebuilt list invalidates any open popup position.
    shelterPopupRef.current?.setPosition(undefined);

    if (shelters.length > 0) {
      const layer = createShelterLayer(shelters);
      map.addLayer(layer);
      shelterLayerRef.current = layer;
    }
  }, [shelters]);

  // Weather marker — rebuilt when the weather location changes.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (weatherLayerRef.current) {
      map.removeLayer(weatherLayerRef.current);
      weatherLayerRef.current = null;
    }
    weatherPopupRef.current?.setPosition(undefined);
    if (weatherLocation) {
      const layer = createWeatherLayer(weatherLocation.lon, weatherLocation.lat);
      map.addLayer(layer);
      weatherLayerRef.current = layer;
    }
  }, [weatherLocation]);

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
        // Traffic flow stays at full opacity; no dimming when route is displayed.
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
