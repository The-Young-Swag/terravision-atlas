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

export interface FuelCalculation {
  distance: number;
  fuelNeeded: number;
  totalCost: number;
  costPerUnit: number;
}
