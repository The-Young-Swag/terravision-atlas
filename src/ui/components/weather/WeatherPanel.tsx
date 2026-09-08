import { useEffect, useMemo, useState } from 'react';
import { CloudSun, MapPin, RefreshCw } from 'lucide-react';
import { FloatingPanel } from '../common/FloatingPanel';
import { useWeather } from '../../../hooks/useWeather';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { useMapStore } from '../../../stores/mapStore';
import { describeWeatherCode, selectNext24Hours } from '../../../features/weather/openMeteo';
import { ForecastChart } from './ForecastChart';
import { HourlyStrip } from './HourlyStrip';
import { WeatherVisual } from './WeatherVisual';
import { PlaceAutocomplete } from '../search/PlaceAutocomplete';
import type { GeocodedPlace } from '../../../features/search/geocode';
import { reverseGeocode } from '../../../core/data/geocode/reverseGeocode';
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
  const [weatherQuery, setWeatherQuery] = useState('');
  const [placeName, setPlaceName] = useState<string | null>(null);
  const setCenter = useMapStore((s) => s.setCenter);
  const setZoom = useMapStore((s) => s.setZoom);

  const labelClass = `mb-2 block text-[11px] font-medium uppercase tracking-wide ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`;
  const valueClass = `font-mono text-[12px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`;
  const metaClass = `font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`;

  const next24Hours = useMemo(
    () => (forecast ? selectNext24Hours(forecast.hourly) : []),
    [forecast],
  );

  useEffect(() => {
    if (!location) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync reset for null location is intentional and cheap
      setPlaceName(null);
      return;
    }
    let cancelled = false;
    reverseGeocode(location.lat, location.lon)
      .then((h) => {
        if (!cancelled) setPlaceName(h?.hierarchy ?? h?.displayName ?? location.label);
      })
      .catch(() => {
        if (!cancelled) setPlaceName(location.label);
      });
    return () => {
      cancelled = true;
    };
  }, [location]);

  const handleWeatherSelect = (place: GeocodedPlace) => {
    setCenter([place.lon, place.lat]);
    setZoom(10);
    setWeatherQuery(place.displayName.split(',')[0] ?? '');
  };

  const handleMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.longitude, pos.coords.latitude]);
        setZoom(10);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

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
      xlWide
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="glass flex min-w-0 flex-1 items-center rounded-xl px-2 py-1.5">
            <PlaceAutocomplete
              value={weatherQuery}
              onChange={setWeatherQuery}
              onSelect={handleWeatherSelect}
              placeholder="Search weather location"
              ariaLabel="Search weather location"
            />
          </div>
          <button
            type="button"
            onClick={handleMyLocation}
            title="Center map to my location"
            aria-label="Use my location"
            className={`flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-medium transition hover:bg-white/10 ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}
          >
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">My location</span>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className={metaClass}>{location ? (placeName ?? location.label) : 'Locating…'}</span>
          {stale && <span className={metaClass}>cached</span>}
        </div>

        {loading && !current && (
          <p className={`py-4 text-center font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
            Loading live weather…
          </p>
        )}

        {current && (
          <section aria-label="Current conditions">
            <p className={labelClass}>Now</p>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className={`flex items-center gap-1.5 truncate text-[13px] font-medium ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
                    <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    <span className="truncate">{placeName ?? location?.label ?? '—'}</span>
                  </p>
                  <p className={`mt-1 truncate text-[15px] font-semibold ${isBrightBasemap ? 'text-slate-800' : 'text-slate-100'}`}>
                    {current.temperatureC.toFixed(1)}°C · {describeWeatherCode(current.weatherCode)}
                  </p>
                  <p className={`mt-0.5 ${valueClass}`}>Wind {current.windSpeedKmh.toFixed(0)} km/h · {current.isDay ? 'Day' : 'Night'}</p>
                </div>
                <div className="flex shrink-0 items-center self-center">
                  <WeatherVisual current={current} size={64} />
                </div>
              </div>
            </div>
          </section>
        )}

        {forecast && forecast.hourly.length > 0 && (
          <section aria-label="Next 24 hours">
            <p className={labelClass}>Next 24 hours</p>
            <HourlyStrip hourly={next24Hours} />
          </section>
        )}

        {forecast && forecast.hourly.length > 0 && (
          <section aria-label="7-day outlook">
            <p className={labelClass}>7-day outlook</p>
            <ForecastChart hourly={forecast.hourly} label="7-day temperature and precipitation forecast" />
          </section>
        )}

        <section aria-label="Past weather">
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
            <div className="mt-3">
              <ForecastChart hourly={historical.hourly} label={`Weather on ${historicalDate}`} />
            </div>
          )}
          {historical && historicalDate && historical.hourly.length === 0 && (
            <p className={`mt-2 ${metaClass}`}>No archive data for {historicalDate} at this location yet.</p>
          )}
        </section>

        <div>
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
      </div>
    </FloatingPanel>
  );
}
