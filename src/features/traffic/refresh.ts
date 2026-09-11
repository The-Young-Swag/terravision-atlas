import { useTrafficStore } from './store';
import { fetchTrafficIncidents, tomtomApiKey, type TrafficBBox } from './tomtom';

// Single entry point for (re)loading traffic state: incidents for a bounding
// box plus the ok/unavailable status that gates the flow-tile layers.
// Any failure means "traffic data unavailable" — the required fallback text
// lives in the Layers panel, driven by this status.
export async function refreshTraffic(bbox: TrafficBBox): Promise<void> {
  const store = useTrafficStore.getState();
  if (!tomtomApiKey()) {
    store.setStatus('no-key');
    return;
  }
  store.setStatus('loading');
  try {
    const incidents = await fetchTrafficIncidents(bbox);
    useTrafficStore.getState().setIncidents(incidents);
    useTrafficStore.getState().setStatus('ok');
  } catch {
    useTrafficStore.getState().setStatus('unavailable');
  }
}
