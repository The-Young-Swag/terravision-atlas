import { useEffect, useRef, useMemo } from 'react';
import Map from 'ol/Map';
import { fromLonLat, toLonLat } from 'ol/proj';
import { useMapStore } from '../../../stores/mapStore';
import { useDisasterStore } from '../../../stores/disasterStore';
import { createMap, updateBasemap } from '../../../core/map/openlayers/createMap';
import { createHazardLayer } from '../../../core/map/openlayers/hazardLayer';
import 'ol/ol.css';

export function OpenLayersMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const hazardLayerRef = useRef<ReturnType<typeof createHazardLayer> | null>(null);
  const isProgrammaticRef = useRef(false);

  const { center, zoom, basemap, showHazards, setCenter, setZoom } = useMapStore();
  const { events: disasterEvents } = useDisasterStore();

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
    });

    // Initial hazard layer — uses live disaster events
    if (showHazards && hazardFeatures.length > 0) {
      const hazardLayer = createHazardLayer(hazardFeatures);
      map.addLayer(hazardLayer);
      hazardLayerRef.current = hazardLayer;
    }

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

  // Toggle hazards and update when events change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing hazard layer first
    if (hazardLayerRef.current) {
      map.removeLayer(hazardLayerRef.current);
      hazardLayerRef.current = null;
    }

    if (showHazards && hazardFeatures.length > 0) {
      const layer = createHazardLayer(hazardFeatures);
      map.addLayer(layer);
      hazardLayerRef.current = layer;
    }
  }, [showHazards, hazardFeatures]);

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
