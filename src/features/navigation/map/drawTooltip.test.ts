import { describe, expect, it } from 'vitest';
import { AVOID_DRAW_TOOLTIP_CSS, avoidDrawTooltipText } from './drawTooltip';

describe('avoidDrawTooltipText', () => {
  it('labels the live radius, flagging the cap', () => {
    expect(avoidDrawTooltipText({ lon: 0, lat: 0, radiusKm: 1.234 }, false)).toBe('1.2 km — release to set');
    expect(avoidDrawTooltipText({ lon: 0, lat: 0, radiusKm: 1.5 }, true)).toBe('1.5 km (max) — release to set');
  });

  it('keeps the shared chrome a single positioned overlay', () => {
    expect(AVOID_DRAW_TOOLTIP_CSS).toContain('position:absolute');
    expect(AVOID_DRAW_TOOLTIP_CSS).toContain('pointer-events:none');
  });
});
