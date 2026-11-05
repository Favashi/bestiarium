import { getAllCards, putCard, putCards, deleteCard } from '../store.js';
import { CARD, newMonster, uid } from '../model.js';
import { renderFront } from '../render.js';
import { fitWhenReady } from '../fit.js';
import { exportJSON } from '../io.js';
import { getDecks, saveDecks, newDeck, countIn, setCount, totalCards, purgeMonsters } from '../decks.js';
import { h, scaled, watchScale, toast, download, dialog, askText, confirmDialog, slug } from '../ui.js';
import { state } from '../state.js';
import { track } from '../analytics.js';

export async function libraryView(root) {
  let cards = await getAllCards();
  let decks = await getDecks();
  let selecting = state.selection.size > 0;
  const currentDeck = () => decks.find(d => d.id === state.deckFilter) || null;
  if (state.deckFilter && !currentDeck()) state.deckFilter = '';

  const reload = async () => { cards = await getAllCards(); decks = await getDecks(); render(); };
  const persistDecks = async () => { await saveDecks(decks); render(); };

  // ---------- barra superior ----------
  const search = h('input', { class: 'input grow', type: 'search', placeholder: 'Buscar monstruo…', value: state.search,
    oninput: () => { state.search = search.value; renderGrid(); } });
  const selBtn = h('button', { class: 'btn', onclick: () => { selecting = !selecting; if (!selecting) state.selection.clear(); render(); } });
  const newBtn = h('button', { class: 'btn primary', onclick: async () => {
    const m = newMonster();
    await putCard(m);
    track('nuevo-monstruo', 'Nuevo monstruo');
    const deck = currentDeck();
    if (deck) { setCount(deck, m.id, 1); await saveDecks(decks); }
    location.hash = `#/edit/${m.id}`;
  } }, '+ Nuevo monstruo');

  const tabs = h('nav', { class: 'deck-tabs', 'aria-label': 'Mazos' });
  const deckHead = h('div');
  const content = h('div');
  root.append(h('div', { class: 'toolbar' }, search, selBtn, newBtn), tabs, deckHead, content);

  // ---------- pestañas de mazos ----------
  function renderTabs() {
    const tab = (id, label, count, deck = null) => h('div', { class: `deck-tab${state.deckFilter === id ? ' on' : ''}` },
      h('button', { type: 'button', class: 'deck-tab-main',
        onclick: () => { state.deckFilter = id; state.selection.clear(); selecting = false; render(); } },
        h('span', {}, label), h('small', {}, String(count))),
      deck ? h('button', { type: 'button', class: 'deck-tab-x', title: `Eliminar el mazo ${deck.name}`, 'aria-label': `Eliminar el mazo ${deck.name}`,
        onclick: () => deleteDeck(deck) }, '✕') : null);
    tabs.replaceChildren(
      tab('', 'Todos', cards.length),
      ...decks.map(d => tab(d.id, d.name, totalCards(d), d)),
      h('button', { type: 'button', class: 'deck-tab add', onclick: createDeck }, '+ Nuevo mazo'));
  }

  async function createDeck() {
    const name = await askText('Nuevo mazo', 'Nombre del mazo o aventura', '', 'Crear');
    if (!name) return null;
    const d = newDeck(name);
    decks.push(d);
    await saveDecks(decks);
    track('nuevo-mazo', 'Nuevo mazo');
    state.deckFilter = d.id;
    render();
    toast(`Mazo «${d.name}» creado`);
    return d;
  }

  function renderDeckHead() {
    const deck = currentDeck();
    if (!deck) { deckHead.replaceChildren(); return; }
    deckHead.replaceChildren(h('section', { class: 'deck-head' },
      h('div', {},
        h('h2', {}, deck.name),
        h('p', { class: 'muted' }, `${deck.entries.length} monstruo${deck.entries.length === 1 ? '' : 's'} · ${totalCards(deck)} carta${totalCards(deck) === 1 ? '' : 's'} para imprimir`)),
      h('div', { class: 'toolbar', style: { margin: 0 } },
        h('button', { class: 'btn primary small', onclick: () => addMonstersDialog(deck) }, '+ Añadir monstruos'),
        h('button', { class: 'btn small', disabled: !deck.entries.length, onclick: () => { state.printSource = `deck:${deck.id}`; location.hash = '#/print'; } }, 'Imprimir mazo'),
        h('button', { class: 'btn small', onclick: async () => {
          const name = await askText('Renombrar mazo', 'Nombre', deck.name, 'Guardar');
          if (name) { deck.name = name; await persistDecks(); }
        } }, 'Renombrar'),
        h('button', { class: 'btn small danger', onclick: () => deleteDeck(deck) }, 'Eliminar mazo'))));
  }

  /** Elimina un mazo; opcionalmente borra también los monstruos que solo estaban en él. */
  async function deleteDeck(deck) {
    const only = deck.entries.map(e => e.id).filter(id => !decks.some(d => d !== deck && countIn(d, id)));
    let alsoMonsters = false;
    const ok = await dialog({
      title: 'Eliminar mazo',
      build: body => {
        body.append(h('p', {}, `Se eliminará el mazo «${deck.name}» (${deck.entries.length} monstruo${deck.entries.length === 1 ? '' : 's'}, ${totalCards(deck)} carta${totalCards(deck) === 1 ? '' : 's'}).`));
        if (only.length) {
          body.append(
            h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: e => { alsoMonsters = e.target.checked; } }),
              only.length === 1 ? 'Borrar también del bestiario el monstruo que solo está en este mazo'
                : `Borrar también del bestiario los ${only.length} monstruos que solo están en este mazo`),
            h('p', { class: 'hint' }, 'Si no lo marcas, los monstruos seguirán en «Todos». Borrarlos no se puede deshacer.'));
        } else {
          body.append(h('p', { class: 'hint' }, 'Los monstruos seguirán en tu bestiario.'));
        }
      },
      actions: [{ label: 'Cancelar', value: false }, { label: 'Eliminar mazo', danger: true, value: true }],
    });
    if (!ok) return;
    decks = decks.filter(d => d !== deck);
    await saveDecks(decks);
    if (alsoMonsters && only.length) {
      for (const id of only) await deleteCard(id);
      only.forEach(id => state.selection.delete(id));
    }
    if (state.deckFilter === deck.id) state.deckFilter = '';
    toast(alsoMonsters && only.length ? `Mazo y ${only.length} monstruo(s) borrados` : 'Mazo eliminado');
    await reload();
  }

  /** Papelera de una carta: en un mazo permite quitarla o borrarla; en «Todos», borrarla. */
  async function deleteOne(m) {
    const deck = currentDeck();
    const inDecks = decks.filter(d => countIn(d, m.id));
    const where = !inDecks.length ? ''
      : inDecks.length === 1 ? ' También desaparecerá del mazo en el que está.'
        : ` También desaparecerá de los ${inDecks.length} mazos en los que está.`;
    const choice = await dialog({
      title: deck ? 'Quitar o borrar' : 'Borrar monstruo',
      build: body => {
        body.append(h('p', {}, deck
          ? `¿Qué quieres hacer con «${m.name}»?`
          : `Se borrará «${m.name}» del bestiario.${where}`));
        if (deck) body.append(h('ul', { class: 'dlg-list' },
          h('li', {}, h('b', {}, 'Quitar del mazo: '), `deja de estar en «${deck.name}», pero sigue en tu bestiario.`),
          h('li', {}, h('b', {}, 'Borrar del bestiario: '), `elimina el monstruo para siempre.${where}`)));
        body.append(h('p', { class: 'hint' }, 'Borrar no se puede deshacer. Si dudas, exporta antes una copia desde Ajustes.'));
      },
      actions: deck
        ? [{ label: 'Cancelar', value: null }, { label: 'Quitar del mazo', value: 'remove' }, { label: 'Borrar del bestiario', danger: true, value: 'delete' }]
        : [{ label: 'Cancelar', value: null }, { label: 'Borrar', danger: true, value: 'delete' }],
    });
    if (choice === 'remove') {
      setCount(deck, m.id, 0);
      await persistDecks();
      toast(`«${m.name}» quitado de «${deck.name}»`);
    } else if (choice === 'delete') {
      await deleteCard(m.id);
      await purgeMonsters([m.id]);
      state.selection.delete(m.id);
      toast(`«${m.name}» borrado`);
      await reload();
    }
  }

  // ---------- diálogos ----------
  function addMonstersDialog(deck) {
    const picked = new Set();
    return dialog({
      title: `Añadir a ${deck.name}`,
      wide: true,
      build: body => {
        const list = h('div', { class: 'pick-list' });
        const q = h('input', { class: 'input', type: 'search', placeholder: 'Buscar…', oninput: () => fill() });
        const fill = () => {
          const term = q.value.trim().toLowerCase();
          list.replaceChildren(...cards.filter(c => !term || c.name.toLowerCase().includes(term)).map(c => {
            const inDeck = countIn(deck, c.id);
            return h('label', { class: 'pick-row' },
              h('span', { class: 'check' }, h('input', { type: 'checkbox', checked: picked.has(c.id),
                onchange: e => { if (e.target.checked) picked.add(c.id); else picked.delete(c.id); } })),
              h('span', { class: 'pick-name' }, c.name),
              h('span', { class: 'muted' }, [c.kind, c.hd && `DG ${c.hd}`].filter(Boolean).join(' · ')),
              inDeck ? h('span', { class: 'badge' }, `×${inDeck} en el mazo`) : null);
          }));
          if (!list.children.length) list.append(h('p', { class: 'muted' }, 'No hay monstruos con ese nombre.'));
        };
        fill();
        body.append(q, list);
      },
      actions: [{ label: 'Cancelar', value: null }, { label: 'Añadir', primary: true, value: () => [...picked] }],
    }).then(async ids => {
      if (!ids || !ids.length) return;
      ids.forEach(id => setCount(deck, id, countIn(deck, id) + 1));
      await persistDecks();
      toast(`${ids.length} añadido(s) a «${deck.name}»`);
    });
  }

  async function addSelectionToDeck() {
    const ids = [...state.selection];
    let chosen = decks[0]?.id || '__new';
    const target = await dialog({
      title: `Añadir ${ids.length} a un mazo`,
      build: (body, close, setValue) => {
        const nameInput = h('input', { class: 'input', placeholder: 'Nombre del nuevo mazo' });
        const newRadio = h('input', { type: 'radio', name: 'deck', checked: chosen === '__new',
          onchange: () => { chosen = '__new'; nameInput.focus(); } });
        const radios = h('div', { class: 'stack' },
          decks.map(d => h('label', { class: 'check' }, h('input', { type: 'radio', name: 'deck', checked: chosen === d.id,
            onchange: () => { chosen = d.id; } }), d.name, h('span', { class: 'muted' }, ` · ${totalCards(d)} cartas`))),
          h('label', { class: 'check' }, newRadio, 'Nuevo mazo:'),
          nameInput);
        nameInput.addEventListener('input', () => { chosen = '__new'; newRadio.checked = true; });
        setValue(() => ({ chosen, name: nameInput.value.trim() }));
        body.append(radios);
      },
      actions: [{ label: 'Cancelar', value: null }, { label: 'Añadir', primary: true, value: get => get()() }],
    });
    if (!target) return;
    let deck;
    if (target.chosen === '__new') {
      if (!target.name) { toast('Escribe un nombre para el nuevo mazo'); return; }
      deck = newDeck(target.name);
      decks.push(deck);
    } else deck = decks.find(d => d.id === target.chosen);
    ids.forEach(id => setCount(deck, id, Math.max(1, countIn(deck, id))));
    await saveDecks(decks);
    state.selection.clear();
    selecting = false;
    render();
    toast(`Añadidos a «${deck.name}»`);
  }

  // ---------- rejilla ----------
  function visible() {
    const deck = currentDeck();
    const q = state.search.trim().toLowerCase();
    let list = deck ? cards.filter(c => countIn(deck, c.id)) : cards;
    if (q) list = list.filter(c => [c.name, c.kind].some(v => String(v || '').toLowerCase().includes(q)));
    return list;
  }

  function tile(m) {
    const deck = currentDeck();
    const thumb = scaled(renderFront(m), CARD.w, CARD.h);
    const picked = state.selection.has(m.id);
    const inDecks = decks.filter(d => countIn(d, m.id));
    const el = h('div', { class: `tile${picked ? ' picked' : ''}` },
      h('button', { class: 'pick', 'aria-label': 'Seleccionar', onclick: e => { e.stopPropagation(); togglePick(m.id); } }, picked ? '✓' : ''),
      h('button', { type: 'button', class: 'tile-del', title: deck ? 'Quitar o borrar' : 'Borrar', 'aria-label': `${deck ? 'Quitar o borrar' : 'Borrar'} ${m.name}`,
        html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>', onclick: e => { e.stopPropagation(); deleteOne(m); } }),
      thumb,
      h('div', { class: 'tile-meta' }, h('span', { class: 'name', title: m.name }, m.name), h('span', { class: 'muted' }, m.hd ? `DG ${m.hd}` : '')),
      deck
        ? h('div', { class: 'tile-count' },
          h('span', { class: 'muted' }, 'Copias'),
          h('div', { class: 'stepper' },
            h('button', { type: 'button', class: 'btn icon small', 'aria-label': 'Una copia menos', onclick: async () => {
              const n = countIn(deck, m.id) - 1;
              if (n < 1) {
                if (!(await confirmDialog('Quitar del mazo', `¿Quitar «${m.name}» de «${deck.name}»?`, 'Quitar'))) return;
              }
              setCount(deck, m.id, n); await persistDecks();
            } }, '−'),
            h('output', {}, String(countIn(deck, m.id))),
            h('button', { type: 'button', class: 'btn icon small', 'aria-label': 'Una copia más', onclick: async () => { setCount(deck, m.id, countIn(deck, m.id) + 1); await persistDecks(); } }, '+')))
        : inDecks.length ? h('div', { class: 'tile-decks' }, inDecks.map(d => h('span', { class: 'chip' }, d.name))) : null);
    thumb.addEventListener('click', () => { if (selecting) togglePick(m.id); else location.hash = `#/edit/${m.id}`; });
    return el;
  }

  function togglePick(id) {
    if (state.selection.has(id)) state.selection.delete(id); else state.selection.add(id);
    renderGrid();
  }

  function renderGrid() {
    selBtn.textContent = selecting ? 'Cancelar' : 'Seleccionar';
    content.className = selecting ? 'selecting' : '';
    content.replaceChildren();
    const deck = currentDeck();
    if (!cards.length) {
      content.append(h('div', { class: 'empty' }, h('h3', {}, 'El bestiario está vacío'), h('p', {}, 'Pulsa «Nuevo monstruo» para crear el primero.')));
      return;
    }
    const list = visible();
    if (!list.length) {
      content.append(h('div', { class: 'empty' }, deck && !deck.entries.length
        ? [h('h3', {}, 'Mazo vacío'), h('p', {}, 'Añade monstruos de tu bestiario a este mazo.'),
          h('button', { class: 'btn primary', onclick: () => addMonstersDialog(deck) }, '+ Añadir monstruos')]
        : h('p', {}, 'Ningún monstruo coincide con la búsqueda.')));
    } else {
      content.append(h('div', { class: 'grid' }, list.map(tile)));
    }
    if (selecting) content.append(selectionBar());
    fitWhenReady(content);
  }

  const selected = () => cards.filter(c => state.selection.has(c.id));

  function selectionBar() {
    const n = state.selection.size;
    const deck = currentDeck();
    return h('div', { class: 'selbar' },
      h('b', {}, `${n} seleccionado${n === 1 ? '' : 's'}`),
      h('div', { class: 'toolbar', style: { margin: 0 } },
        h('button', { class: 'btn small', onclick: () => { visible().forEach(c => state.selection.add(c.id)); renderGrid(); } }, 'Todos'),
        h('button', { class: 'btn small primary', disabled: !n, onclick: addSelectionToDeck }, 'Añadir a mazo…'),
        deck ? h('button', { class: 'btn small', disabled: !n, onclick: async () => {
          selected().forEach(c => setCount(deck, c.id, 0));
          state.selection.clear(); await persistDecks(); toast('Quitados del mazo');
        } }, 'Quitar del mazo') : null,
        h('button', { class: 'btn small', disabled: !n, onclick: () => { state.printSource = 'selection'; location.hash = '#/print'; } }, 'Imprimir'),
        h('button', { class: 'btn small', disabled: !n, onclick: duplicateSel }, 'Duplicar'),
        h('button', { class: 'btn small', disabled: !n, onclick: () => download(`${slug(deck ? deck.name : 'monstruos')}.json`, exportJSON(selected(), deck ? [deck] : [])) }, 'Exportar'),
        h('button', { class: 'btn small danger', disabled: !n, onclick: deleteSel }, 'Borrar')));
  }

  async function duplicateSel() {
    const deck = currentDeck();
    const copies = selected().map(c => ({ ...structuredClone(c), id: uid(), name: `${c.name} (copia)`, createdAt: Date.now() }));
    await putCards(copies);
    if (deck) { copies.forEach(c => setCount(deck, c.id, 1)); await saveDecks(decks); }
    toast(`${copies.length} duplicado(s)`);
    await reload();
  }

  async function deleteSel() {
    const sel = selected();
    const ok = await confirmDialog('Borrar monstruos', `Se borrarán ${sel.length} monstruo(s) del bestiario y de todos los mazos. No se puede deshacer.`);
    if (!ok) return;
    for (const c of sel) await deleteCard(c.id);
    await purgeMonsters(sel.map(c => c.id));
    state.selection.clear();
    toast('Borrados');
    await reload();
  }

  function render() { renderTabs(); renderDeckHead(); renderGrid(); }
  render();
  return watchScale(content);
}
