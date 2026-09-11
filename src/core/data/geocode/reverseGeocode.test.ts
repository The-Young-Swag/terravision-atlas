import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCachedHierarchy, reverseGeocode } from './reverseGeocode';

function nominatimResponse(address: Record<string, string>, displayName: string): Response {
  return {
    ok: true,
    json: () => Promise.resolve({ display_name: displayName, address }),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reverseGeocode', () => {
  it('builds a Town · Province · Country hierarchy from a full address', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        nominatimResponse(
          { town: 'Malolos', county: 'Bulacan', state: 'Central Luzon', country: 'Philippines' },
          'Malolos, Bulacan, Central Luzon, Philippines',
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    // Distinct coordinates per test: the module cache persists across tests.
    const result = await reverseGeocode(14.843, 120.811);
    expect(result?.hierarchy).toBe('Malolos · Bulacan · Central Luzon · Philippines');
    expect(getCachedHierarchy(14.843, 120.811)?.hierarchy).toBe(result?.hierarchy);
  });

  it('handles a rural point with no town-level name without blank segments', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        nominatimResponse({ county: 'Coconino County', state: 'Arizona', country: 'United States' }, 'Coconino County, AZ'),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await reverseGeocode(35.199, -111.651);
    expect(result?.hierarchy).toBe('Coconino County · Arizona · United States');
    expect(result?.hierarchy).not.toContain('  ');
  });

  it('coalesces concurrent lookups for the same point into one request', async () => {
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) =>
          setTimeout(() => resolve(nominatimResponse({ city: 'Kyoto', country: 'Japan' }, 'Kyoto, Japan')), 20),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const [first, second, third] = await Promise.all([
      reverseGeocode(35.011, 135.768),
      reverseGeocode(35.011, 135.768),
      reverseGeocode(35.0112, 135.7682),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first?.hierarchy).toBe('Kyoto · Japan');
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('returns null on service failure so callers fall back to coordinates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false } as Response)),
    );
    await expect(reverseGeocode(-33.868, 151.209)).resolves.toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    await expect(reverseGeocode(51.507, -0.127)).resolves.toBeNull();
  });
});
