type BackgroundImageRecord = {
  key: "backgroundImage";
  blob: Blob;
  name: string;
  type: string;
  updatedAt: number;
};

const DB_NAME = "home-settings";
const STORE_NAME = "kv";
const KEY: BackgroundImageRecord["key"] = "backgroundImage";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("Failed to open IndexedDB"));
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export async function loadBackgroundImage(): Promise<BackgroundImageRecord | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const record = await requestToPromise(store.get(KEY));
    return (record as BackgroundImageRecord | undefined) ?? null;
  } finally {
    db.close();
  }
}

export async function saveBackgroundImage(file: File): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const record: BackgroundImageRecord = {
      key: KEY,
      blob: file,
      name: file.name || "background",
      type: file.type || "application/octet-stream",
      updatedAt: Date.now(),
    };
    await requestToPromise(store.put(record));
  } finally {
    db.close();
  }
}

export async function clearBackgroundImage(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await requestToPromise(store.delete(KEY));
  } finally {
    db.close();
  }
}
