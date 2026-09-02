import { useEffect, useRef } from 'react';
import { Map as MapLibre, NavigationControl, AttributionControl } from 'maplibre-gl';
import { useMapStore } from '../../../stores/mapStore';
import { MAPLIBRE_DEMO_STYLE } from '../../../core/map/maplibre/style';
import 'maplibre-gl/dist/maplibre-gl.css';

export function MapLibreMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);

  const { center, zoom } = useMapStore();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = new MapLibre({
      container,
      style: MAPLIBRE_DEMO_STYLE,
      center,
      zoom,
      attributionControl: false,
    });

    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');

    // Sync view changes back to store on moveend (same pattern as OpenLayers fix)
    let isProgrammatic = false;

    map.on('moveend', () => {
      if (isProgrammatic) {
        isProgrammatic = false;
        return;
      }
      const c = map.getCenter();
      const z = map.getZoom();
      useMapStore.getState().setCenter([c.lng, c.lat]);
      useMapStore.getState().setZoom(z);
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
