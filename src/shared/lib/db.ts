import { openDB, type IDBPDatabase } from 'idb';

// Single IndexedDB database shared by all cache modules. Every store is
// created here so a newer store is never missing when an older database
// version already exists on the device — bumping DB_VERSION runs the
// upgrade once and the contains-guards make it idempotent.
const DB_NAME = 'terravision-atlas';
const DB_VERSION = 2;

export const DISASTER_STORE = 'disaster-events';
export const WEATHER_STORE = 'weather';

export async function getAppDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(DISASTER_STORE)) {
        db.createObjectStore(DISASTER_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(WEATHER_STORE)) {
        db.createObjectStore(WEATHER_STORE, { keyPath: 'id' });
      }
    },
  });
}
