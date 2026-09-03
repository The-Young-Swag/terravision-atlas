import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { useMapStore } from '../../../stores/mapStore';
import { createCesiumViewer, flyToCesium } from '../../../core/map/cesium/createCesiumViewer';
import { useMapOverlayContrast } from '../../../hooks/useMapOverlayContrast';
import 'cesium/Build/Cesium/Widgets/widgets.css';

export function CesiumGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  const { center, zoom } = useMapStore();
  const basemap = useMapStore((s) => s.basemap);

  // Adaptive contrast for in-map Cesium widgets
  const { theme } = useMapOverlayContrast();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || viewerRef.current) return;

    let cancelled = false;
    let viewer: Cesium.Viewer | null = null;

    createCesiumViewer({ container, center, zoom })
      .then((v) => {
        if (cancelled) {
          v.destroy();
          return;
        }
        viewerRef.current = v;
        viewer = v;

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
  }, [basemap]); // Re-create viewer when basemap changes (for theme adaptation)

  // Sync center/zoom when store changes (e.g., search fly-to)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    flyToCesium(viewer, center, zoom);
  }, [center, zoom]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full bg-[#0A0E19]"
      aria-label="3D globe"
      role="region"
    />
  );
}
