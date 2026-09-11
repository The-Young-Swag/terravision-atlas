import { useState, useMemo } from 'react';
import { Fuel } from 'lucide-react';
import { FloatingPanel } from '../../../shared/components/FloatingPanel';
import { GlassNumberInput } from './GlassNumberInput';
import { calculateFuel as calcFuel } from '../calculator/fuelMath';
import type { EfficiencyUnit, UnitSystem } from '../calculator/fuelMath';
import { BreakdownBar } from './BreakdownBar';
import { useBrightBasemap } from '../../../shared/hooks/useBrightBasemap';

interface FuelState {
  distance: number;
  efficiency: number;
  efficiencyUnit: EfficiencyUnit;
  price: number;
  unitSystem: UnitSystem;
}

// Item 18 fixed ceilings: the breakdown bars are scaled against these
// named constants, not against the other value and not auto-scaled to
// the value itself. Tank capacity is a typical passenger-vehicle 60 L;
// trip-cost ceiling is a plausible upper ₱5,000. Values are documented
// in the panel so the user knows what a 100% bar means.
const FUEL_CEILING_LITERS = 60;
const TRIP_COST_CEILING_PHP = 5000;

interface FuelPanelProps {
  open: boolean;
  onClose: () => void;
}

export function FuelPanel({ open, onClose }: FuelPanelProps) {
  const [fuelState, setFuelState] = useState<FuelState>({
    distance: 120,
    efficiency: 14,
    efficiencyUnit: 'kml',
    price: 65,
    unitSystem: 'metric',
  });

  const fuelResult = useMemo(
    () =>
      calcFuel({
        distance: fuelState.distance,
        efficiency: fuelState.efficiency,
        efficiencyUnit: fuelState.efficiencyUnit,
        price: fuelState.price,
        unitSystem: fuelState.unitSystem,
      }),
    [fuelState],
  );

  const unitLabels = useMemo(() => {
    if (fuelState.unitSystem === 'metric') {
      return {
        distance: 'Trip distance (km)',
        price: 'Fuel price (₱ per liter)',
        fuelSuffix: 'L',
        distanceSuffix: 'km',
      };
    }
    return {
      distance: 'Trip distance (mi)',
      price: 'Fuel price (₱ per gallon)',
      fuelSuffix: 'gal',
      distanceSuffix: 'mi',
    };
  }, [fuelState.unitSystem]);
  const isBrightBasemap = useBrightBasemap();

  if (!open) return null;

  return (
    <FloatingPanel id="fuel" title="Fuel efficiency calculator" icon={<Fuel className="h-3.5 w-3.5" />} initialPosition={{ x: 350, y: 80 }} onClose={onClose} bubbleLabel="Fuel calculator" className="!w-[380px] md:!w-[440px]">
      <div>
        <div className={`mb-4 flex rounded-xl border border-white/10 bg-white/5 p-1 text-[13px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
          <button onClick={() => setFuelState((s) => ({ ...s, unitSystem: 'metric' }))} className={`flex-1 rounded-lg py-1.5 ${fuelState.unitSystem === 'metric' ? 'bg-[#5500a4] text-white' : ''}`}>
            Metric (km, L)
          </button>
          <button onClick={() => setFuelState((s) => ({ ...s, unitSystem: 'imperial' }))} className={`flex-1 rounded-lg py-1.5 ${fuelState.unitSystem === 'imperial' ? 'bg-[#5500a4] text-white' : ''}`}>
            Imperial (mi, gal)
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={`mb-1 block text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>{unitLabels.distance}</label>
            <GlassNumberInput
              value={fuelState.distance}
              onChange={(v) => setFuelState((s) => ({ ...s, distance: v }))}
              step={1}
              min={0}
              label={unitLabels.distance}
              isBrightBasemap={isBrightBasemap}
            />
          </div>

          <div>
            <label className={`mb-1 block text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>Fuel efficiency</label>
            <div className="flex gap-2">
                <div className="flex-1">
                <GlassNumberInput
                  value={fuelState.efficiency}
                  onChange={(v) => setFuelState((s) => ({ ...s, efficiency: v }))}
                  step={0.1}
                  min={0}
                  label="Fuel efficiency"
                  isBrightBasemap={isBrightBasemap}
                />
              </div>
              <select
                value={fuelState.efficiencyUnit}
                onChange={(e) => setFuelState((s) => ({ ...s, efficiencyUnit: e.target.value as EfficiencyUnit }))}
                className={`w-32 rounded-xl border border-white/10 bg-white/5 px-2.5 text-[13px] outline-none ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}
                disabled={fuelState.unitSystem === 'imperial'}
              >
                {fuelState.unitSystem === 'metric' ? (
                  <>
                    <option value="kml" className="bg-[#0D1B2A] text-slate-200">km/L</option>
                    <option value="l100km" className="bg-[#0D1B2A] text-slate-200">L/100km</option>
                  </>
                ) : (
                  <option value="mpg" className="bg-[#0D1B2A] text-slate-200">MPG (US)</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className={`mb-1 block text-[11px] uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>{unitLabels.price}</label>
            <GlassNumberInput
              value={fuelState.price}
              onChange={(v) => setFuelState((s) => ({ ...s, price: v }))}
              step={0.01}
              min={0}
              label={unitLabels.price}
              isBrightBasemap={isBrightBasemap}
            />
          </div>
        </div>

        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="mb-3">
            <div className={`mb-1.5 flex justify-between text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
              <span>Thirsty</span>
              <span>Average</span>
              <span>Efficient</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-gradient-to-r from-[#E63946] via-[#FF9F1C] to-[#2EC4B6]">
              <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0B0F1A] bg-white shadow" style={{ left: `${fuelResult.gaugePercent}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className={`mb-1 text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>Fuel needed</p>
              <p className={`font-mono text-[16px] font-semibold ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>
                {fuelResult.fuelNeeded.toFixed(1)} {unitLabels.fuelSuffix}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className={`mb-1 text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>Total cost</p>
              <p className="font-mono text-[16px] font-semibold text-[#00d890]">₱{fuelResult.totalCost.toFixed(2)}</p>
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
              <span className={`text-[12px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>Cost per {unitLabels.distanceSuffix}</span>
              <span className={`font-mono text-[13px] ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>₱{fuelResult.costPerUnit.toFixed(2)} / {unitLabels.distanceSuffix}</span>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className={`mb-2 text-[11px] font-medium uppercase tracking-wide ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>Breakdown</p>
            <div className="space-y-3">
              <BreakdownBar
                label="Fuel needed"
                valueText={`${fuelResult.fuelNeeded.toFixed(1)} ${unitLabels.fuelSuffix}`}
                value={fuelResult.fuelNeeded}
                ceiling={FUEL_CEILING_LITERS}
                trackClass="bg-white/10"
                fillClass="bg-[#5500a4]"
              />
              <BreakdownBar
                label="Total cost"
                valueText={`₱${fuelResult.totalCost.toFixed(2)}`}
                value={fuelResult.totalCost}
                ceiling={TRIP_COST_CEILING_PHP}
                trackClass="bg-white/10"
                fillClass="bg-[#00d890]"
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                const csv = `distance,efficiency,price,fuelNeeded,totalCost\n${fuelState.distance},${fuelState.efficiency},${fuelState.price},${fuelResult.fuelNeeded.toFixed(2)},${fuelResult.totalCost.toFixed(2)}`;
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'terravision-fuel.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className={`rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-medium hover:bg-white/10 ${isBrightBasemap ? 'text-slate-700 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
            >
              Export CSV
            </button>
            <button onClick={() => window.print()} className="rounded-xl bg-[#5500a4] px-3 py-2 text-[12px] font-medium text-white hover:brightness-110">
              Print / PDF
            </button>
          </div>
          <p className={`mt-3 text-center font-mono text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>Example: 25 km · 8.5 L/100km · ₱1.60/L → 2.1 L · ₱3.40</p>
        </div>
      </div>
    </FloatingPanel>
  );
}
