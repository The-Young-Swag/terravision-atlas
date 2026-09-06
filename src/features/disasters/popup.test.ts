import { describe, expect, it } from 'vitest';
import { disasterPopupHtml } from './popup';
import type { DisasterEvent } from '../../types';

const EVENT: DisasterEvent = {
  id: 'usgs-1',
  type: 'earthquake',
  severity: 'high',
  title: 'M 6.1 - Test <b>place</b>',
  description: 'd',
  latitude: 15,
  longitude: 120,
  occurredAt: '2026-09-06T00:00:00Z',
  source: 'USGS',
};

describe('disasterPopupHtml', () => {
  it('shows title, type, severity, and source', () => {
    const html = disasterPopupHtml(EVENT);
    expect(html).toContain('M 6.1 - Test');
    expect(html).toContain('earthquake');
    expect(html).toContain('high');
    expect(html).toContain('USGS');
  });

  it('escapes event text', () => {
    expect(disasterPopupHtml(EVENT)).not.toContain('<b>place</b>');
  });
});
