import type { DisasterSeverity } from '../../shared/types';

// Severity meaning shared by every disaster pin surface (2D hazard pins,
// Vector circles, 3D entities): high red, medium amber, low teal. Sizes
// stay per-engine (pixel radii differ between OpenLayers, MapLibre, and
// Cesium) — only the color meaning is shared.
export const DISASTER_SEVERITY_COLORS: Record<DisasterSeverity, string> = {
  high: '#E63946',
  medium: '#FF9F1C',
  low: '#2EC4B6',
};
