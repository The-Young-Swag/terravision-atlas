import axios from 'axios';

// Open-Meteo weather — free, keyless, no registration.
// Docs: https://open-meteo.com/en/docs
// Rate limits are generous for client use; every fetch below is user- or
// timer-initiated (hourly cadence) and failures surface honestly — never
// fabricated conditions.
const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1/archive';
const REQUEST_TIMEOUT_MS = 12000;

export interface CurrentConditions {
  temperatureC: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  weatherCode: number;
  isDay: boolean;
  observedAt: string;
}

export interface HourlyPoint {
  time: string;
  temperatureC: number | null;
  precipitationMm: number | null;
}

export interface Forecast {
  hourly: HourlyPoint[];
  fetchedAt: string;
}

// WMO weather-code groups (https://open-meteo.com/en/docs#weathercode).
// Partly cloudy (2), overcast (3), and fog (45, 48) are distinct groups
// so visuals and labels can treat each honestly instead of lumping them.
export const CLEAR_CODES = [0, 1];
export const PARTLY_CLOUDY_CODES = [2];
export const OVERCAST_CODES = [3];
export const FOG_CODES = [45, 48];
/** Kept for compatibility: every non-precipitation cloud/fog code. */
export const CLOUDY_CODES = [...PARTLY_CLOUDY_CODES, ...OVERCAST_CODES, ...FOG_CODES];
export const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82];
export const SNOW_CODES = [71, 73, 75, 77, 85, 86];
export const STORM_CODES = [95, 96, 99];

export function describeWeatherCode(code: number): string {
  if (CLEAR_CODES.includes(code)) return code === 0 ? 'Clear sky' : 'Mainly clear';
  if (PARTLY_CLOUDY_CODES.includes(code)) return 'Partly cloudy';
  if (OVERCAST_CODES.includes(code)) return 'Overcast';
  if (FOG_CODES.includes(code)) return 'Fog';
  if (RAIN_CODES.includes(code)) return 'Rain';
  if (SNOW_CODES.includes(code)) return 'Snow';
  if (STORM_CODES.includes(code)) return 'Thunderstorm';
  return 'Unknown';
}

interface CurrentResponse {
  current_weather?: {
    temperature?: number;
    windspeed?: number;
    winddirection?: number;
    weathercode?: number;
    is_day?: number;
    time?: string;
  };
}

interface HourlyResponse {
  hourly?: {
    time?: string[];
    temperature_2m?: (number | null)[];
    precipitation?: (number | null)[];
  };
}

/** Pure response transform, exported for unit tests. */
export function parseCurrentConditions(data: CurrentResponse): CurrentConditions | null {
  const current = data.current_weather;
  if (
    !current ||
    typeof current.temperature !== 'number' ||
    typeof current.windspeed !== 'number' ||
    typeof current.winddirection !== 'number' ||
    typeof current.weathercode !== 'number'
  ) {
    return null;
  }
  return {
    temperatureC: current.temperature,
    windSpeedKmh: current.windspeed,
    windDirectionDeg: current.winddirection,
    weatherCode: current.weathercode,
    isDay: current.is_day !== 0,
    observedAt: current.time ?? new Date().toISOString(),
  };
}

/** Pure response transform, exported for unit tests. */
export function parseHourlyForecast(data: HourlyResponse): HourlyPoint[] {
  const hourly = data.hourly;
  if (!hourly || !Array.isArray(hourly.time)) return [];
  return hourly.time.map((time, i) => ({
    time,
    temperatureC: hourly.temperature_2m?.[i] ?? null,
    precipitationMm: hourly.precipitation?.[i] ?? null,
  }));
}

async function fetchWithTimeout(url: string): Promise<unknown> {
  try {
    const { data } = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const failed = new Error(
        status !== undefined ? `Weather request failed (HTTP ${status})` : `Weather service unreachable: ${error.message}`,
      );
      (failed as { cause?: unknown }).cause = error;
      throw failed;
    }
    throw error;
  }
}

export async function fetchCurrentWeather(lat: number, lon: number): Promise<CurrentConditions | null> {
  const url = `${FORECAST_BASE}?latitude=${lat}&longitude=${lon}&current_weather=true`;
  return parseCurrentConditions((await fetchWithTimeout(url)) as CurrentResponse);
}

export async function fetchForecast(lat: number, lon: number): Promise<Forecast> {
  const url =
    `${FORECAST_BASE}?latitude=${lat}&longitude=${lon}` +
    '&hourly=temperature_2m,precipitation&forecast_days=7';
  const hourly = parseHourlyForecast((await fetchWithTimeout(url)) as HourlyResponse);
  return { hourly, fetchedAt: new Date().toISOString() };
}

function toArchiveDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function fetchHistoricalWeather(lat: number, lon: number, date: Date): Promise<Forecast> {
  const day = toArchiveDate(date);
  const url =
    `${ARCHIVE_BASE}?latitude=${lat}&longitude=${lon}` +
    `&start_date=${day}&end_date=${day}&hourly=temperature_2m,precipitation`;
  const hourly = parseHourlyForecast((await fetchWithTimeout(url)) as HourlyResponse);
  return { hourly, fetchedAt: new Date().toISOString() };
}
