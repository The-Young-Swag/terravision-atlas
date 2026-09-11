import { useState } from 'react';
import { HousePlus, MapPin } from 'lucide-react';
import { FloatingPanel } from '../common/FloatingPanel';
import { useMapStore } from '../../../features/map/store';
import { useShelterStore } from '../../../stores/shelterStore';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { fetchShelters } from '../../../features/shelters/overpass';

// Search half-size in degrees (~5.5 km) around the map center.
const SEARCH_HALF_DEGREES = 0.05;

export function ShelterPanel() {
  const center = useMapStore((s) => s.center);
  const setCenter = useMapStore((s) => s.setCenter);
  const shelters = useShelterStore((s) => s.shelters);
  const setShelters = useShelterStore((s) => s.setShelters);
  const clearShelters = useShelterStore((s) => s.clearShelters);
  const isBrightBasemap = useBrightBasemap();

  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setIsSearching(true);
    setError(null);
    try {
      const found = await fetchShelters({
        minLon: center[0] - SEARCH_HALF_DEGREES,
        minLat: center[1] - SEARCH_HALF_DEGREES,
        maxLon: center[0] + SEARCH_HALF_DEGREES,
        maxLat: center[1] + SEARCH_HALF_DEGREES,
      });
      setShelters(found);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <FloatingPanel
      id="shelters"
      title="Shelter locator"
      icon={<HousePlus className="h-3.5 w-3.5" />}
      initialPosition={{ x: 720, y: 96 }}
      bubbleLabel="Shelter locator"
    >
      <div>
        <p className={`mb-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
          Shelter data is community-sourced from OpenStreetMap — coverage varies by region and is never complete.
        </p>

        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="w-full rounded-xl bg-[#5500a4] py-2 text-[12.5px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {isSearching ? 'Searching OpenStreetMap…' : 'Find shelters near map center'}
        </button>

        {searched && !error && (
          <p className={`mt-2 font-mono text-[11px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
            {shelters.length === 0
              ? 'No mapped shelters in this area — try a city center'
              : `${shelters.length} shelter${shelters.length === 1 ? '' : 's'} found`}
          </p>
        )}

        {shelters.length > 0 && (
          <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {shelters.slice(0, 30).map((shelter) => (
              <button
                key={shelter.id}
                onClick={() => setCenter([shelter.lon, shelter.lat])}
                className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5 text-left transition hover:bg-white/[0.08]"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#00d890]" aria-hidden />
                <span className="min-w-0">
                  <span className={`block truncate text-[12px] font-medium ${isBrightBasemap ? 'text-slate-800' : 'text-slate-200'}`}>
                    {shelter.name ?? 'Unnamed shelter'}
                  </span>
                  <span className={`block truncate font-mono text-[10px] ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}>
                    {shelter.matchedTag} · {shelter.lat.toFixed(4)}, {shelter.lon.toFixed(4)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {shelters.length > 0 && (
          <button
            onClick={() => {
              clearShelters();
              setSearched(false);
            }}
            className={`mt-2 text-[11px] underline ${isBrightBasemap ? 'text-slate-700' : 'text-slate-200'}`}
          >
            Clear shelters
          </button>
        )}

        {error && (
          <p className="mt-2 rounded-lg border border-[#E63946]/30 bg-[#E63946]/10 px-3 py-2 text-[11px] text-[#ff8a8a]">
            Shelter lookup failed: {error}
          </p>
        )}
      </div>
    </FloatingPanel>
  );
}
