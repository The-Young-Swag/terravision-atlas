import { ChevronUp, ChevronDown } from 'lucide-react';
import { useBrightBasemap } from '../../../shared/hooks/useBrightBasemap';

interface GlassNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label: string;
  isBrightBasemap?: boolean;
  className?: string;
}

// Numeric input with a custom glassmorphism spinner (increment/decrement
// buttons). Replaces the native browser spinner controls which render as
// a flat, boxy default style that clashes with the app's glass aesthetic.
// The native input itself remains functional (keyboard arrow keys, typing,
// number semantics) — only the spinner arrows are replaced.
export function GlassNumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  label,
  isBrightBasemap: isBrightProp,
  className = '',
}: GlassNumberInputProps) {
  // If isBrightBasemap wasn't passed, read it from the hook so this works
  // standalone. Components that already have it (e.g. FuelPanel) pass it
  // through to avoid an extra hook call.
  const hookBright = useBrightBasemap();
  const isBright = isBrightProp ?? hookBright;

  const clamp = (v: number) => {
    let next = v;
    if (min !== undefined && next < min) next = min;
    if (max !== undefined && next > max) next = max;
    return next;
  };

  const increment = () => onChange(clamp(value + step));
  const decrement = () => onChange(clamp(value - step));

  return (
    <div
      className={`relative flex items-stretch overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm ${className}`}
    >
      <input
        type="number"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
        step={step}
        min={min}
        max={max}
        // Hide native browser spinner controls — the custom glassmorphism
        // spinner buttons on the right replace them.
        className={`w-full bg-transparent px-3 py-2.5 font-mono text-[14px] outline-none [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${isBright ? 'text-slate-800' : 'text-slate-200'}`}
      />
      {/* Stepper column: glassmorphism treatment matching the app's
          glass surfaces (translucent fill + blur + hairline border),
          instead of the flat native browser spinner. Behavior is
          unchanged: native input keeps keyboard/typing semantics. */}
      <div className="flex flex-col rounded-r-xl border-l border-white/10 bg-white/10 backdrop-blur-md">
        <button
          type="button"
          aria-label={`Increment ${label}`}
          title={`Increment ${label}`}
          onClick={increment}
          className={`flex h-1/2 w-8 items-center justify-center transition-colors hover:bg-white/15 active:bg-white/20 ${isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
        >
          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Decrement ${label}`}
          title={`Decrement ${label}`}
          onClick={decrement}
          className={`flex h-1/2 w-8 items-center justify-center border-t border-white/10 transition-colors hover:bg-white/15 active:bg-white/20 ${isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
