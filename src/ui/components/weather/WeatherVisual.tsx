import type { CurrentConditions } from '../../../features/weather/openMeteo';
import {
  CLEAR_CODES,
  CLOUDY_CODES,
  RAIN_CODES,
  SNOW_CODES,
  STORM_CODES,
  describeWeatherCode,
} from '../../../features/weather/openMeteo';

type WeatherCategory = 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'unknown';

function categorizeWeatherCode(code: number): WeatherCategory {
  if (CLEAR_CODES.includes(code)) return 'clear';
  if (CLOUDY_CODES.includes(code)) return 'cloudy';
  if (RAIN_CODES.includes(code)) return 'rain';
  if (SNOW_CODES.includes(code)) return 'snow';
  if (STORM_CODES.includes(code)) return 'storm';
  return 'unknown';
}

interface WeatherVisualProps {
  current: CurrentConditions | null;
  size?: number;
}

// CSS-based claymorphism weather visual. Single consistent light-source
// direction (top-left) across every state. Each condition uses a CSS
// gradient + box-shadow for the extruded 3D look; no SVG elements.
export function WeatherVisual({ current, size = 96 }: WeatherVisualProps) {
  if (!current) {
    return (
      <div
        className="weather-visual weather-unknown"
        style={{ width: size, height: size }}
        aria-label="No weather data available"
      >
        <div className="weather-shape weather-shape-unknown" />
      </div>
    );
  }

  const category = categorizeWeatherCode(current.weatherCode);
  const timeOfDay = current.isDay ? 'day' : 'night';
  const label = `${describeWeatherCode(current.weatherCode)} (${timeOfDay})`;

  return (
    <div
      className={`weather-visual weather-${category} weather-${timeOfDay}`}
      style={{ width: size, height: size }}
      aria-label={label}
      role="img"
    >
      {category === 'clear' && <ClearVisual isDay={current.isDay} />}
      {category === 'cloudy' && <CloudyVisual isDay={current.isDay} />}
      {category === 'rain' && <RainVisual />}
      {category === 'snow' && <SnowVisual />}
      {category === 'storm' && <StormVisual />}
      {category === 'unknown' && <UnknownVisual />}
    </div>
  );
}

function ClearVisual({ isDay }: { isDay: boolean }) {
  return (
    <>
      {isDay ? (
        <div className="weather-shape weather-sun-core weather-clay" />
      ) : (
        // Night: show a moon (not the sun) — confirmed day/night fix.
        <div className="weather-shape weather-moon-core weather-clay" />
      )}
    </>
  );
}

function CloudyVisual({ isDay }: { isDay: boolean }) {
  return (
    <div className="weather-cloud-group">
      {isDay ? (
        <>
          <div className="weather-shape weather-sun-core weather-clay weather-sun-behind-cloud" />
        </>
      ) : (
        // Night: show a moon, not the sun.
        <div className="weather-shape weather-moon-core weather-clay weather-moon-behind-cloud" />
      )}
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-left" />
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-center" />
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-right" />
    </div>
  );
}

function RainVisual() {
  return (
    <div className="weather-cloud-group">
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-left weather-cloud-rain" />
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-center weather-cloud-rain" />
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-right weather-cloud-rain" />
      <div className="weather-rain-drops">
        <div className="weather-rain-drop weather-rain-drop-1" />
        <div className="weather-rain-drop weather-rain-drop-2" />
        <div className="weather-rain-drop weather-rain-drop-3" />
      </div>
    </div>
  );
}

function SnowVisual() {
  return (
    <div className="weather-cloud-group">
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-left weather-cloud-snow" />
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-center weather-cloud-snow" />
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-right weather-cloud-snow" />
      <div className="weather-snow-flakes">
        <div className="weather-snow-flake weather-snow-flake-1" />
        <div className="weather-snow-flake weather-snow-flake-2" />
        <div className="weather-snow-flake weather-snow-flake-3" />
      </div>
    </div>
  );
}

function StormVisual() {
  return (
    <div className="weather-cloud-group">
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-left weather-cloud-storm" />
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-center weather-cloud-storm" />
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-right weather-cloud-storm" />
      <div className="weather-lightning-bolt" />
    </div>
  );
}

function UnknownVisual() {
  return (
    <div className="weather-shape weather-shape-unknown weather-clay" />
  );
}
