interface BreakdownBarProps {
  /** Real value as text, e.g. "8.6 L" / "₱557.14". */
  valueText: string;
  /** Real numeric value being represented (for the proportional fill). */
  value: number;
  /** The fixed ceiling this bar is scaled against (e.g. a tank capacity
   * for fuel, a plausible upper trip-cost for cost). Extracted as a
   * named constant in the panel; never auto-derived from the value. */
  ceiling: number;
  /** Glassmorphism color: track + fill. */
  trackClass: string;
  fillClass: string;
  /** Accessible label, e.g. "Fuel needed" / "Total cost". */
  label: string;
}

// Proportional fill for a single fuel or cost indicator. Each indicator is
// fully independent — the fill is value/ceiling, capped at 1, so fuel and
// cost never share a meaningless auto-axis. No chart library, no canvas
// bar, no overlap or clipping.
export function BreakdownBar({ valueText, value, ceiling, trackClass, fillClass, label }: BreakdownBarProps) {
  const ratio = ceiling > 0 ? Math.min(1, Math.max(0, value / ceiling)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-300">{label}</span>
        <span className="font-mono text-[13px] font-semibold text-slate-100">{valueText}</span>
      </div>
      <div
        className={`relative h-1.5 w-full overflow-hidden rounded-full ${trackClass}`}
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(ceiling)}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ${fillClass}`}
          style={{ width: `${(ratio * 100).toFixed(1)}%` }}
        />
      </div>
    </div>
  );
}
