import { describe, expect, it } from 'vitest';
import { describeWeatherCode, formatHourLabel, parseCurrentConditions, parseHourlyForecast, selectNext24Hours, type HourlyPoint } from './openMeteo';

describe('parseCurrentConditions', () => {
  it('extracts conditions from a valid response', () => {
    expect(
      parseCurrentConditions({
        current_weather: {
          temperature: 28.5,
          windspeed: 12.3,
          winddirection: 90,
          weathercode: 2,
          is_day: 1,
          time: '2026-09-06T10:00',
        },
      }),
    ).toEqual({
      temperatureC: 28.5,
      windSpeedKmh: 12.3,
      windDirectionDeg: 90,
      weatherCode: 2,
      isDay: true,
      observedAt: '2026-09-06T10:00',
    });
  });

  it('returns null for missing or partial payloads', () => {
    expect(parseCurrentConditions({})).toBeNull();
    expect(parseCurrentConditions({ current_weather: { temperature: 20 } })).toBeNull();
  });
});

describe('parseHourlyForecast', () => {
  it('zips parallel arrays into hourly points', () => {
    expect(
      parseHourlyForecast({
        hourly: {
          time: ['2026-09-06T00:00', '2026-09-06T01:00'],
          temperature_2m: [25, null],
          precipitation: [0, 1.2],
        },
      }),
    ).toEqual([
      { time: '2026-09-06T00:00', temperatureC: 25, precipitationMm: 0 },
      { time: '2026-09-06T01:00', temperatureC: null, precipitationMm: 1.2 },
    ]);
  });

  it('returns [] without hourly data', () => {
    expect(parseHourlyForecast({})).toEqual([]);
  });
});

describe('describeWeatherCode', () => {
  it('labels known WMO groups', () => {
    expect(describeWeatherCode(0)).toBe('Clear sky');
    expect(describeWeatherCode(63)).toBe('Rain');
    expect(describeWeatherCode(95)).toBe('Thunderstorm');
    expect(describeWeatherCode(999)).toBe('Unknown');
  });

  it('distinguishes partly cloudy, overcast, and fog', () => {
    expect(describeWeatherCode(2)).toBe('Partly cloudy');
    expect(describeWeatherCode(3)).toBe('Overcast');
    expect(describeWeatherCode(45)).toBe('Fog');
    expect(describeWeatherCode(48)).toBe('Fog');
  });
});

function hourlyFixture(startHour: number, count: number): HourlyPoint[] {
  const points: HourlyPoint[] = [];
  const base = new Date(2026, 8, 7, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const time = new Date(base.getTime() + (startHour + i) * 3600 * 1000);
    points.push({ time: time.toISOString(), temperatureC: 20 + i * 0.1, precipitationMm: 0 });
  }
  return points;
}

describe('formatHourLabel', () => {
  it('labels midnight, noon, and afternoon hours unambiguously', () => {
    expect(formatHourLabel(new Date(2026, 8, 7, 0))).toBe('12 AM');
    expect(formatHourLabel(new Date(2026, 8, 7, 6))).toBe('6 AM');
    expect(formatHourLabel(new Date(2026, 8, 7, 12))).toBe('12 PM');
    expect(formatHourLabel(new Date(2026, 8, 7, 18))).toBe('6 PM');
  });
});

describe('selectNext24Hours', () => {
  it('starts at the first point at or after now and takes 24', () => {
    const hourly = hourlyFixture(0, 48);
    const now = new Date(2026, 8, 7, 5, 30, 0);
    const result = selectNext24Hours(hourly, now);
    expect(result).toHaveLength(24);
    expect(new Date(result[0].time).getHours()).toBe(6);
  });

  it('returns what exists when fewer than 24 points remain', () => {
    const hourly = hourlyFixture(0, 10);
    const now = new Date(2026, 8, 7, 5, 0, 0);
    expect(selectNext24Hours(hourly, now)).toHaveLength(5);
  });

  it('returns an empty array when everything is in the past', () => {
    const hourly = hourlyFixture(0, 5);
    const now = new Date(2026, 8, 8, 0, 0, 0);
    expect(selectNext24Hours(hourly, now)).toEqual([]);
  });
});
