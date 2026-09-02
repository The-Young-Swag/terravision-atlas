import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import { useMapStore } from '../../../stores/mapStore';
import { createMap, updateBasemap } from '../../../core/map/openlayers/createMap';
import { createHazardLayer } from '../../../core/map/openlayers/hazardLayer';
import 'ol/ol.css';

// Mock hazards — will be replaced by live disaster fetcher
const MOCK_HAZARDS = [
  { id: '1', lon: 120.5887, lat: 15.145, severity: 'high' as const, type: 'earthquake' },
  { id: '2', lon: 119.93, lat: 15.02, severity: 'medium' as const, type: 'wildfire' },
  { id: '3', lon: 120.9, lat: 15.35, severity: 'low' as const, type: 'flood' },
];

export function OpenLayersMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const hazardLayerRef = useRef<ReturnType<typeof createHazardLayer> | null>(null);

  const { center, zoom, basemap, showHazards, setCenter, setZoom } = useMapStore();

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = createMap({
      target: mapRef.current,
      center,
      zoom,
      basemap,
    });

    // Sync view changes back to store (for status bar, URL, etc.)
    map.getView().on('change:center', () => {
      const viewCenter = map.getView().getCenter();
      if (!viewCenter) return;
      // viewCenter is in EPSG:3857, convert back to lon/lat via ol/proj toLonLat
      // Lazy import to avoid top-level proj churn
      import('ol/proj').then(({ toLonLat }) => {
        const [lon, lat] = toLonLat(viewCenter);
        setCenter([lon, lat]);
      });
    });

    map.getView().on('change:resolution', () => {
      const newZoom = map.getView().getZoom();
      if (typeof newZoom === 'number') setZoom(newZoom);
    });

    // Initial hazard layer
    if (showHazards) {
      const hazardLayer = createHazardLayer(MOCK_HAZARDS);
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

  // Toggle hazards
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (showHazards && !hazardLayerRef.current) {
      const layer = createHazardLayer(MOCK_HAZARDS);
      map.addLayer(layer);
      hazardLayerRef.current = layer;
    } else if (!showHazards && hazardLayerRef.current) {
      map.removeLayer(hazardLayerRef.current);
      hazardLayerRef.current = null;
    }
  }, [showHazards]);

  // Keep view in sync if store center/zoom changes externally (e.g., search fly-to)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const view = map.getView();
    import('ol/proj').then(({ fromLonLat }) => {
      view.animate({ center: fromLonLat(center), duration: 500 });
    });
  }, [center]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const view = map.getView();
    if (view.getZoom() !== zoom) {
      view.animate({ zoom, duration: 400 });
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
