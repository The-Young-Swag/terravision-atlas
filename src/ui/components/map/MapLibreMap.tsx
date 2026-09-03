import { useEffect, useRef } from 'react';
import { Map as MapLibre, NavigationControl, AttributionControl } from 'maplibre-gl';
import { useMapStore } from '../../../stores/mapStore';
import { MAPLIBRE_DEMO_STYLE } from '../../../core/map/maplibre/style';
import { useMapOverlayContrast } from '../../../hooks/useMapOverlayContrast';
import 'maplibre-gl/dist/maplibre-gl.css';

export function MapLibreMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);

  const { center, zoom } = useMapStore();

  // Adaptive contrast for in-map UI (controls, attribution)
  const { theme, textPrimary, attributionText } = useMapOverlayContrast();

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
      useMapStore.getState().setCenter([c.lng, c.lat]);
      useMapStore.getState().setZoom(z);
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
