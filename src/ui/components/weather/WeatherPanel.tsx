import { useState } from 'react';
import { CloudSun, RefreshCw } from 'lucide-react';
import { FloatingPanel } from '../common/FloatingPanel';
import { useWeather } from '../../../hooks/useWeather';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { describeWeatherCode } from '../../../features/weather/openMeteo';
import { ForecastChart } from './ForecastChart';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// Archive latency: Open-Meteo serves history ~5 days behind real time.
const HISTORY_MAX = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 10);

// Live weather for the map viewport center (in Monitor mode, one-click
// event avoidance flies the center to the event, so the forecast follows
// the selected event with no extra selection state).
export function WeatherPanel() {
  const {
    current,
    forecast,
    historical,
    historicalDate,
    location,
    loading,
    error,
    lastUpdated,
    stale,
    refresh,
    fetchHistorical,
  } = useWeather();
  const isBrightBasemap = useBrightBasemap();
  const [historyDate, setHistoryDate] = useState('');

  const labelClass = `mb-1 block text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`;
  const valueClass = `font-mono text-[12px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`;
  const metaClass = `font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`;

  const requestHistorical = () => {
    if (!historyDate) return;
    const date = new Date(`${historyDate}T12:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.getTime() > Date.now()) return;
    void fetchHistorical(date);
  };

  return (
    <FloatingPanel
      id="weather"
      title="Weather"
      icon={<CloudSun className="h-3.5 w-3.5" />}
      initialPosition={{ x: 620, y: 96 }}
      bubbleLabel="Weather"
    >
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className={metaClass}>{location ? `Map center · ${location.label}` : 'Locating…'}</span>
          {stale && <span className={metaClass}>cached</span>}
        </div>

        {loading && !current && (
          <p className={`py-4 text-center font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
            Loading live weather…
          </p>
        )}

        {current && (
          <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className={`text-[15px] font-semibold ${isBrightBasemap ? 'text-slate-800' : 'text-slate-100'}`}>
              {current.temperatureC.toFixed(1)}°C · {describeWeatherCode(current.weatherCode)}
            </p>
            <p className={`mt-1 ${valueClass}`}>
              Wind {current.windSpeedKmh.toFixed(0)} km/h · {current.isDay ? 'Day' : 'Night'}
            </p>
          </div>
        )}

        {forecast && forecast.hourly.length > 0 && (
          <div className="mb-3">
            <p className={labelClass}>7-day forecast</p>
            <ForecastChart hourly={forecast.hourly} label="7-day temperature and precipitation forecast" />
          </div>
        )}

        <div className="mb-3">
          <p className={labelClass}>Past weather</p>
          <div className="flex gap-2">
            <input
              type="date"
              value={historyDate}
              max={HISTORY_MAX}
              onChange={(e) => setHistoryDate(e.target.value)}
              aria-label="Historical weather date"
              className={`flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-[12px] outline-none focus:border-[#5500a4]/50 ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}
            />
            <button
              type="button"
              onClick={requestHistorical}
              disabled={!historyDate || loading}
              className="rounded-xl bg-[#5500a4] px-3 py-2 text-[12px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
            >
              Load
            </button>
          </div>
          {historical && historicalDate && historical.hourly.length > 0 && (
            <div className="mt-2">
              <ForecastChart hourly={historical.hourly} label={`Weather on ${historicalDate}`} />
            </div>
          )}
          {historical && historicalDate && historical.hourly.length === 0 && (
            <p className={`mt-2 ${metaClass}`}>No archive data for {historicalDate} at this location yet.</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#5500a4] py-2 text-[12.5px] font-medium text-white transition hover:brightness-110"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          {loading ? 'Refreshing…' : 'Refresh weather'}
        </button>
        {error && (
          <p className="mt-2 rounded-lg border border-[#E63946]/30 bg-[#E63946]/10 px-3 py-2 text-[11px] text-[#ff8a8a]">
            {error}
          </p>
        )}
        {lastUpdated && (
          <p className={`mt-2 text-center ${metaClass}`}>Updated {dayjs(lastUpdated).fromNow()}</p>
        )}
      </div>
    </FloatingPanel>
  );
}
