import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { formatHourLabel, type HourlyPoint } from '../openMeteo';

interface HourlyStripProps {
  hourly: HourlyPoint[];
}

// Next-24-hours strip: one compact card per hour (time-of-day label,
// temperature, precipitation), horizontally scrollable. Null values
// render as an em-dash — never interpolated or hidden.
export function HourlyStrip({ hourly }: HourlyStripProps) {
  const isBrightBasemap = useBrightBasemap();

  if (hourly.length === 0) {
    return (
      <p className={`py-3 text-center font-mono text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
        No hourly data for the next 24 hours yet.
      </p>
    );
  }

  return (
    <div
      className="custom-scrollbar flex gap-2 overflow-x-auto pb-1"
      role="list"
      aria-label="Hourly forecast for the next 24 hours"
    >
      {hourly.map((point) => {
        const hasRain = point.precipitationMm !== null && point.precipitationMm > 0;
        return (
          <div
            key={point.time}
            role="listitem"
            className="flex w-[64px] shrink-0 flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2"
          >
            <span className={`font-mono text-[10px] font-medium ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
              {formatHourLabel(new Date(point.time))}
            </span>
            <span className={`font-mono text-[13px] font-semibold ${isBrightBasemap ? 'text-slate-800' : 'text-slate-100'}`}>
              {point.temperatureC === null ? '—' : `${point.temperatureC.toFixed(0)}°`}
            </span>
            <span className={`flex items-center gap-1 font-mono text-[10px] ${hasRain ? 'text-[#38bdf8]' : isBrightBasemap ? 'text-slate-500' : 'text-slate-500'}`}>
              {hasRain && <span className="h-1 w-1 rounded-full bg-[#38bdf8]" aria-hidden />}
              {point.precipitationMm === null ? '—' : `${point.precipitationMm.toFixed(1)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
