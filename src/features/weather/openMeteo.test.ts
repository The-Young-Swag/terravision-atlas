import { describe, expect, it } from 'vitest';
import { describeWeatherCode, parseCurrentConditions, parseHourlyForecast } from './openMeteo';

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
