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

const SIZE = 120;

export function WeatherVisual({ current, size = SIZE }: WeatherVisualProps) {
  if (!current) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ width: size, height: size }}
        aria-label="No weather data available"
      >
        <div className="weather-unknown" style={{ width: size * 0.6, height: size * 0.6 }} />
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
      {category === 'clear' && (
        <>
          <svg viewBox="0 0 100 100" className="weather-sun" aria-hidden="true">
            <circle className="sun-core" cx="50" cy="50" r="22" />
            <g className="sun-rays">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                <line
                  key={angle}
                  x1="50"
                  y1="50"
                  x2={50 + 38 * Math.cos((angle * Math.PI) / 180)}
                  y2={50 + 38 * Math.sin((angle * Math.PI) / 180)}
                  className="sun-ray"
                />
              ))}
            </g>
          </svg>
          {timeOfDay === 'day' && (
            <svg viewBox="0 0 100 100" className="weather-sky" aria-hidden="true">
              <g className="sun-glare">
                <circle cx="50" cy="50" r="35" className="glare-ring" />
                <circle cx="50" cy="50" r="28" className="glare-ring" />
              </g>
            </svg>
          )}
        </>
      )}

      {category === 'cloudy' && (
        <>
          <svg viewBox="0 0 100 100" className="weather-cloud" aria-hidden="true">
            <g className="cloud-group">
              <ellipse cx="35" cy="55" rx="22" ry="14" className="cloud-part" />
              <ellipse cx="55" cy="45" rx="26" ry="18" className="cloud-part" />
              <ellipse cx="75" cy="55" rx="22" ry="14" className="cloud-part" />
            </g>
          </svg>
          {timeOfDay === 'night' && (
            <svg viewBox="0 0 100 100" className="weather-moon" aria-hidden="true">
              <circle cx="75" cy="25" r="14" className="moon-disk" />
              <circle cx="72" cy="22" r="4" className="moon-crater" />
              <circle cx="78" cy="28" r="2.5" className="moon-crater" />
              <circle cx="68" cy="27" r="1.5" className="moon-crater" />
            </svg>
          )}
        </>
      )}

      {category === 'rain' && (
        <>
          <svg viewBox="0 0 100 100" className="weather-cloud" aria-hidden="true">
            <g className="cloud-group rain-cloud">
              <ellipse cx="35" cy="55" rx="22" ry="14" className="cloud-part" />
              <ellipse cx="55" cy="45" rx="26" ry="18" className="cloud-part" />
              <ellipse cx="75" cy="55" rx="22" ry="14" className="cloud-part" />
            </g>
          </svg>
          <svg viewBox="0 0 100 100" className="weather-rain" aria-hidden="true">
            <g className="rain-drops">
              {[15, 35, 55, 75, 85].map((x, i) => (
                <line
                  key={i}
                  x1={x}
                  y1={65}
                  x2={x - 3}
                  y2={95}
                  className="rain-drop"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </g>
          </svg>
        </>
      )}

      {category === 'snow' && (
        <>
          <svg viewBox="0 0 100 100" className="weather-cloud" aria-hidden="true">
            <g className="cloud-group snow-cloud">
              <ellipse cx="35" cy="55" rx="22" ry="14" className="cloud-part" />
              <ellipse cx="55" cy="45" rx="26" ry="18" className="cloud-part" />
              <ellipse cx="75" cy="55" rx="22" ry="14" className="cloud-part" />
            </g>
          </svg>
          <svg viewBox="0 0 100 100" className="weather-snow" aria-hidden="true">
            <g className="snow-flakes">
              {[15, 35, 55, 75, 85, 25, 45, 65].map((x, i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={65 + (i % 2) * 10}
                  r={2.5}
                  className="snow-flake"
                  style={{ animationDelay: `${i * 0.2}s`, animationDuration: `${3 + (i % 3)}s` }}
                />
              ))}
            </g>
          </svg>
        </>
      )}

      {category === 'storm' && (
        <>
          <svg viewBox="0 0 100 100" className="weather-cloud" aria-hidden="true">
            <g className="cloud-group storm-cloud">
              <ellipse cx="35" cy="55" rx="22" ry="14" className="cloud-part" />
              <ellipse cx="55" cy="45" rx="26" ry="18" className="cloud-part" />
              <ellipse cx="75" cy="55" rx="22" ry="14" className="cloud-part" />
            </g>
          </svg>
          <svg viewBox="0 0 100 100" className="weather-lightning" aria-hidden="true">
            <g className="lightning-group">
              <path
                className="lightning-bolt"
                d="M50 45 L40 70 L55 70 L45 95"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                className="lightning-bolt secondary"
                d="M35 55 L25 80 L40 80 L30 100"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                className="lightning-bolt secondary"
                d="M65 55 L75 80 L60 80 L70 100"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </>
      )}

      {category === 'unknown' && (
        <div className="weather-unknown" style={{ width: size * 0.6, height: size * 0.6 }} />
      )}
    </div>
  );
}