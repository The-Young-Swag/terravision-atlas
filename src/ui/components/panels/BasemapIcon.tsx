import type { BasemapId } from '../../../stores/mapStore';

interface BasemapIconProps {
  basemap: BasemapId;
  isActive: boolean;
  isBrightBasemap: boolean;
  size?: number;
}

// Claymorphism base-map icons (Item 6). Pure CSS/Div, no SVG. Single
// consistent top-left light source across all four icons, with color
// identity preserved (green for Satellite, neutral for Streets, brown
// for Terrain, dark/purple for Dark).
export function BasemapIcon({ basemap, isActive, isBrightBasemap, size = 32 }: BasemapIconProps) {
  const active = isActive;
  return (
    <div
      className={`basemap-icon basemap-icon-${basemap} ${active ? 'basemap-icon-active' : ''} ${
        isBrightBasemap ? 'basemap-icon-light' : 'basemap-icon-dark'
      }`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {basemap === 'satellite' && <SatelliteClay />}
      {basemap === 'streets' && <StreetsClay />}
      {basemap === 'terrain' && <TerrainClay />}
      {basemap === 'dark' && <DarkClay />}
    </div>
  );
}

function SatelliteClay() {
  return (
    <>
      <div className="basemap-globe basemap-clay" />
      <div className="basemap-satellite-ping basemap-clay" />
    </>
  );
}

function StreetsClay() {
  return (
    <>
      <div className="basemap-map-base basemap-clay" />
      <div className="basemap-road basemap-clay basemap-road-h" />
      <div className="basemap-road basemap-clay basemap-road-v" />
      <div className="basemap-road basemap-clay basemap-road-d" />
    </>
  );
}

function TerrainClay() {
  return (
    <>
      <div className="basemap-mountain basemap-clay basemap-mountain-back" />
      <div className="basemap-mountain basemap-clay basemap-mountain-front" />
      <div className="basemap-sun-basemap basemap-clay" />
    </>
  );
}

function DarkClay() {
  return (
    <>
      <div className="basemap-moon-basemap basemap-clay" />
      <div className="basemap-star basemap-clay basemap-star-1" />
      <div className="basemap-star basemap-clay basemap-star-2" />
      <div className="basemap-star basemap-clay basemap-star-3" />
    </>
  );
}
