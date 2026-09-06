import { getAppDb, DISASTER_STORE } from './db';
import type { DisasterEvent } from '../../../types';

export async function cacheDisasterEvents(events: DisasterEvent[]): Promise<void> {
  const db = await getAppDb();
  const tx = db.transaction(DISASTER_STORE, 'readwrite');
  await Promise.all(events.map((event) => tx.store.put(event)));
  await tx.done;
}

export async function getCachedDisasterEvents(): Promise<DisasterEvent[]> {
  const db = await getAppDb();
  return db.getAll(DISASTER_STORE);
}

export async function clearDisasterCache(): Promise<void> {
  const db = await getAppDb();
  await db.clear(DISASTER_STORE);
}
