// Fuel calculation engine — isolated for clarity and testability.
// Handles metric/imperial and multiple efficiency units. Carbon estimation removed per spec.

export type UnitSystem = 'metric' | 'imperial';
export type EfficiencyUnit = 'kml' | 'l100km' | 'mpg';

export interface FuelInput {
  distance: number;
  efficiency: number;
  efficiencyUnit: EfficiencyUnit;
  price: number;
  unitSystem: UnitSystem;
}

export interface FuelResult {
  fuelNeeded: number; // liters or gallons
  totalCost: number;
  costPerUnit: number;
  gaugePercent: number;
}

export function calculateFuel(input: FuelInput): FuelResult {
  const { distance, efficiency, efficiencyUnit, price, unitSystem } = input;

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

  const gaugePercent = Math.max(0, Math.min(100, ((kmPerLEquivalent - 5) / 15) * 100));

  return { fuelNeeded, totalCost, costPerUnit, gaugePercent };
}

export function formatFuel(value: number, unit: 'L' | 'gal'): string {
  return `${value.toFixed(1)} ${unit}`;
}

export function formatCost(value: number, symbol = '₱'): string {
  return `${symbol}${value.toFixed(2)}`;
}
