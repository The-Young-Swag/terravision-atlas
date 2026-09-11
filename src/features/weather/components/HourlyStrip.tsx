import { useBrightBasemap } from '../../../shared/hooks/useBrightBasemap';
import { formatHourLabel, groupHourlyByDay, type HourlyPoint } from '../openMeteo';

interface HourlyStripProps {
  hourly: HourlyPoint[];
}

// Next-24-hours strip: one compact card per hour (time-of-day label,
// temperature, precipitation), horizontally scrollable, grouped under
// Today / Tomorrow day dividers when the window crosses midnight. Null
// values render as an em-dash — never interpolated or hidden.
export function HourlyStrip({ hourly }: HourlyStripProps) {
  const isBrightBasemap = useBrightBasemap();
  const groups = groupHourlyByDay(hourly);

  if (hourly.length === 0) {
    return (
      <p className={`py-3 text-center font-mono text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
        No hourly data for the next 24 hours yet.
      </p>
    );
  }

  return (
    <div
      className="custom-scrollbar flex items-stretch gap-2 overflow-x-auto pb-1"
      role="list"
      aria-label="Hourly forecast for the next 24 hours"
    >
      {groups.map((group) => (
        <div key={group.key} className="flex shrink-0 items-stretch gap-2" role="group" aria-label={group.sublabel ? `${group.label}, ${group.sublabel}` : group.label}>
          <div
            aria-hidden="true"
            className="flex w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-white/15 px-1 py-2"
          >
            <span className={`text-[11px] font-semibold ${isBrightBasemap ? 'text-slate-800' : 'text-slate-100'}`}>
              {group.label}
            </span>
            {group.sublabel && (
              <span className={`font-mono text-[9px] ${isBrightBasemap ? 'text-slate-500' : 'text-slate-400'}`}>
                {group.sublabel}
              </span>
            )}
          </div>
          {group.points.map((point) => {
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
      ))}
    </div>
  );
}
