// Natural route-query parsing for the main "Search places" input (Item 13).
// Recognizes a small closed set of route forms — never a general NLP parser:
//   "Manila to Tarlac", "From Manila to Tarlac", "Manila → Tarlac",
//   "Manila -> Tarlac", "Manila - Tarlac" (spaced hyphen only, so
//   hyphenated place names never split), "Here to Tarlac",
//   "Tarlac to here", "Tarlac to my location".
// Anything with waypoints ("A to B to C", "A via B") is explicitly
// unsupported, never silently trimmed to two points.

export const HERE_SYNONYMS = ['here', 'my location', 'current location'] as const;

export type RouteEndpoint = { kind: 'place'; text: string } | { kind: 'here' };

export type RouteQuery =
  | { kind: 'route'; origin: RouteEndpoint; destination: RouteEndpoint }
  | { kind: 'partial'; originText: string | null }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'not-route' };

const ARROW_SEPARATORS = ['→', '->', '—'] as const;

function endpointOf(text: string): RouteEndpoint {
  const normalized = text.trim().toLowerCase();
  if ((HERE_SYNONYMS as readonly string[]).includes(normalized)) return { kind: 'here' };
  return { kind: 'place', text: text.trim() };
}

function isEmpty(text: string): boolean {
  return text.trim().length === 0;
}

/**
 * Parse raw search input into a route intent. Pure — no geocoding, no GPS.
 * Returns 'not-route' for ordinary place searches so normal behavior is
 * untouched, 'partial' while the user is still typing, and 'unsupported'
 * for multi-stop forms with an explicit reason for the UI.
 */
export function parseRouteQuery(input: string): RouteQuery {
  const text = input.trim();
  if (text.length < 2) return { kind: 'not-route' };
  const lower = text.toLowerCase();

  // Waypoints are not supported — say so instead of guessing or trimming.
  if (/\bvia\b/i.test(text)) {
    return { kind: 'unsupported', reason: 'Routes with via-stops are not supported — search point-to-point instead.' };
  }

  // Arrow / spaced-hyphen forms: "A → B", "A -> B", "A — B", "A - B".
  for (const separator of ARROW_SEPARATORS) {
    const index = lower.indexOf(separator);
    if (index >= 0) {
      const before = text.slice(0, index);
      const after = text.slice(index + separator.length);
      if (isEmpty(before) || isEmpty(after)) return { kind: 'partial', originText: isEmpty(before) ? null : before.trim() };
      if (countRouteWords(after) > 1) {
        return { kind: 'unsupported', reason: 'Routes with more than two stops are not supported.' };
      }
      return { kind: 'route', origin: endpointOf(before), destination: endpointOf(after) };
    }
  }
  const spacedHyphen = text.match(/^(.+?)\s+-\s+(.+)$/);
  if (spacedHyphen) {
    const [, before, after] = spacedHyphen;
    if (isEmpty(before) || isEmpty(after)) return { kind: 'partial', originText: isEmpty(before) ? null : before.trim() };
    return { kind: 'route', origin: endpointOf(before), destination: endpointOf(after) };
  }

  // "to" forms: optional leading "from", exactly one " to " separator.
  const withoutFrom = lower.startsWith('from ') ? text.slice(5) : text;
  const parts = withoutFrom.split(/\s+to\s+/i);
  if (parts.length === 1) {
    // Trailing "to" while typing: "Manila to", "Here to".
    if (/\s+to\s*$/i.test(withoutFrom)) {
      const originText = withoutFrom.replace(/\s+to\s*$/i, '').trim();
      return { kind: 'partial', originText: originText.length > 0 ? originText : null };
    }
    return { kind: 'not-route' };
  }
  if (parts.length > 2) {
    return { kind: 'unsupported', reason: 'Routes with more than two stops are not supported.' };
  }
  const [before, after] = parts;
  if (isEmpty(before) || isEmpty(after)) {
    return { kind: 'partial', originText: isEmpty(before) ? null : before.trim() };
  }
  return { kind: 'route', origin: endpointOf(before), destination: endpointOf(after) };
}

/** Counts further " to " separators inside the destination half. */
function countRouteWords(text: string): number {
  return text.split(/\s+to\s+/i).length;
}

/** One-shot device fix via the browser Geolocation API (same permission as
 * the survey live-GPS flow — no competing permission path). Rejects with a
 * human-readable reason; callers fall back to normal search/navigation and
 * never fabricate an origin. */
export function getCurrentPositionOnce(timeoutMs = 10000): Promise<{ lon: number; lat: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is unavailable on this device — type a start place instead.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lon: position.coords.longitude,
          lat: position.coords.latitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Location permission denied — type a start place instead.'));
        } else if (error.code === error.TIMEOUT) {
          reject(new Error('Location request timed out — type a start place instead.'));
        } else {
          reject(new Error('Current location unavailable — type a start place instead.'));
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}

/** Display text for an endpoint in the suggestion row. */
export function endpointLabel(endpoint: RouteEndpoint): string {
  return endpoint.kind === 'here' ? 'My location (GPS)' : endpoint.text;
}
