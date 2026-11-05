// Importar / exportar monstruos y mazos en JSON.
import { normalizeMonster, uid } from './model.js';

export function exportJSON(monsters, decks = []) {
  const ids = new Set(monsters.map(m => m.id));
  const cleanDecks = decks.map(d => ({ ...d, entries: d.entries.filter(e => ids.has(e.id)) }));
  return JSON.stringify({ app: 'bestiarium', version: 3, exportedAt: new Date().toISOString(), monsters, decks: cleanDecks }, null, 1);
}

/** Devuelve { monsters, decks }. Acepta también exportaciones antiguas (solo array de monstruos). */
export function parseImport(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : Array.isArray(data.monsters) ? data.monsters : null;
  if (!list) throw new Error('Formato no reconocido');
  const monsters = list.map(item => normalizeMonster({ ...item, id: item.id || uid() }));
  const decks = Array.isArray(data.decks) ? data.decks.filter(d => d && d.id && d.name && Array.isArray(d.entries)) : [];
  return { monsters, decks };
}

/** Une mazos importados con los existentes (mismo id → se sustituye). */
export function mergeDecks(existing, incoming) {
  const map = new Map(existing.map(d => [d.id, d]));
  incoming.forEach(d => map.set(d.id, d));
  return [...map.values()];
}
