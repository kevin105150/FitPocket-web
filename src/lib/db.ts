import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'fitpocket_db';
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

export async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export async function dbGet<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, key);
}

export async function dbSet<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, value, key);
}

export async function dbDelete(key: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, key);
}

export async function dbClear(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

export async function dbKeys(): Promise<string[]> {
  const db = await getDB();
  return db.getAllKeys(STORE_NAME) as Promise<string[]>;
}
