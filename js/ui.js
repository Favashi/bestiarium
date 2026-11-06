// Utilidades de interfaz.

export const MM = 96 / 25.4; // px por mm en CSS

/** Crea elementos: h('div', {class:'x', onclick}, hijo, 'texto'). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const ICONS = {
  minus: 'M3 8h10',
  plus: 'M3 8h10M8 3v10',
  up: 'M8 13.5V3M3.5 7.5 8 3l4.5 4.5',
  left: 'M13.5 8H3M7.5 3.5 3 8l4.5 4.5',
  right: 'M2.5 8H13M8.5 3.5 13 8l-4.5 4.5',
  x: 'M4 4l8 8M12 4l-8 8',
};
/** Icono SVG centrado (los glifos −, +, ↑, ✕ quedaban descentrados con las fuentes de la app). */
export function icon(name) {
  return h('span', { class: 'ico', 'aria-hidden': 'true', html: `<svg viewBox="0 0 16 16"><path d="${ICONS[name]}"/></svg>` });
}

let toastTimer;
export function toast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/**
 * Escala un contenido de tamaño físico (mm) para que quepa en su contenedor.
 * Devuelve el elemento .thumb. Con maxH (px) limita también la altura.
 */
export function scaled(innerHTML, wmm, hmm, { maxH = Infinity, fixedWidth = null } = {}) {
  const thumb = h('div', { class: 'thumb' });
  thumb.innerHTML = innerHTML;
  const child = thumb.firstElementChild;
  const wpx = wmm * MM, hpx = hmm * MM;
  const apply = () => {
    const parentW = fixedWidth ?? (thumb.parentElement ? thumb.parentElement.clientWidth : wpx);
    if (!parentW) return;
    const s = Math.min(parentW / wpx, maxH / hpx);
    thumb.style.width = `${wpx * s}px`;
    thumb.style.height = `${hpx * s}px`;
    if (child) child.style.transform = `scale(${s})`;
  };
  thumb._apply = apply;
  requestAnimationFrame(apply);
  return thumb;
}

/** Re-escala todas las miniaturas dentro de root cuando cambia el tamaño. */
export function watchScale(root) {
  const ro = new ResizeObserver(() => root.querySelectorAll('.thumb').forEach(t => t._apply && t._apply()));
  ro.observe(root);
  return () => ro.disconnect();
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function debounce(fn, ms) {
  let t;
  const d = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  d.flush = (...args) => { clearTimeout(t); return fn(...args); };
  d.cancel = () => clearTimeout(t);
  return d;
}

export function slug(s) {
  return String(s || 'cartas').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cartas';
}

/**
 * Diálogo modal con el estilo de la app.
 * build(body, close) rellena el cuerpo; actions: [{ label, value, primary, danger }].
 * Devuelve una promesa con el value de la acción pulsada (o null si se cierra).
 */
export function dialog({ title, build, actions = [{ label: 'Cerrar', value: null }], wide = false }) {
  return new Promise(resolve => {
    const dlg = h('dialog', { class: `dlg${wide ? ' wide' : ''}` });
    const body = h('div', { class: 'dlg-body' });
    const close = value => { dlg.close(); dlg.remove(); resolve(value); };
    const getValue = () => dlg._value;
    dlg.append(
      h('header', { class: 'dlg-head' }, h('h2', {}, title),
        h('button', { type: 'button', class: 'dlg-x', 'aria-label': 'Cerrar', onclick: () => close(null) }, icon('x'))),
      body,
      h('footer', { class: 'dlg-foot' }, actions.map(a => h('button', {
        type: 'button', class: `btn${a.primary ? ' primary' : ''}${a.danger ? ' danger' : ''}`,
        onclick: () => close(typeof a.value === 'function' ? a.value(getValue) : a.value),
      }, a.label))));
    dlg.addEventListener('cancel', e => { e.preventDefault(); close(null); });
    dlg.addEventListener('click', e => { if (e.target === dlg) close(null); });
    build && build(body, close, v => { dlg._value = v; });
    document.body.append(dlg);
    dlg.showModal();
    const first = body.querySelector('input, textarea, select');
    if (first) setTimeout(() => first.focus(), 30);
  });
}

export function askText(title, label, value = '', okLabel = 'Aceptar') {
  let input;
  return dialog({
    title,
    build: (body, close) => {
      input = h('input', { class: 'input', value, onkeydown: e => { if (e.key === 'Enter') close(input.value.trim() || null); } });
      body.append(h('label', { class: 'field' }, h('span', {}, label), input));
    },
    actions: [{ label: 'Cancelar', value: null }, { label: okLabel, primary: true, value: () => input.value.trim() || null }],
  });
}

export function confirmDialog(title, text, okLabel = 'Borrar', danger = true) {
  return dialog({
    title,
    build: body => body.append(h('p', {}, text)),
    actions: [{ label: 'Cancelar', value: false }, { label: okLabel, primary: !danger, danger, value: true }],
  });
}
