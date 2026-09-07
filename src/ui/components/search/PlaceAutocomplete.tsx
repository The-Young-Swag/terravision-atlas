import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigation, Search } from 'lucide-react';
import { useMapStore } from '../../../stores/mapStore';
import { useSurveyStore } from '../../../stores/surveyStore';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { geocodeNominatim, searchPhoton, type GeocodedPlace, type PlaceSuggestion } from '../../../features/search/geocode';
import { endpointLabel, getCurrentPositionOnce, parseRouteQuery, type RouteEndpoint } from '../../../features/search/routeQuery';

interface PlaceAutocompleteProps {
  value: string;
  onChange: (text: string) => void;
  onSelect: (place: GeocodedPlace) => void;
  placeholder?: string;
  ariaLabel?: string;
  /**
   * Main-search route parsing (Item 13): recognizes "A to B" style queries
   * and offers a route suggestion that populates Navigation on explicit
   * accept only. Leave off for Start/Destination fields so they never
   * reinterpret their own input as a route.
   */
  enableRouteParsing?: boolean;
  onRouteResolved?: (start: GeocodedPlace, destination: GeocodedPlace) => void;
}

type DropdownStatus = 'idle' | 'loading' | 'no-results' | 'unavailable';

// Only one autocomplete dropdown may be visible at a time (Start vs.
// Destination vs. global search share this component). Instances announce
// themselves on open; every other instance closes. Window CustomEvent keeps
// the coordination local to this module — no store or context needed.
const AUTOCOMPLETE_OPENED_EVENT = 'place-autocomplete-opened';
let autocompleteInstanceSeq = 0;

/**
 * Shared place autocomplete: Photon suggestions while typing, Nominatim
 * final geocode on select/Enter. Used by the TopBar search and (Item 4) the
 * evacuation Start/Destination fields — one component, one behavior.
 */
export function PlaceAutocomplete({ value, onChange, onSelect, placeholder, ariaLabel, enableRouteParsing = false, onRouteResolved }: PlaceAutocompleteProps) {
  const center = useMapStore((s) => s.center);
  const gpsTracking = useSurveyStore((s) => s.gpsTracking);
  const gpsPosition = useSurveyStore((s) => s.gpsPosition);
  const isBrightBasemap = useBrightBasemap();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [status, setStatus] = useState<DropdownStatus>('idle');
  const [resolving, setResolving] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [acceptedNote, setAcceptedNote] = useState<string | null>(null);
  // Text under which the user dismissed the route row; typing anything new
  // re-arms it. State (not ref) because the value gates render-time output.
  const [dismissedRouteText, setDismissedRouteText] = useState<string | null>(null);
  const requestId = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const instanceId = useRef(++autocompleteInstanceSeq);
  // Query text already submitted to Nominatim: the effect skips it so that
  // selecting a result (which also flies the map, changing center) doesn't
  // pop the dropdown back open with a fresh lookup of the picked place.
  const submittedRef = useRef<string | null>(null);
  // Last text set through user typing or suggestion pick (as opposed to an
  // external value reset, e.g. the parent replacing the field with a pin's
  // short label after geocoding). External resets are adopted as submitted
  // below so later map-center changes never reopen the dropdown over them —
  // the submitted-query guard alone can't cover this because the pin label
  // generally differs from the submitted suggestion text.
  const lastEditedRef = useRef(value);

  const searchable = value.trim().length >= 2;

  // Route intent for the current text (main search only). Pure parse —
  // recognition alone never touches Navigation; only explicit accept does.
  const routeIntent = useMemo(
    () => (enableRouteParsing ? parseRouteQuery(value) : ({ kind: 'not-route' } as const)),
    [enableRouteParsing, value],
  );
  // Dismissed route text: Escape hides the row for this exact text; typing
  // anything new re-arms it. Dismissal never clears search or map state.
  const showRouteRow =
    enableRouteParsing &&
    (routeIntent.kind === 'route' || routeIntent.kind === 'partial' || routeIntent.kind === 'unsupported') &&
    dismissedRouteText !== value;
  // highlight -1 selects the route row (when selectable); >= 0 selects a
  // place suggestion, matching the existing suggestion indexing.
  const routeSelectable = showRouteRow && routeIntent.kind === 'route' && !resolving;
  const gpsCapable = typeof navigator !== 'undefined' && !!navigator.geolocation;

  const openDropdown = () => {
    window.dispatchEvent(new CustomEvent(AUTOCOMPLETE_OPENED_EVENT, { detail: instanceId.current }));
    setOpen(true);
  };

  // Another autocomplete instance opened elsewhere: yield so at most one
  // dropdown renders at a time.
  useEffect(() => {
    const yieldToOther = (event: Event) => {
      if ((event as CustomEvent<number>).detail !== instanceId.current) setOpen(false);
    };
    window.addEventListener(AUTOCOMPLETE_OPENED_EVENT, yieldToOther);
    return () => window.removeEventListener(AUTOCOMPLETE_OPENED_EVENT, yieldToOther);
  }, []);

  // Debounced Photon lookup — 300 ms after the user stops typing. State
  // updates happen only inside the timeout callback or event handlers, and
  // rendering gates on `searchable`, so shrinking the query never needs a
  // synchronous reset inside this effect.
  useEffect(() => {
    if (!searchable) {
      submittedRef.current = null;
      return undefined;
    }
    const query = value.trim();
    // Parent-driven value change (pin select label swap, external clear):
    // adopt it as the submitted text so subsequent center changes never
    // trigger a lookup for it. User typing always flows through onChange,
    // which keeps lastEditedRef in sync, so genuine typing still searches.
    if (value !== lastEditedRef.current) {
      lastEditedRef.current = value;
      submittedRef.current = query;
      return undefined;
    }
    if (submittedRef.current !== null && submittedRef.current === query) return undefined;
    submittedRef.current = null;
    const timer = setTimeout(async () => {
      setStatus('loading');
      const current = ++requestId.current;
      try {
        const results = await searchPhoton(query, center[1], center[0]);
        if (requestId.current !== current) return;
        setSuggestions(results);
        // Route row first when a full route is recognized for this text.
        const intentNow = enableRouteParsing ? parseRouteQuery(value) : null;
        const routeNow = intentNow?.kind === 'route' && dismissedRouteText !== value;
        setHighlight(routeNow ? -1 : results.length > 0 ? 0 : -1);
        openDropdown();
        setStatus(results.length > 0 ? 'idle' : 'no-results');
      } catch {
        // Photon failure is silent here: Enter falls through to Nominatim.
        if (requestId.current !== current) return;
        setSuggestions([]);
        setOpen(false);
        setStatus('idle');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value, center, searchable, enableRouteParsing, dismissedRouteText]);

  const submitNominatim = async (query: string) => {
    submittedRef.current = query.trim();
    setStatus('loading');
    openDropdown();
    try {
      const place = await geocodeNominatim(query);
      if (!place) {
        setSuggestions([]);
        setStatus('no-results');
        return;
      }
      setOpen(false);
      setStatus('idle');
      onSelect(place);
    } catch {
      setSuggestions([]);
      setStatus('unavailable');
    }
  };

  // Dismiss the dropdown on outside pointer-down (selection uses
  // onMouseDown, which fires before this, so picks still register).
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open ]);

  const chooseSuggestion = (suggestion: PlaceSuggestion) => {
    onChange(suggestion.label);
    setSuggestions([]);
    setOpen(false);
    setStatus('idle');
    void submitNominatim(suggestion.label);
  };

  // Resolve one route endpoint through real services only: 'here' via the
  // live survey GPS fix when tracking, else a one-shot device request;
  // places via Nominatim. Throws a human-readable per-end error — the
  // caller then writes nothing, so Navigation is never half-populated.
  const resolveEndpoint = async (endpoint: RouteEndpoint, role: 'Start' | 'Destination'): Promise<GeocodedPlace> => {
    if (endpoint.kind === 'here') {
      if (gpsTracking && gpsPosition) {
        return { lon: gpsPosition[0], lat: gpsPosition[1], displayName: 'My location' };
      }
      const fix = await getCurrentPositionOnce();
      return { lon: fix.lon, lat: fix.lat, displayName: 'My location' };
    }
    const place = await geocodeNominatim(endpoint.text);
    if (!place) throw new Error(`${role} "${endpoint.text}" found nothing — pick it in Navigation instead.`);
    return place;
  };

  const finishRouteAccept = (start: GeocodedPlace, destination: GeocodedPlace, inputLabel: string) => {
    // Adopt the accepted text as submitted so neither Photon nor the route
    // row re-fires for it; dismissal here only affects this text.
    onChange(inputLabel);
    submittedRef.current = inputLabel.trim();
    setDismissedRouteText(inputLabel);
    setSuggestions([]);
    setOpen(false);
    setStatus('idle');
    setRouteError(null);
    setAcceptedNote('Route loaded into Navigation');
    window.setTimeout(() => setAcceptedNote(null), 4000);
    onRouteResolved?.(start, destination);
  };

  const acceptRouteIntent = async () => {
    if (routeIntent.kind !== 'route' || resolving) return;
    setResolving(true);
    setRouteError(null);
    try {
      const start = await resolveEndpoint(routeIntent.origin, 'Start');
      const destination = await resolveEndpoint(routeIntent.destination, 'Destination');
      finishRouteAccept(start, destination, `${endpointLabel(routeIntent.origin)} → ${endpointLabel(routeIntent.destination)}`);
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : String(err));
    } finally {
      setResolving(false);
    }
  };

  // "Navigate here" on a normal place result: real GPS as Start, the
  // selected place as Destination — without reinterpreting the search.
  const navigateToSuggestion = async (suggestion: PlaceSuggestion) => {
    if (resolving) return;
    setResolving(true);
    setRouteError(null);
    try {
      const start = await resolveEndpoint({ kind: 'here' }, 'Start');
      const destination: GeocodedPlace = {
        lon: suggestion.lon,
        lat: suggestion.lat,
        displayName: suggestion.sublabel ? `${suggestion.label}, ${suggestion.sublabel}` : suggestion.label,
      };
      finishRouteAccept(start, destination, suggestion.label);
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : String(err));
    } finally {
      setResolving(false);
    }
  };

  const cycleHighlight = (direction: 1 | -1) => {
    setHighlight((h) => {
      if (suggestions.length === 0) return routeSelectable ? -1 : -1;
      const min = routeSelectable ? -1 : 0;
      let next = h + direction;
      if (next > suggestions.length - 1) next = min;
      if (next < min) next = suggestions.length - 1;
      return next;
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' && (suggestions.length > 0 || routeSelectable)) {
      event.preventDefault();
      openDropdown();
      cycleHighlight(1);
    } else if (event.key === 'ArrowUp' && (suggestions.length > 0 || routeSelectable)) {
      event.preventDefault();
      openDropdown();
      cycleHighlight(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (open && highlight === -1 && routeSelectable) {
        void acceptRouteIntent();
      } else if (open && highlight >= 0 && suggestions[highlight]) {
        chooseSuggestion(suggestions[highlight]);
      } else if (routeSelectable) {
        void acceptRouteIntent();
      } else {
        setOpen(false);
        void submitNominatim(value);
      }
    } else if (event.key === 'Escape') {
      // Dismiss the route row for this text only — search text, marker,
      // and map state are untouched.
      setDismissedRouteText(value);
      setOpen(false);
      setSuggestions([]);
      setStatus('idle');
      setRouteError(null);
    }
  };

  return (
    <div ref={boxRef} className="relative flex flex-1 items-center gap-2.5">
      <Search className={`h-4 w-4 shrink-0 ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`} aria-hidden />
      <input
        value={value}
        onChange={(e) => {
          lastEditedRef.current = e.target.value;
          onChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) openDropdown();
        }}
        className={`flex-1 bg-transparent text-[13.5px] focus:outline-none ${isBrightBasemap ? 'text-slate-800 placeholder:text-slate-500' : 'text-slate-200 placeholder:text-slate-400'}`}
        placeholder={placeholder ?? 'Search places'}
        aria-label={ariaLabel ?? 'Search places'}
        role="combobox"
        aria-expanded={open}
        aria-controls="place-autocomplete-list"
        aria-activedescendant={highlight === -1 && routeSelectable ? 'place-option-route' : highlight >= 0 ? `place-option-${highlight}` : undefined}
        autoComplete="off"
      />
      {acceptedNote && !open && (
        <p className={`absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-[#00d890]/30 bg-[#0D1B2A]/95 px-3 py-2 text-[12px] text-[#00d890]`} role="status">
          {acceptedNote}
        </p>
      )}
      {open && searchable && (
        <div
          className={`absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border shadow-xl ${
            isBrightBasemap ? 'border-slate-900/10 bg-[#f1f5f9]' : 'border-white/10 bg-[#0D1B2A]'
          }`}
        >
          {showRouteRow && routeIntent.kind === 'route' && (
            <div className={`border-b border-white/10 p-1.5`}>
              <button
                type="button"
                id="place-option-route"
                role="option"
                aria-selected={highlight === -1}
                disabled={resolving}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void acceptRouteIntent();
                }}
                onMouseEnter={() => setHighlight(-1)}
                className={`flex w-full items-center gap-2.5 rounded-xl border border-[#209dd7]/40 bg-[#209dd7]/10 px-3 py-2 text-left transition ${highlight === -1 ? 'bg-[#209dd7]/25' : 'hover:bg-[#209dd7]/20'} disabled:opacity-70`}
              >
                <Navigation className="h-4 w-4 shrink-0 text-[#209dd7]" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={`block font-mono text-[10px] font-semibold tracking-widest ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
                    ROUTE{resolving ? ' — RESOLVING…' : ''}
                  </span>
                  <span className={`block truncate text-[13px] font-medium ${isBrightBasemap ? 'text-slate-800' : 'text-slate-100'}`}>
                    {endpointLabel(routeIntent.origin)} → {endpointLabel(routeIntent.destination)}
                  </span>
                  <span className={`block text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
                    {resolving ? 'Looking up both ends…' : 'Load into Navigation'}
                  </span>
                </span>
              </button>
            </div>
          )}
          {showRouteRow && routeIntent.kind === 'partial' && (
            <p className={`border-b border-white/10 px-4 py-2.5 text-[12px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
              {routeIntent.originText ? (
                <>Route? Add a destination — “{routeIntent.originText} to …”</>
              ) : (
                <>Type a route like “Manila to Tarlac”</>
              )}
            </p>
          )}
          {showRouteRow && routeIntent.kind === 'unsupported' && (
            <p className={`border-b border-white/10 px-4 py-2.5 text-[12px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
              {routeIntent.reason}
            </p>
          )}
          {routeError && (
            <p className="border-b border-[#E63946]/30 bg-[#E63946]/10 px-4 py-2 text-[12px] text-[#ff8a8a]" role="alert">
              {routeError}
            </p>
          )}
          {status === 'loading' && (
            <p className={`px-4 py-3 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>Searching…</p>
          )}
          {status === 'no-results' && (
            <p className={`px-4 py-3 text-[12px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-300'}`}>
              No results found for “{value.trim()}”
            </p>
          )}
          {status === 'unavailable' && (
            <p className={`px-4 py-3 text-[12px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-300'}`}>
              Search unavailable — check connection
            </p>
          )}
          {status === 'idle' && suggestions.length > 0 && (
            <ul id="place-autocomplete-list" role="listbox" className="custom-scrollbar max-h-56 overflow-y-auto p-1.5">
              {suggestions.map((suggestion, index) => (
                <li key={`${suggestion.lon},${suggestion.lat},${suggestion.label}`} role="option" id={`place-option-${index}`} aria-selected={index === highlight}>
                  <div className={`flex items-center gap-1 rounded-xl transition ${index === highlight ? 'bg-[#5500a4]/25' : 'hover:bg-white/5'}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        chooseSuggestion(suggestion);
                      }}
                      onMouseEnter={() => setHighlight(index)}
                      className="flex min-w-0 flex-1 flex-col rounded-xl px-3 py-2 text-left"
                    >
                      <span className={`truncate text-[13px] font-medium ${isBrightBasemap ? 'text-slate-800' : 'text-slate-100'}`}>
                        {suggestion.label}
                      </span>
                      {suggestion.sublabel && (
                        <span className={`truncate font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
                          {suggestion.sublabel}
                        </span>
                      )}
                    </button>
                    {enableRouteParsing && gpsCapable && (
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          void navigateToSuggestion(suggestion);
                        }}
                        title="Navigate here from my location"
                        aria-label={`Navigate to ${suggestion.label} from my location`}
                        className={`mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-white/10 ${isBrightBasemap ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
                      >
                        <Navigation className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className={`border-t border-white/10 px-4 py-1.5 font-mono text-[10px] ${isBrightBasemap ? 'text-slate-500' : 'text-slate-400'}`}>
            Results © OpenStreetMap contributors
          </p>
        </div>
      )}
    </div>
  );
}
