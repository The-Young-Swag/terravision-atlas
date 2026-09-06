import { describe, expect, it } from 'vitest';
import { shelterPopupHtml } from './shelterPopup';
import type { Shelter } from './overpass';

const BASE: Shelter = {
  id: 'node/1',
  lon: 120.5804,
  lat: 15.1457,
  name: "Children's Home",
  matchedTag: 'social_facility=shelter',
};

describe('shelterPopupHtml', () => {
  it('shows the real name, matched tag, coordinates, and OSM id', () => {
    const html = shelterPopupHtml(BASE);
    expect(html).toContain("Children's Home");
    expect(html).toContain('social_facility=shelter');
    expect(html).toContain('15.1457, 120.5804');
    expect(html).toContain('node/1');
  });

  it('falls back to Unnamed shelter without inventing one', () => {
    const html = shelterPopupHtml({ ...BASE, name: null });
    expect(html).toContain('Unnamed shelter');
  });

  it('escapes OSM-sourced text', () => {
    const html = shelterPopupHtml({ ...BASE, name: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
