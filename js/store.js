// Persistencia local en IndexedDB (aguanta imágenes grandes, a diferencia de localStorage).
import { normalizeMonster as normalizeCard } from './model.js';

const DB_NAME = 'grimorio-osr';
const DB_VERSION = 1;
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then(r => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllCards() {
  const cards = await tx('cards', 'readonly', s => reqP(s.getAll()));
  return (cards || []).map(normalizeCard).sort((a, b) => (a.deck || '').localeCompare(b.deck || '') || a.name.localeCompare(b.name));
}

export async function getCard(id) {
  const c = await tx('cards', 'readonly', s => reqP(s.get(id)));
  return c ? normalizeCard(c) : null;
}

export function putCard(card) {
  card.updatedAt = Date.now();
  return tx('cards', 'readwrite', s => reqP(s.put(card)));
}

export function putCards(cards) {
  return tx('cards', 'readwrite', s => Promise.all(cards.map(c => reqP(s.put(c)))));
}

export function deleteCard(id) {
  return tx('cards', 'readwrite', s => reqP(s.delete(id)));
}

export async function getMeta(key, fallback = null) {
  const r = await tx('meta', 'readonly', s => reqP(s.get(key)));
  return r ? r.value : fallback;
}

export function setMeta(key, value) {
  return tx('meta', 'readwrite', s => reqP(s.put({ key, value })));
}

/** Pide al navegador que no borre los datos si falta espacio (importante en iOS). */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const already = await navigator.storage.persisted();
      return already || await navigator.storage.persist();
    }
  } catch { /* sin soporte */ }
  return false;
}
