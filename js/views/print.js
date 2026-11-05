import { getAllCards, getMeta, setMeta } from '../store.js';
import { CARD } from '../model.js';
import { renderFace } from '../render.js';
import { fitWhenReady } from '../fit.js';
import { h, scaled, watchScale } from '../ui.js';
import { state } from '../state.js';
import { getDecks, countIn } from '../decks.js';

const PAPERS = {
  a4: { label: 'A4 (210 × 297 mm)', w: 210, h: 297 },
  letter: { label: 'Carta US (8,5 × 11")', w: 215.9, h: 279.4 },
  a3: { label: 'A3 (297 × 420 mm)', w: 297, h: 420 },
};

const DEFAULTS = {
  source: 'all', paper: 'a4', orient: 'auto', margin: 6, gap: 0,
  cutmarks: true, square: false, backs: true, flip: 'long', backX: 0, backY: 0,
};

function capacity(pw, ph, cw, ch, m, g) {
  const cols = Math.max(0, Math.floor((pw - 2 * m + g) / (cw + g)));
  const rows = Math.max(0, Math.floor((ph - 2 * m + g) / (ch + g)));
  return { cols, rows, n: cols * rows };
}

function groupBySize(cards) {
  const groups = new Map();
  for (const c of cards) {
    const { w, h: hh } = CARD;
    const key = `${w}x${hh}`;
    if (!groups.has(key)) groups.set(key, { w, h: hh, cards: [] });
    groups.get(key).cards.push(c);
  }
  return [...groups.values()];
}

function pagesFor(groups, pw, ph, o) {
  return groups.reduce((sum, g) => {
    const cap = capacity(pw, ph, g.w, g.h, o.margin, o.gap);
    return sum + (cap.n ? Math.ceil(g.cards.length / cap.n) : Infinity);
  }, 0);
}

function sheetHTML({ pw, ph, cw, ch, cols, rows, gap, cls, slots, dx = 0, dy = 0 }) {
  const gw = cols * cw + (cols - 1) * gap;
  const gh = rows * ch + (rows - 1) * gap;
  const left = (pw - gw) / 2 + dx;
  const top = (ph - gh) / 2 + dy;
  const inner = slots.map(s => `<div class="slot${s.rot ? ' rot180' : ''}" style="grid-row:${s.r + 1};grid-column:${s.c + 1}">${s.html}</div>`).join('');
  return `<div class="sheet ${cls}" style="--pw:${pw}mm;--ph:${ph}mm;--cols:${cols};--cw:${cw}mm;--ch:${ch}mm;--gap:${gap}mm">
    <div class="sheet-grid" style="left:${left}mm;top:${top}mm">${inner}</div></div>`;
}

export async function printView(root) {
  const all = await getAllCards();
  const decks = await getDecks();
  const opts = { ...DEFAULTS, ...(await getMeta('printOpts', {})) };
  // Origen: el que pidió la biblioteca, si no el último usado (si sigue existiendo)
  if (state.printSource) opts.source = state.printSource;
  state.printSource = '';
  const validSource = src => src === 'all' || (src === 'selection' && state.selection.size) ||
    (src.startsWith('deck:') && decks.some(d => d.id === src.slice(5)));
  if (!validSource(opts.source)) opts.source = decks[0] ? `deck:${decks[0].id}` : 'all';

  // Copias por monstruo para esta impresión (se inicializan con las del mazo)
  let qty = new Map();
  const resetQty = () => {
    qty = new Map();
    if (opts.source.startsWith('deck:')) {
      const deck = decks.find(d => d.id === opts.source.slice(5));
      deck.entries.forEach(e => qty.set(e.id, e.count));
    } else if (opts.source === 'selection') state.selection.forEach(id => qty.set(id, 1));
    else all.forEach(c => qty.set(c.id, 1));
  };
  resetQty();
  // Monstruos que aparecen en la lista (aunque estén a 0 copias)
  const listed = () => {
    if (opts.source.startsWith('deck:')) {
      const deck = decks.find(d => d.id === opts.source.slice(5));
      return all.filter(c => countIn(deck, c.id));
    }
    if (opts.source === 'selection') return all.filter(c => state.selection.has(c.id));
    return all;
  };

  const preview = h('div', { class: 'print-preview' });
  const summary = h('p', { class: 'muted', style: { margin: 0, fontSize: '13px' } });

  const persist = () => setMeta('printOpts', { ...opts, source: opts.source === 'selection' ? '' : opts.source });
  let lastSource = opts.source;
  const update = () => {
    persist();
    backBox.style.display = opts.backs ? '' : 'none';
    if (opts.source !== lastSource) { lastSource = opts.source; resetQty(); renderList(); }
    build();
  };

  const sel = (key, options) => {
    const s = h('select', { class: 'input', onchange: () => { opts[key] = s.value; update(); } }, options.map(([v, l]) => h('option', { value: v }, l)));
    s.value = String(opts[key]);
    return s;
  };
  const num = (key, min, max, step = 0.5) => h('input', { class: 'input', type: 'number', min, max, step, value: opts[key],
    onchange: e => { const v = parseFloat(e.target.value); opts[key] = Number.isNaN(v) ? DEFAULTS[key] : v; update(); } });
  const chk = (key, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!opts[key], onchange: e => { opts[key] = e.target.checked; update(); } }), label);
  const field = (label, el) => h('label', { class: 'field' }, h('span', {}, label), el);

  const sourceOptions = [
    ...decks.map(d => [`deck:${d.id}`, `Mazo: ${d.name}`]),
    ...(state.selection.size ? [['selection', `Selección (${state.selection.size})`]] : []),
    ['all', `Todo el bestiario (${all.length})`],
  ];

  // ---------- lista de cartas con copias ----------
  const cardList = h('div', { class: 'print-list' });
  function renderList() {
    const rows = listed().map(c => {
      const n = qty.get(c.id) || 0;
      const out = h('output', {}, String(n));
      const set = v => { qty.set(c.id, Math.max(0, Math.min(99, v))); renderList(); build(); };
      return h('div', { class: `print-row${n ? '' : ' off'}` },
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: n > 0, onchange: e => set(e.target.checked ? 1 : 0) }),
          h('span', { class: 'pr-name' }, c.name)),
        h('div', { class: 'stepper' },
          h('button', { type: 'button', class: 'btn icon small', 'aria-label': 'Menos', disabled: n <= 0, onclick: () => set(n - 1) }, '−'),
          out,
          h('button', { type: 'button', class: 'btn icon small', 'aria-label': 'Más', onclick: () => set(n + 1) }, '+')));
    });
    cardList.replaceChildren(...(rows.length ? rows : [h('p', { class: 'muted' }, 'No hay monstruos en esta selección.')]));
  }
  const listTools = h('div', { class: 'toolbar', style: { margin: 0 } },
    h('button', { type: 'button', class: 'btn small', onclick: () => { listed().forEach(c => qty.set(c.id, Math.max(1, qty.get(c.id) || 0))); renderList(); build(); } }, 'Todas'),
    h('button', { type: 'button', class: 'btn small', onclick: () => { listed().forEach(c => qty.set(c.id, 0)); renderList(); build(); } }, 'Ninguna'),
    h('button', { type: 'button', class: 'btn small', onclick: () => { resetQty(); renderList(); build(); } }, 'Restablecer'));

  const backBox = h('div', { class: 'stack', style: { display: opts.backs ? '' : 'none' } },
    field('Volteo de la hoja', sel('flip', [['long', 'Por el borde largo (lo habitual)'], ['short', 'Por el borde corto']])),
    h('div', { class: 'row two' }, field('Ajuste reverso X (mm)', num('backX', -10, 10, 0.25)), field('Ajuste reverso Y (mm)', num('backY', -10, 10, 0.25))),
    h('p', { class: 'hint' }, 'Si los reversos salen desplazados, corrige con los ajustes X/Y.'));

  const options = h('div', { class: 'print-options panel stack' },
    h('h2', { class: 'view-title', style: { margin: 0 } }, 'Imprimir'),
    field('Qué imprimir', sel('source', sourceOptions)),
    h('div', { class: 'field' }, h('span', {}, 'Cartas y copias'), cardList, listTools),
    field('Papel', sel('paper', Object.entries(PAPERS).map(([k, p]) => [k, p.label]))),
    field('Orientación de la hoja', sel('orient', [['auto', 'Automática (menos hojas)'], ['portrait', 'Vertical'], ['landscape', 'Horizontal']])),
    h('div', { class: 'row two' }, field('Margen (mm)', num('margin', 0, 30)), field('Separación (mm)', num('gap', 0, 10))),
    chk('cutmarks', 'Líneas de corte'),
    chk('square', 'Esquinas rectas (más fácil de recortar)'),
    chk('backs', 'Imprimir reversos (doble cara)'),
    backBox,
    summary,
    h('button', { class: 'btn primary', onclick: doPrint }, 'Imprimir / Guardar PDF'),
    h('p', { class: 'hint' }, 'En el diálogo elige escala 100 % («Tamaño real») y sin márgenes. En el móvil usa «Guardar como PDF» o Compartir → Imprimir.'));

  root.append(h('div', { class: 'print-layout' }, options, preview));

  /** Lista expandida: cada monstruo repetido tantas veces como copias. */
  function chosenCards() {
    return listed().flatMap(c => Array.from({ length: qty.get(c.id) || 0 }, () => c));
  }

  function build() {
    const cards = chosenCards();
    const paper = PAPERS[opts.paper] || PAPERS.a4;
    const groups = groupBySize(cards);
    let orient = opts.orient;
    if (orient === 'auto') {
      orient = pagesFor(groups, paper.h, paper.w, opts) < pagesFor(groups, paper.w, paper.h, opts) ? 'landscape' : 'portrait';
    }
    const pw = orient === 'landscape' ? paper.h : paper.w;
    const ph = orient === 'landscape' ? paper.w : paper.h;
    document.getElementById('page-style').textContent = `@page { size: ${pw}mm ${ph}mm; margin: 0; }`;

    const cls = [opts.cutmarks && 'cutmarks', opts.square && 'square'].filter(Boolean).join(' ');
    const sheets = [];
    const warnings = [];

    for (const g of groups) {
      const cap = capacity(pw, ph, g.w, g.h, opts.margin, opts.gap);
      if (!cap.n) { warnings.push(`${g.cards.length} carta(s) de ${g.w}×${g.h} mm no caben en la hoja.`); continue; }
      for (let i = 0; i < g.cards.length; i += cap.n) {
        const chunk = g.cards.slice(i, i + cap.n);
        const base = { pw, ph, cw: g.w, ch: g.h, cols: cap.cols, rows: cap.rows, gap: opts.gap, cls };
        const front = chunk.map((c, k) => ({ r: Math.floor(k / cap.cols), c: k % cap.cols, html: renderFace(c, 'front') }));
        sheets.push({ label: `Anverso · ${g.w}×${g.h} mm`, html: sheetHTML({ ...base, slots: front }) });

        if (opts.backs && chunk.length) {
          const back = chunk.map((c, k) => {
            const r = Math.floor(k / cap.cols), col = k % cap.cols;
            return opts.flip === 'long'
              ? { r, c: cap.cols - 1 - col, html: renderFace(c, 'back') }
              : { r: cap.rows - 1 - r, c: col, rot: true, html: renderFace(c, 'back') };
          });
          sheets.push({ label: `Reverso · ${g.w}×${g.h} mm`, html: sheetHTML({ ...base, slots: back, dx: opts.backX, dy: opts.backY }) });
        }
      }
    }

    preview.replaceChildren();
    if (!cards.length) preview.append(h('div', { class: 'empty', style: { width: '100%' } }, h('p', {}, 'No hay cartas que imprimir: marca alguna en la lista.')));
    warnings.forEach(w => preview.append(h('p', { class: 'no-print', style: { color: 'var(--danger)', margin: 0 } }, w)));
    const fronts = sheets.filter(s => s.label.startsWith('Anverso')).length;
    summary.textContent = `${cards.length} carta(s) · ${sheets.length} hoja(s)${sheets.length !== fronts ? ` (${fronts} anversos + ${sheets.length - fronts} reversos)` : ''} · ${orient === 'landscape' ? 'horizontal' : 'vertical'}`;

    sheets.forEach((s, i) => {
      const wrap = h('div', { class: 'page-wrap', style: { maxWidth: '760px' } });
      preview.append(wrap);
      wrap.append(scaled(s.html, pw, ph), h('div', { class: 'page-label' }, `Hoja ${i + 1} — ${s.label}`));
    });
    return fitWhenReady(preview);
  }

  async function doPrint() {
    await build();
    window.print();
  }

  renderList();
  build();
  const stop = watchScale(preview);
  return () => stop();
}
