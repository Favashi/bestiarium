import { getCard, putCard, deleteCard } from '../store.js';
import { getDecks, saveDecks, newDeck, countIn, setCount, purgeMonsters } from '../decks.js';
import { CARD, ALIGNMENTS, SAVE_KEYS, SAVE_LABELS, derived, uid } from '../model.js';
import { renderFront, renderBack } from '../render.js';
import { parseStatBlock } from '../parse.js';
import { fitWhenReady } from '../fit.js';
import { fileToDataURL, pickFile } from '../image.js';
import { h, scaled, toast, debounce, askText, confirmDialog } from '../ui.js';

export async function editorView(root, id) {
  let m = await getCard(id);
  if (!m) {
    root.append(h('div', { class: 'empty' }, h('h3', {}, 'Monstruo no encontrado'), h('a', { class: 'btn', href: '#/' }, 'Volver')));
    return;
  }
  let decks = await getDecks();
  let mobileSide = 'front';

  // ---------- guardado y vista previa ----------
  const savedEl = h('span', { class: 'muted', style: { fontSize: '13px' } }, 'Guardado');
  const save = debounce(async () => { await putCard(m); savedEl.textContent = 'Guardado'; }, 400);
  let queued = false;
  const autoRefs = [];
  function changed(structural = false) {
    savedEl.textContent = 'Guardando…';
    save();
    autoRefs.forEach(fn => fn());
    if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; renderPreview(); }); }
    if (structural) renderForm();
  }

  const isNarrow = () => window.matchMedia('(max-width: 900px)').matches;
  const frontStage = h('div', { class: 'face' });
  const backStage = h('div', { class: 'face' });
  const segFront = h('button', { onclick: () => { mobileSide = 'front'; renderPreview(); } }, 'Anverso');
  const segBack = h('button', { onclick: () => { mobileSide = 'back'; renderPreview(); } }, 'Reverso');
  const preview = h('div', { class: 'editor-preview' },
    h('div', { class: 'seg only-narrow' }, segFront, segBack),
    h('div', { class: 'faces' },
      h('figure', {}, frontStage, h('figcaption', {}, 'Anverso')),
      h('figure', {}, backStage, h('figcaption', {}, 'Reverso'))));

  function renderPreview() {
    const narrow = isNarrow();
    segFront.classList.toggle('on', mobileSide === 'front');
    segBack.classList.toggle('on', mobileSide === 'back');
    preview.dataset.side = mobileSide;
    const maxH = narrow ? Math.min(window.innerHeight * 0.42, 420) : window.innerHeight - 170;
    const widthEach = narrow ? Math.min(preview.clientWidth - 32, 300) : (preview.clientWidth - 24) / 2;
    for (const [stage, html] of [[frontStage, renderFront(m)], [backStage, renderBack(m)]]) {
      const t = scaled(html, CARD.w, CARD.h, { maxH, fixedWidth: Math.max(140, widthEach) });
      stage.replaceChildren(t);
      t._apply();
    }
    fitWhenReady(preview);
  }

  // ---------- helpers ----------
  const field = (label, control, opts = {}) => h('label', { class: `field${opts.wide ? ' wide' : ''}` },
    h('span', {}, label, opts.auto ? h('em', { class: 'auto-tag' }, 'auto') : null), control);
  const text = (key, attrs = {}) => h('input', { class: 'input', value: m[key] ?? '', ...attrs, oninput: e => { m[key] = e.target.value; changed(); } });
  const area = (key, attrs = {}) => h('textarea', { class: 'input', value: m[key] ?? '', rows: 3, ...attrs, oninput: e => { m[key] = e.target.value; changed(); } });
  /** Campo con valor calculado: vacío = automático (se muestra como placeholder). */
  const autoText = (key, compute, attrs = {}) => {
    const el = text(key, attrs);
    const refresh = () => { el.placeholder = String(compute() ?? ''); };
    refresh();
    autoRefs.push(refresh);
    return el;
  };
  const group = (title, hint, ...children) => h('section', { class: 'group' },
    h('header', {}, h('h3', {}, title), hint ? h('p', { class: 'hint' }, hint) : null), children);

  // ---------- pegar bloque ----------
  function pastePanel() {
    const ta = h('textarea', { class: 'input mono', rows: 6, placeholder:
      'Trasgo\nAC 6 [13], HD 1-1 (3hp), Att 1 × weapon (1d6), THAC0 19 [0], MV 60\' (20\'), SV D14 W15 P16 B17 S18 (NH), ML 7, AL Chaotic, XP 5, NA 2d4 (6d10), TT R\n▶ Infravisión: 18 m.\n\n— o en castellano —\nClase de armadura: 6\nDados de golpe: 1-1\nMovimiento: 18 metros…' });
    const panel = h('details', { class: 'group paste' },
      h('summary', {}, h('h3', {}, 'Pegar bloque de estadísticas'), h('span', { class: 'hint' }, 'OSE o Marca del Este')),
      h('div', { class: 'stack' }, ta,
        h('div', { class: 'toolbar', style: { margin: 0 } },
          h('button', { type: 'button', class: 'btn primary small', onclick: () => {
            const p = parseStatBlock(ta.value);
            if (!p) { toast('No he reconocido ningún dato (CA, DG, Moral…)', 3500); return; }
            const { saves, abilities, ...rest } = p;
            Object.assign(m, rest);
            if (saves) m.saves = { ...m.saves, ...saves };
            if (abilities && abilities.length) m.abilities = abilities;
            ta.value = '';
            toast('Datos rellenados. Revisa el resultado.');
            changed(true);
          } }, 'Rellenar campos'),
          h('span', { class: 'hint' }, 'Sustituye los campos que encuentre.'))));
    return panel;
  }

  /** Mazos en los que está el monstruo: se marcan/desmarcan con un toque. */
  function deckChips() {
    const wrap = h('div', { class: 'chips' });
    const fill = () => {
      wrap.replaceChildren(
        ...decks.map(d => {
          const n = countIn(d, m.id);
          return h('button', { type: 'button', class: `chip toggle${n ? ' on' : ''}`, 'aria-pressed': n ? 'true' : 'false',
            onclick: async () => { setCount(d, m.id, n ? 0 : 1); await saveDecks(decks); fill(); } },
            d.name, n > 1 ? h('small', {}, ` ×${n}`) : null);
        }),
        h('button', { type: 'button', class: 'chip add', onclick: async () => {
          const name = await askText('Nuevo mazo', 'Nombre del mazo o aventura', '', 'Crear');
          if (!name) return;
          const d = newDeck(name);
          setCount(d, m.id, 1);
          decks.push(d);
          await saveDecks(decks);
          fill();
        } }, '+ Nuevo mazo'));
    };
    fill();
    return wrap;
  }

  // ---------- secciones del formulario ----------
  function identity() {
    const alignSeg = h('div', { class: 'seg' }, ALIGNMENTS.map(a => h('button', { type: 'button', class: m.alignment === a ? 'on' : '',
      onclick: () => { m.alignment = m.alignment === a ? '' : a; changed(true); } }, a)));
    const prev = h('div', { class: 'img-prev', style: m.image ? { backgroundImage: `url(${m.image})` } : {} });
    const upload = async () => {
      const file = await pickFile();
      if (!file) return;
      try { m.image = await fileToDataURL(file, 1000); changed(true); } catch (e) { toast(e.message); }
    };
    const slider = (label, key, min, max, step) => field(label, h('input', { type: 'range', min, max, step, value: m[key],
      oninput: e => { m[key] = Number(e.target.value); changed(); } }));

    return group('Identidad', null,
      h('div', { class: 'grid2' },
        field('Nombre', text('name'), { wide: true }),
        field('Tipo', text('kind', { placeholder: 'Humanoide, no muerto…' })),
        field('Alineamiento', alignSeg)),
      field('Mazos', deckChips()),
      h('div', { class: 'img-row' }, prev,
        h('div', { class: 'stack', style: { flex: 1 } },
          h('div', { class: 'toolbar', style: { margin: 0 } },
            h('button', { type: 'button', class: 'btn small', onclick: upload }, m.image ? 'Cambiar ilustración' : 'Subir ilustración'),
            m.image ? h('button', { type: 'button', class: 'btn small danger', onclick: () => { m.image = null; changed(true); } }, 'Quitar') : null),
          m.image ? h('div', { class: 'grid3' }, slider('Horizontal', 'imageX', 0, 100, 1), slider('Vertical', 'imageY', 0, 100, 1), slider('Zoom', 'imageZoom', 1, 3, 0.05))
            : h('p', { class: 'hint' }, 'Mejor dibujos a línea en blanco y negro (PNG con fondo transparente o blanco).'),
          h('label', { class: 'check' },
            h('input', { type: 'checkbox', checked: !!m.frame, onchange: e => { m.frame = e.target.checked; changed(); } }),
            'Marco OSR alrededor de la ilustración'))));
  }

  function stats() {
    return group('Estadísticas', 'Escribe los DG y deja vacíos PG, TAC0 y PX para calcularlos.',
      h('div', { class: 'grid4' },
        field('CA', text('ac', { inputmode: 'numeric', placeholder: '6' })),
        field('DG', text('hd', { placeholder: '2+1*' })),
        field('PG', autoText('hp', () => derived({ ...m, hp: '' }).hp, { inputmode: 'numeric' }), { auto: true }),
        field('TAC0', autoText('thac0', () => derived({ ...m, thac0: '' }).thac0.toString().split(' ')[0], { inputmode: 'numeric' }), { auto: true }),
        field('Ataques', text('attacks', { placeholder: '2 × garras (1d4), 1 × mordisco (1d8)' }), { wide: true }),
        field('Movimiento', text('move', { placeholder: '36 m (12 m)' }), { wide: true }),
        field('Moral', text('morale', { inputmode: 'numeric', placeholder: '7' })),
        field('Nº aparición', text('appearing', { placeholder: '2d4 (6d10)' })),
        field('PX', autoText('xp', () => derived({ ...m, xp: '' }).xp, { inputmode: 'numeric' }), { auto: true }),
        field('Tesoro', text('treasure', { placeholder: 'C' }))),
      hpOption());
  }

  /** Interruptor destacado de las casillas de PG, con selector de nº de criaturas. */
  function hpOption() {
    const count = Math.max(1, Math.min(12, parseInt(m.hpRows, 10) || 1));
    const setCount = n => { m.hpRows = Math.max(1, Math.min(12, n)); changed(true); };
    return h('div', { class: `toggle-card${m.hpBoxes ? ' on' : ''}` },
      h('label', { class: 'toggle-main' },
        h('span', { class: 'toggle-text' },
          h('b', {}, 'Casillas para marcar PG'),
          h('small', {}, m.hpBoxes
            ? 'Van bajo el nombre, en el anverso. Las habilidades y el tesoro pasan al reverso.'
            : 'Añade casillas en el anverso para tachar los PG durante el combate.')),
        h('input', { type: 'checkbox', class: 'switch', role: 'switch', checked: !!m.hpBoxes,
          onchange: e => { m.hpBoxes = e.target.checked; changed(true); } })),
      m.hpBoxes ? h('div', { class: 'toggle-extra' },
        h('span', {}, 'Criaturas'),
        h('div', { class: 'stepper' },
          h('button', { type: 'button', class: 'btn icon small', 'aria-label': 'Menos', disabled: count <= 1, onclick: () => setCount(count - 1) }, '−'),
          h('output', {}, String(count)),
          h('button', { type: 'button', class: 'btn icon small', 'aria-label': 'Más', disabled: count >= 12, onclick: () => setCount(count + 1) }, '+')),
        h('span', { class: 'hint' }, `${derived(m).hp || '?'} casillas por criatura`)) : null);
  }

  function saves() {
    return group('Salvaciones', 'Por defecto, como guerrero del nivel de sus DG.',
      h('div', { class: 'grid6' },
        field('Como', autoText('saveAs', () => derived({ ...m, saveAs: '' }).saveAs, { placeholder: 'G1' }), { auto: true }),
        SAVE_KEYS.map(k => {
          const el = h('input', { class: 'input', inputmode: 'numeric', value: m.saves[k] ?? '', title: SAVE_LABELS[k].long,
            oninput: e => { m.saves[k] = e.target.value; changed(); } });
          const refresh = () => { el.placeholder = String(derived({ ...m, saves: { ...m.saves, [k]: '' } }).saves[k] ?? ''); };
          refresh();
          autoRefs.push(refresh);
          return field(`${SAVE_LABELS[k].short} · ${SAVE_LABELS[k].long.split(' ')[0]}`, el);
        })));
  }

  function combat() {
    return group(m.hpBoxes ? 'Habilidades y tesoro (reverso)' : 'Combate (anverso)',
      m.hpBoxes ? 'Están en el reverso porque has activado las casillas de PG (en Estadísticas).'
        : 'Van en el anverso. Si activas las casillas de PG en Estadísticas, pasan al reverso.',
      h('div', { class: 'stack' },
        m.abilities.map((a, i) => h('div', { class: 'ability' },
          h('div', { class: 'ability-head' },
            h('input', { class: 'input', value: a.name, placeholder: 'Nombre (p. ej. Infravisión)', oninput: e => { a.name = e.target.value; changed(); } }),
            h('button', { type: 'button', class: 'btn icon small', title: 'Subir', 'aria-label': 'Subir', disabled: i === 0,
              onclick: () => { [m.abilities[i - 1], m.abilities[i]] = [m.abilities[i], m.abilities[i - 1]]; changed(true); } }, '↑'),
            h('button', { type: 'button', class: 'btn icon small danger', title: 'Quitar', 'aria-label': 'Quitar',
              onclick: () => { m.abilities.splice(i, 1); changed(true); } }, '✕')),
          h('textarea', { class: 'input', rows: 2, value: a.text, placeholder: 'Qué hace…', oninput: e => { a.text = e.target.value; changed(); } }))),
        h('button', { type: 'button', class: 'btn small', style: { alignSelf: 'flex-start' },
          onclick: () => { m.abilities.push({ name: '', text: '' }); changed(true); } }, '+ Habilidad especial')),
      field('Tesoro (detalle)', area('treasureText', { rows: 2, placeholder: 'Qué llevan encima o qué guardan en la guarida' })));
  }

  function backSide() {
    return group('Descripción y notas (reverso)', 'Admite **negrita** y *cursiva*.',
      field('Descripción', area('description', { rows: 4, placeholder: 'Aspecto, costumbres, dónde se encuentra…' })),
      field('Notas del DJ', area('notes', { rows: 3, placeholder: 'Tácticas, ganchos, recordatorios…' })));
  }

  // ---------- montaje ----------
  const form = h('div', { class: 'editor-form' });
  function renderForm() {
    const y = window.scrollY;
    autoRefs.length = 0;
    form.replaceChildren(pastePanel(), identity(), stats(), saves(), combat(), backSide());
    window.scrollTo(0, y);
  }

  async function duplicate() {
    await save.flush();
    const copy = { ...structuredClone(m), id: uid(), name: `${m.name} (copia)`, createdAt: Date.now() };
    await putCard(copy);
    toast('Duplicado');
    location.hash = `#/edit/${copy.id}`;
  }
  async function remove() {
    if (!(await confirmDialog('Borrar monstruo', `Se borrará «${m.name}» del bestiario y de todos sus mazos. No se puede deshacer.`))) return;
    save.cancel();
    m = null;
    await deleteCard(id);
    await purgeMonsters([id]);
    toast('Borrado');
    location.hash = '#/';
  }

  root.append(
    h('div', { class: 'toolbar' },
      h('a', { class: 'btn', href: '#/' }, '← Bestiario'),
      h('span', { class: 'grow' }, savedEl),
      h('button', { class: 'btn', onclick: duplicate }, 'Duplicar'),
      h('button', { class: 'btn danger', onclick: remove }, 'Borrar')),
    h('div', { class: 'editor' }, form, preview));

  renderForm();
  requestAnimationFrame(renderPreview);
  const onResize = debounce(() => m && renderPreview(), 150);
  window.addEventListener('resize', onResize);

  return async () => {
    window.removeEventListener('resize', onResize);
    if (m) await save.flush();
  };
}
