import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { useMapStore } from '../../../stores/mapStore';
import { createCesiumViewer, flyToCesium } from '../../../core/map/cesium/createCesiumViewer';
import 'cesium/Build/Cesium/Widgets/widgets.css';

export function CesiumGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  const { center, zoom } = useMapStore();

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

        // Handle resize
        const ro = new ResizeObserver(() => {
          v.resize();
        });
        ro.observe(container);

        // Store for cleanup
        (container as unknown as { __ro?: ResizeObserver }).__ro = ro;
      })
      .catch((err) => {
        console.error('[Cesium] failed to create viewer', err);
      });

    return () => {
      cancelled = true;
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        try {
          viewerRef.current.destroy();
        } catch {
          // ignore
        }
        viewerRef.current = null;
      }
      const ro = (container as unknown as { __ro?: ResizeObserver }).__ro;
      if (ro) ro.disconnect();
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
  }, []);

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
