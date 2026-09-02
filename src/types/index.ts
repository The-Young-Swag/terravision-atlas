export type AppMode = 'explore' | 'monitor' | 'survey';

export type DisasterSeverity = 'low' | 'medium' | 'high';

export type DisasterType =
  | 'earthquake'
  | 'wildfire'
  | 'flood'
  | 'storm'
  | 'volcano'
  | 'landslide'
  | 'weather';

export interface DisasterEvent {
  id: string;
  type: DisasterType;
  severity: DisasterSeverity;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  occurredAt: string;
  source: string;
}

export interface VehicleProfile {
  id: string;
  name: string;
  efficiency: number;
  efficiencyUnit: 'kml' | 'l100km' | 'mpg';
  fuelType: 'gasoline' | 'diesel' | 'electric';
}

export interface FuelCalculation {
  distance: number;
  fuelNeeded: number;
  totalCost: number;
  costPerUnit: number;
  carbonKg: number;
}
