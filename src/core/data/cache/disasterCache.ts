import { openDB } from 'idb';
import type { DisasterEvent } from '../../../types';

const DB_NAME = 'terravision-atlas';
const STORE_NAME = 'disaster-events';
const DB_VERSION = 1;

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

export async function cacheDisasterEvents(events: DisasterEvent[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all(events.map((event) => tx.store.put(event)));
  await tx.done;
}

export async function getCachedDisasterEvents(): Promise<DisasterEvent[]> {
  const db = await getDb();
  return db.getAll(STORE_NAME);
}

export async function clearDisasterCache(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE_NAME);
}
