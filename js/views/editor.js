import { getCard, putCard, deleteCard } from '../store.js';
import { getDecks, saveDecks, newDeck, countIn, setCount, purgeMonsters } from '../decks.js';
import { CARD, ALIGNMENTS, SAVE_KEYS, SAVE_LABELS, SYSTEMS, MB_DECOS, derived, uid, isMB } from '../model.js';
import { renderFront, renderBack } from '../render.js';
import { parseStatBlock, parseMBStatBlock } from '../parse.js';
import { fitWhenReady } from '../fit.js';
import { fileToDataURL, pickFile } from '../image.js';
import { h, icon, scaled, toast, debounce, askText, confirmDialog } from '../ui.js';
import { track } from '../analytics.js';
import { applyTheme } from '../theme.js';

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
    const mb = isMB(m);
    const ta = h('textarea', { class: 'input mono', rows: 6, placeholder: mb
      ? 'Perro de la plaga\nVida 5  Moral 9  Armadura -d2\nMordisco d6\nEspecial: contagia la plaga (DR12).\n\n— o en inglés —\nGOBLIN HP 6, Morale 7, no armor, scimitar d4. Special: …'
      : 'Trasgo\nAC 6 [13], HD 1-1 (3hp), Att 1 × weapon (1d6), THAC0 19 [0], MV 60\' (20\'), SV D14 W15 P16 B17 S18 (NH), ML 7, AL Chaotic, XP 5, NA 2d4 (6d10), TT R\n▶ Infravisión: 18 m.\n\n— o en castellano —\nClase de armadura: 6\nDados de golpe: 1-1\nMovimiento: 18 metros…' });
    const panel = h('details', { class: 'group paste' },
      h('summary', {}, h('h3', {}, 'Pegar bloque de estadísticas'), h('span', { class: 'hint' }, mb ? 'Mörk Borg (castellano o inglés)' : 'OSE o Marca del Este')),
      h('div', { class: 'stack' }, ta,
        h('div', { class: 'toolbar', style: { margin: 0 } },
          h('button', { type: 'button', class: 'btn primary small', onclick: () => {
            const p = mb ? parseMBStatBlock(ta.value) : parseStatBlock(ta.value);
            if (!p) { toast(mb ? 'No he reconocido ningún dato (Vida, Moral, Armadura…)' : 'No he reconocido ningún dato (CA, DG, Moral…)', 3500); return; }
            const { saves, abilities, ...rest } = p;
            Object.assign(m, rest);
            if (saves) m.saves = { ...m.saves, ...saves };
            if (abilities && abilities.length) m.abilities = abilities;
            ta.value = '';
            toast('Datos rellenados. Revisa el resultado.');
            track('pegar-bloque', 'Pegar bloque de estadísticas');
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
          track('nuevo-mazo', 'Nuevo mazo');
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
    const alignSeg = h('div', { class: 'seg seg-fill' }, ALIGNMENTS.map(a => h('button', { type: 'button', class: m.alignment === a ? 'on' : '',
      onclick: () => { m.alignment = m.alignment === a ? '' : a; changed(true); } }, a)));
    const prev = h('div', { class: 'img-prev', style: m.image ? { backgroundImage: `url(${m.image})` } : {} });
    const upload = async () => {
      const file = await pickFile();
      if (!file) return;
      try { m.image = await fileToDataURL(file, 1000); changed(true); } catch (e) { toast(e.message); }
    };
    // Las barras solo recolocan la ilustración ya dibujada: sin redibujar ni reajustar la carta
    const slider = (label, key, min, max, step) => field(label, h('input', { type: 'range', min, max, step, value: m[key],
      oninput: e => {
        m[key] = Number(e.target.value);
        savedEl.textContent = 'Guardando…';
        save();
        const x = m.imageX ?? 50, y = m.imageY ?? 50, z = m.imageZoom ?? 1;
        preview.querySelectorAll('.portrait img').forEach(img => {
          img.style.objectPosition = `${x}% ${y}%`;
          img.style.transformOrigin = `${x}% ${y}%`;
          img.style.transform = `scale(${z})`;
        });
      } }));

    const mb = isMB(m);
    applyTheme(mb ? 'mb' : 'classic'); // mientras se edita, la app adopta el tema del sistema del monstruo
    const systemSeg = h('div', { class: 'seg seg-fill seg-system' }, Object.entries(SYSTEMS).map(([k, label]) =>
      h('button', { type: 'button', class: (m.system || 'ose') === k ? 'on' : '', 'aria-pressed': (m.system || 'ose') === k ? 'true' : 'false',
        onclick: () => {
          if ((m.system || 'ose') === k) return;
          if (k === 'mb' && !String(m.hp).trim()) m.hp = String(derived(m).hp || '');
          m.system = k;
          track(`sistema-${k}`, `Sistema ${label}`);
          changed(true);
        } }, label)));
    return group('Identidad', null,
      field('Sistema de juego', systemSeg),
      h('div', { class: 'grid2' },
        field('Nombre', text('name'), { wide: true }),
        field('Tipo', text('kind', { placeholder: mb ? 'Bestia, no muerto, culto…' : 'Humanoide, no muerto…' }), { wide: mb }),
        mb ? null : field('Alineamiento', alignSeg)),
      field('Mazos', deckChips()),
      h('div', { class: 'img-row' }, prev,
        h('div', { class: 'stack', style: { flex: 1 } },
          h('div', { class: 'toolbar', style: { margin: 0 } },
            h('button', { type: 'button', class: 'btn small', onclick: upload }, m.image ? 'Cambiar ilustración' : 'Subir ilustración'),
            m.image ? h('button', { type: 'button', class: 'btn small danger', onclick: () => { m.image = null; changed(true); } }, 'Quitar') : null),
          m.image ? h('div', { class: 'grid3' }, slider('Horizontal', 'imageX', 0, 100, 1), slider('Vertical', 'imageY', 0, 100, 1), slider('Zoom', 'imageZoom', 1, 3, 0.05))
            : h('p', { class: 'hint' }, 'Mejor dibujos a línea en blanco y negro (PNG con fondo transparente o blanco).'),
          mb ? null : h('label', { class: 'check' },
            h('input', { type: 'checkbox', checked: !!m.frame, onchange: e => { m.frame = e.target.checked; changed(); } }),
            'Marco OSR alrededor de la ilustración'))),
      mb ? mbLookFields() : null);
  }

  /** Aspecto de la carta MÖRK BORG: papel, marco y decoración de fondo. */
  function mbLookFields() {
    const seg = (key, options, fallback) => h('div', { class: `seg ${Object.keys(options).length > 3 ? 'seg-grid' : 'seg-fill'}` }, Object.entries(options).map(([k, label]) => {
      const on = (m[key] in options ? m[key] : fallback) === k;
      return h('button', { type: 'button', class: on ? 'on' : '', 'aria-pressed': on ? 'true' : 'false',
        onclick: () => { if (!on) { m[key] = k; changed(true); } } }, label);
    }));
    return h('div', { class: 'stack' },
      field('Papel', seg('mbPaper', { white: 'Blanco', yellow: 'Amarillo' }, 'white')),
      field('Decoración de fondo', seg('mbDeco', MB_DECOS, 'initial')),
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: !!m.frame, onchange: e => { m.frame = e.target.checked; changed(); } }),
        'Marco alrededor de la carta'));
  }

  function mbStats() {
    return group('Estadísticas', 'Como en el libro: Vida, Moral, Armadura y ataques con su dado de daño.',
      h('div', { class: 'grid4' },
        field('Vida', text('hp', { inputmode: 'numeric', placeholder: '6' })),
        field('Moral', text('morale', { inputmode: 'numeric', placeholder: '7' })),
        field('Armadura', text('armor', { placeholder: '-d2 (vacío = ninguna)' }), { wide: true }),
        field('Ataques', text('attacks', { placeholder: 'Garras d6, Mordisco d8' }), { wide: true }),
        field('Aparecen', text('appearing', { placeholder: 'd4' }), { wide: true })),
      hpOption());
  }

  function stats() {
    if (isMB(m)) return mbStats();
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
          h('b', {}, isMB(m) ? 'Casillas para marcar la vida' : 'Casillas para marcar PG'),
          h('small', {}, m.hpBoxes
            ? (isMB(m) ? 'Van en el anverso. Lo especial y el botín pasan al reverso.' : 'Van bajo el nombre, en el anverso. Las habilidades y el tesoro pasan al reverso.')
            : (isMB(m) ? 'Añade casillas en el anverso para tachar la vida durante el combate.' : 'Añade casillas en el anverso para tachar los PG durante el combate.'))),
        h('input', { type: 'checkbox', class: 'switch', role: 'switch', checked: !!m.hpBoxes,
          onchange: e => { m.hpBoxes = e.target.checked; changed(true); } })),
      m.hpBoxes ? h('div', { class: 'toggle-extra' },
        h('span', {}, 'Criaturas'),
        h('div', { class: 'stepper' },
          h('button', { type: 'button', class: 'btn icon small', 'aria-label': 'Menos', disabled: count <= 1, onclick: () => setCount(count - 1) }, icon('minus')),
          h('output', {}, String(count)),
          h('button', { type: 'button', class: 'btn icon small', 'aria-label': 'Más', disabled: count >= 12, onclick: () => setCount(count + 1) }, icon('plus'))),
        h('span', { class: 'hint' }, `${derived(m).hp || '?'} casillas por criatura`)) : null);
  }

  function saves() {
    if (isMB(m)) return null;
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
    const mb = isMB(m);
    return group(mb ? (m.hpBoxes ? 'Especial y botín (reverso)' : 'Especial y botín (anverso)') : (m.hpBoxes ? 'Habilidades y tesoro (reverso)' : 'Combate (anverso)'),
      m.hpBoxes ? `Están en el reverso porque has activado las casillas de ${mb ? 'vida' : 'PG'} (en Estadísticas).`
        : `Van en el anverso. Si activas las casillas de ${mb ? 'vida' : 'PG'} en Estadísticas, pasan al reverso.`,
      h('div', { class: 'stack' },
        m.abilities.map((a, i) => h('div', { class: 'ability' },
          h('div', { class: 'ability-head' },
            h('input', { class: 'input', value: a.name, placeholder: 'Nombre (p. ej. Infravisión)', oninput: e => { a.name = e.target.value; changed(); } }),
            h('button', { type: 'button', class: 'btn icon small', title: 'Subir', 'aria-label': 'Subir', disabled: i === 0,
              onclick: () => { [m.abilities[i - 1], m.abilities[i]] = [m.abilities[i], m.abilities[i - 1]]; changed(true); } }, icon('up')),
            h('button', { type: 'button', class: 'btn icon small danger', title: 'Quitar', 'aria-label': 'Quitar',
              onclick: () => { m.abilities.splice(i, 1); changed(true); } }, icon('x'))),
          h('textarea', { class: 'input', rows: 2, value: a.text, placeholder: 'Qué hace…', oninput: e => { a.text = e.target.value; changed(); } }))),
        h('button', { type: 'button', class: 'btn small', style: { alignSelf: 'flex-start' },
          onclick: () => { m.abilities.push({ name: '', text: '' }); changed(true); } }, mb ? '+ Especial' : '+ Habilidad especial')),
      field(mb ? 'Botín' : 'Tesoro (detalle)', area('treasureText', { rows: 2, placeholder: mb ? 'Un diente podrido. Vale 2s para un herbolario.' : 'Qué llevan encima o qué guardan en la guarida' })));
  }

  function backSide() {
    return group('Descripción y notas (reverso)', 'Admite **negrita** y *cursiva*.',
      field('Descripción', area('description', { rows: 4, placeholder: 'Aspecto, costumbres, dónde se encuentra…' })),
      field(isMB(m) ? 'Notas' : 'Notas del DJ', area('notes', { rows: 3, placeholder: 'Tácticas, ganchos, recordatorios…' })));
  }

  // ---------- montaje ----------
  const form = h('div', { class: 'editor-form' });
  function renderForm() {
    const y = window.scrollY;
    autoRefs.length = 0;
    form.replaceChildren(...[pastePanel(), identity(), stats(), saves(), combat(), backSide()].filter(Boolean));
    form.querySelectorAll('textarea').forEach(growArea);
    window.scrollTo(0, y);
  }
  // Las cajas de texto crecen con su contenido (en el móvil se cortaba el texto)
  function growArea(ta) {
    if (!ta.isConnected) return;
    ta.style.height = 'auto';
    if (ta.scrollHeight) ta.style.height = `${ta.scrollHeight + 4}px`;
  }
  form.addEventListener('input', e => { if (e.target.tagName === 'TEXTAREA') growArea(e.target); });
  form.addEventListener('toggle', () => form.querySelectorAll('textarea').forEach(growArea), true);

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
    h('div', { class: 'toolbar editor-bar' },
      h('a', { class: 'btn', href: '#/' }, icon('left'), 'Bestiario'),
      h('span', { class: 'grow status' }, savedEl),
      h('button', { class: 'btn', onclick: duplicate }, 'Duplicar'),
      h('button', { class: 'btn danger', onclick: remove }, 'Borrar')),
    h('div', { class: 'editor' }, form, preview));

  renderForm();
  requestAnimationFrame(renderPreview);
  const onResize = debounce(() => { if (!m) return; renderPreview(); form.querySelectorAll('textarea').forEach(growArea); }, 150);
  window.addEventListener('resize', onResize);

  return async () => {
    window.removeEventListener('resize', onResize);
    if (m) await save.flush();
  };
}
