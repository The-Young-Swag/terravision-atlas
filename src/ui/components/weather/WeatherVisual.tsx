import type { CurrentConditions } from '../../../features/weather/openMeteo';
import {
  CLEAR_CODES,
  PARTLY_CLOUDY_CODES,
  OVERCAST_CODES,
  FOG_CODES,
  RAIN_CODES,
  SNOW_CODES,
  STORM_CODES,
  describeWeatherCode,
} from '../../../features/weather/openMeteo';

type WeatherCategory =
  | 'clear'
  | 'partly'
  | 'overcast'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'unknown';

function categorizeWeatherCode(code: number): WeatherCategory {
  if (CLEAR_CODES.includes(code)) return 'clear';
  if (PARTLY_CLOUDY_CODES.includes(code)) return 'partly';
  if (OVERCAST_CODES.includes(code)) return 'overcast';
  if (FOG_CODES.includes(code)) return 'fog';
  if (RAIN_CODES.includes(code)) return 'rain';
  if (SNOW_CODES.includes(code)) return 'snow';
  if (STORM_CODES.includes(code)) return 'storm';
  return 'unknown';
}

interface WeatherVisualProps {
  current: CurrentConditions | null;
  size?: number;
}

// CSS claymorphism weather visual (no SVG elements anywhere in this
// component). Layering rule, applied to every state: celestial body
// (sun/moon) sits small at top-right, cloud mass sits bottom-left —
// the two never overlap into a fused blob. Overcast skies (overcast,
// fog, rain, storm, snow) show no celestial body at all; day/night
// there is a tint shift on the cloud instead. One depth rule: shared
// soft shadow, cloud opacity .95, precipitation opacity .9.
// Motion rule: no idle loops. A single 300ms enter fade/scale runs
// once when the condition changes (keyed by category + time of day).
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
      key={`${category}-${timeOfDay}`}
      className={`weather-visual weather-enter weather-${category} weather-${timeOfDay}`}
      style={{ width: size, height: size }}
      aria-label={label}
      role="img"
    >
      {category === 'clear' && <ClearVisual isDay={current.isDay} />}
      {category === 'partly' && <PartlyVisual isDay={current.isDay} />}
      {category === 'overcast' && <OvercastVisual />}
      {category === 'fog' && <FogVisual />}
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
        <div className="weather-shape weather-moon-core weather-clay" />
      )}
    </>
  );
}

function PartlyVisual({ isDay }: { isDay: boolean }) {
  return (
    <div className="weather-cloud-group">
      {isDay ? (
        <div className="weather-shape weather-sun-small weather-clay" />
      ) : (
        <div className="weather-shape weather-moon-small weather-clay" />
      )}
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-left" />
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-center" />
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-right" />
    </div>
  );
}

function OvercastVisual() {
  return (
    <div className="weather-cloud-group">
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-left" />
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-center" />
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-right" />
    </div>
  );
}

function FogVisual() {
  return (
    <div className="weather-cloud-group">
      <div className="weather-shape weather-cloud-part weather-clay weather-cloud-fog" />
      <div className="weather-fog-bank weather-fog-bank-1" />
      <div className="weather-fog-bank weather-fog-bank-2" />
      <div className="weather-fog-bank weather-fog-bank-3" />
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
