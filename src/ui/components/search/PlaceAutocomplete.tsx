import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useMapStore } from '../../../stores/mapStore';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { geocodeNominatim, searchPhoton, type GeocodedPlace, type PlaceSuggestion } from '../../../features/search/geocode';

interface PlaceAutocompleteProps {
  value: string;
  onChange: (text: string) => void;
  onSelect: (place: GeocodedPlace) => void;
  placeholder?: string;
  ariaLabel?: string;
}

type DropdownStatus = 'idle' | 'loading' | 'no-results' | 'unavailable';

/**
 * Shared place autocomplete: Photon suggestions while typing, Nominatim
 * final geocode on select/Enter. Used by the TopBar search and (Item 4) the
 * evacuation Start/Destination fields — one component, one behavior.
 */
export function PlaceAutocomplete({ value, onChange, onSelect, placeholder, ariaLabel }: PlaceAutocompleteProps) {
  const center = useMapStore((s) => s.center);
  const isBrightBasemap = useBrightBasemap();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [status, setStatus] = useState<DropdownStatus>('idle');
  const requestId = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);
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
        setHighlight(results.length > 0 ? 0 : -1);
        setOpen(true);
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
  }, [value, center, searchable]);

  const submitNominatim = async (query: string) => {
    submittedRef.current = query.trim();
    setStatus('loading');
    setOpen(true);
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

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (open && highlight >= 0 && suggestions[highlight]) {
        chooseSuggestion(suggestions[highlight]);
      } else {
        setOpen(false);
        void submitNominatim(value);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
      setSuggestions([]);
      setStatus('idle');
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
          if (suggestions.length > 0) setOpen(true);
        }}
        className={`flex-1 bg-transparent text-[13.5px] focus:outline-none ${isBrightBasemap ? 'text-slate-800 placeholder:text-slate-500' : 'text-slate-200 placeholder:text-slate-400'}`}
        placeholder={placeholder ?? 'Search places'}
        aria-label={ariaLabel ?? 'Search places'}
        role="combobox"
        aria-expanded={open}
        aria-controls="place-autocomplete-list"
        aria-activedescendant={highlight >= 0 ? `place-option-${highlight}` : undefined}
        autoComplete="off"
      />
      {open && searchable && (
        <div className="glass-strong absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl">
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
            <ul id="place-autocomplete-list" role="listbox" className="max-h-56 overflow-y-auto p-1.5">
              {suggestions.map((suggestion, index) => (
                <li key={`${suggestion.lon},${suggestion.lat},${suggestion.label}`} role="option" id={`place-option-${index}`} aria-selected={index === highlight}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      chooseSuggestion(suggestion);
                    }}
                    onMouseEnter={() => setHighlight(index)}
                    className={`flex w-full flex-col rounded-xl px-3 py-2 text-left transition ${index === highlight ? 'bg-[#5500a4]/25' : 'hover:bg-white/5'}`}
                  >
                    <span className={`text-[13px] font-medium ${isBrightBasemap ? 'text-slate-800' : 'text-slate-100'}`}>
                      {suggestion.label}
                    </span>
                    {suggestion.sublabel && (
                      <span className={`font-mono text-[10px] ${isBrightBasemap ? 'text-slate-600' : 'text-slate-400'}`}>
                        {suggestion.sublabel}
                      </span>
                    )}
                  </button>
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
