// Mazos: listas de monstruos con número de copias. Un monstruo puede estar en varios mazos.
// Se guardan en meta('decks') como [{ id, name, entries: [{ id: monsterId, count }], createdAt }].
import { getMeta, setMeta, getAllCards } from './store.js';
import { uid } from './model.js';

export async function getDecks() {
  const decks = (await getMeta('decks', null)) || [];
  return decks.sort((a, b) => a.name.localeCompare(b.name));
}

export function saveDecks(decks) {
  return setMeta('decks', decks);
}

export function newDeck(name) {
  return { id: uid(), name: name.trim() || 'Mazo sin nombre', entries: [], createdAt: Date.now() };
}

/** Primera ejecución con mazos: crea uno por cada valor antiguo del campo `deck` de los monstruos. */
export async function migrateDecks() {
  if (await getMeta('decks', null)) return;
  const byName = new Map();
  for (const m of await getAllCards()) {
    const name = (m.deck || '').trim();
    if (!name || name === 'General') continue;
    if (!byName.has(name)) byName.set(name, newDeck(name));
    byName.get(name).entries.push({ id: m.id, count: 1 });
  }
  await saveDecks([...byName.values()]);
}

export function countIn(deck, monsterId) {
  return deck.entries.find(e => e.id === monsterId)?.count || 0;
}

export function setCount(deck, monsterId, count) {
  const n = Math.max(0, Math.min(99, Math.round(count) || 0));
  const e = deck.entries.find(x => x.id === monsterId);
  if (!n) deck.entries = deck.entries.filter(x => x.id !== monsterId);
  else if (e) e.count = n;
  else deck.entries.push({ id: monsterId, count: n });
}

export function totalCards(deck) {
  return deck.entries.reduce((s, e) => s + e.count, 0);
}

/** Quita monstruos borrados de todos los mazos. */
export async function purgeMonsters(ids) {
  const set = new Set(ids);
  const decks = await getDecks();
  decks.forEach(d => { d.entries = d.entries.filter(e => !set.has(e.id)); });
  await saveDecks(decks);
}
