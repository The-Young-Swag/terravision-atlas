import type { EfficiencyUnit } from '../calculator/fuelMath';

export interface VehicleProfile {
  id: string;
  name: string;
  icon: 'car' | 'suv' | 'motorcycle' | 'truck';
  efficiency: number;
  efficiencyUnit: EfficiencyUnit;
  fuelType: 'gasoline' | 'diesel' | 'electric';
  description: string;
}

// Predefined profiles — users can select and then tweak values.
// Efficiencies are realistic averages for PH context.
export const VEHICLE_PROFILES: VehicleProfile[] = [
  {
    id: 'car',
    name: 'Car',
    icon: 'car',
    efficiency: 14,
    efficiencyUnit: 'kml',
    fuelType: 'gasoline',
    description: 'Sedan · 1.5L',
  },
  {
    id: 'suv',
    name: 'SUV',
    icon: 'suv',
    efficiency: 9,
    efficiencyUnit: 'kml',
    fuelType: 'gasoline',
    description: 'Mid-size · 2.0L',
  },
  {
    id: 'motorcycle',
    name: 'Motorcycle',
    icon: 'motorcycle',
    efficiency: 35,
    efficiencyUnit: 'kml',
    fuelType: 'gasoline',
    description: '150cc · Efficient',
  },
  {
    id: 'truck',
    name: 'Truck',
    icon: 'truck',
    efficiency: 6,
    efficiencyUnit: 'kml',
    fuelType: 'diesel',
    description: 'Pickup · 2.5L Diesel',
  },
];

export function getProfileById(id: string): VehicleProfile | undefined {
  return VEHICLE_PROFILES.find((p) => p.id === id);
}
