import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { FLOW_BANDS } from '../../../features/traffic/flowStatus';

// Legend for the TomTom Traffic Flow overlay. This app requests the
// `absolute` tile style, whose colors reflect measured absolute speed —
// band colors and km/h labels come from the shared flowStatus module
// (verbatim from TomTom's Raster Flow Tiles documentation, not guessed).
// The © TomTom line doubles as attribution where the 2D map renders no
// attribution control.

export function TrafficLegend() {
  const isBrightBasemap = useBrightBasemap();
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
      <p className={`mb-1.5 text-[10px] font-medium uppercase tracking-wide ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>
        Traffic flow · absolute speed
      </p>
      <div className="space-y-1">
        {FLOW_BANDS.map((band) => (
          <div key={band.label} className="flex items-center gap-2">
            <span className="h-1.5 w-6 shrink-0 rounded-full" style={{ backgroundColor: band.color }} />
            <span className={`font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-300'}`}>{band.label}</span>
          </div>
        ))}
      </div>
      <p className={`mt-1.5 font-mono text-[10px] ${isBrightBasemap ? 'text-slate-500' : 'text-slate-400'}`}>© TomTom</p>
    </div>
  );
}
