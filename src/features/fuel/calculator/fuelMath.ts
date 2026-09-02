// Fuel calculation engine — isolated for clarity and testability.
// Handles metric/imperial, multiple efficiency units, and carbon estimation.

export type UnitSystem = 'metric' | 'imperial';
export type EfficiencyUnit = 'kml' | 'l100km' | 'mpg';

export interface FuelInput {
  distance: number;
  efficiency: number;
  efficiencyUnit: EfficiencyUnit;
  price: number;
  unitSystem: UnitSystem;
  fuelType?: 'gasoline' | 'diesel' | 'electric';
}

export interface FuelResult {
  fuelNeeded: number; // liters or gallons
  totalCost: number;
  costPerUnit: number;
  carbonKg: number;
  gaugePercent: number;
}

// CO₂ per unit fuel — kg CO₂ per liter (or per gallon equivalent)
// Gasoline: 2.31 kg/L, Diesel: 2.68 kg/L, Electric: 0 (grid-dependent, show 0 for now)
const CARBON_PER_LITER: Record<string, number> = {
  gasoline: 2.31,
  diesel: 2.68,
  electric: 0,
};

export function calculateFuel(input: FuelInput): FuelResult {
  const { distance, efficiency, efficiencyUnit, price, unitSystem, fuelType = 'gasoline' } = input;

  let fuelNeeded: number;
  let kmPerLEquivalent: number;

  if (unitSystem === 'metric') {
    const kmPerL =
      efficiencyUnit === 'kml' ? efficiency : efficiency > 0 ? 100 / efficiency : 0;
    kmPerLEquivalent = kmPerL;
    fuelNeeded = kmPerL > 0 ? distance / kmPerL : 0;
  } else {
    // Imperial: distance in miles, efficiency in MPG, fuel in gallons
    const mpg = efficiency;
    kmPerLEquivalent = mpg * 0.425144; // MPG → km/L
    fuelNeeded = mpg > 0 ? distance / mpg : 0;
  }

  const totalCost = fuelNeeded * price;
  const costPerUnit = distance > 0 ? totalCost / distance : 0;

  // Carbon: convert fuelNeeded (gallons or liters) to liters for CO₂ calc
  // For imperial, fuelNeeded is in gallons → convert to liters (1 gal = 3.78541 L)
  const fuelLiters = unitSystem === 'metric' ? fuelNeeded : fuelNeeded * 3.78541;
  const carbonKg = fuelLiters * (CARBON_PER_LITER[fuelType] ?? 2.31);

  const gaugePercent = Math.max(0, Math.min(100, ((kmPerLEquivalent - 5) / 15) * 100));

  return { fuelNeeded, totalCost, costPerUnit, carbonKg, gaugePercent };
}

export function formatFuel(value: number, unit: 'L' | 'gal'): string {
  return `${value.toFixed(1)} ${unit}`;
}

export function formatCost(value: number, symbol = '₱'): string {
  return `${symbol}${value.toFixed(2)}`;
}

export function formatCarbon(kg: number): string {
  if (kg < 1) return `${(kg * 1000).toFixed(0)} g CO₂`;
  return `${kg.toFixed(1)} kg CO₂`;
}
