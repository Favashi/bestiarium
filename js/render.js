// Renderizado de la carta de monstruo (tarot, blanco y negro). Medidas físicas en mm.
import { CARD, SAVE_KEYS, SAVE_LABELS, derived } from './model.js';

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Markdown mínimo: **negrita**, *cursiva*, saltos de línea. */
export function md(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\n/g, '<br>');
}

const has = v => v !== undefined && v !== null && String(v).trim() !== '';
const row = (label, value) => has(value) ? `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>` : '';

function shell(side, inner) {
  return `<div class="card card-${side}" style="--w:${CARD.w}mm;--h:${CARD.h}mm">${inner}</div>`;
}

function portrait(m) {
  if (m.image) {
    const x = m.imageX ?? 50, y = m.imageY ?? 50, z = m.imageZoom ?? 1;
    return `<img src="${m.image}" alt="" draggable="false" style="object-position:${x}% ${y}%;transform:scale(${z});transform-origin:${x}% ${y}%">`;
  }
  const initial = esc((m.name || '?').trim().charAt(0).toUpperCase());
  return `<div class="ph"><span>${initial}</span></div>`;
}

// Ornamentos del marco: cantoneras y rombos a mitad de lado (SVG pequeño, no se deforma)
const CORNER = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="3" width="34" height="34" fill="#fff" stroke="#111" stroke-width="4"/><rect x="11" y="11" width="18" height="18" fill="none" stroke="#111" stroke-width="2"/><path d="M20 13 L27 20 L20 27 L13 20 Z" fill="#111"/></svg>`;
const DIAMOND = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 L38 20 L20 38 L2 20 Z" fill="#fff" stroke="#111" stroke-width="4"/><path d="M20 12 L28 20 L20 28 L12 20 Z" fill="#111"/></svg>`;

function frameOrnaments() {
  return ['tl', 'tr', 'bl', 'br'].map(c => `<span class="orn corner ${c}">${CORNER}</span>`).join('') +
    ['t', 'b', 'l', 'r'].map(c => `<span class="orn mid ${c}">${DIAMOND}</span>`).join('');
}

// Medidas del registro de PG (mm). Deben coincidir con cards.css.
const HP = { width: 70 - 2 * 3.5, box: 3, gap: 0.6, groupGap: 1.6, label: 4.2, colGap: 3 };
const groupW = k => k * HP.box + (k - 1) * HP.gap;
/** Líneas que ocupa un bloque de n casillas en un ancho dado (los grupos de 5 no se parten). */
function blockLines(n, area) {
  const groups = [];
  for (let i = 0; i < n; i += 5) groups.push(groupW(Math.min(5, n - i)));
  let lines = 1, used = 0;
  for (const w of groups) {
    const need = used ? used + HP.groupGap + w : w;
    if (need <= area || !used) used = need;
    else { lines++; used = w; }
  }
  return lines;
}
/** Columnas para los bloques: la opción de menor altura total; si empatan, la de más columnas. */
function hpColumns(n, rows) {
  let best = 1, bestH = Infinity;
  for (const c of [1, 2, 3]) {
    if (c > rows) break;
    const colW = (HP.width - (c - 1) * HP.colGap) / c;
    const area = colW - (rows > 1 ? HP.label : 0);
    if (area < groupW(Math.min(5, n))) continue; // ni un grupo cabe
    const lines = blockLines(n, area);
    const height = Math.ceil(rows / c) * (lines * (HP.box + 0.9) + 1.4);
    if (height <= bestH) { best = c; bestH = height; }
  }
  return best;
}

function hpTrack(m, hp) {
  const n = Math.min(120, parseInt(hp, 10) || 0);
  if (!m.hpBoxes || n <= 0) return '';
  const rows = Math.max(1, Math.min(12, parseInt(m.hpRows, 10) || 1));
  const cols = hpColumns(n, rows);
  const groups = [];
  for (let i = 0; i < n; i += 5) groups.push(`<span class="grp">${'<i></i>'.repeat(Math.min(5, n - i))}</span>`);
  const boxes = groups.join('');
  const blocks = Array.from({ length: rows }, (_, r) =>
    `<div class="hp-row">${rows > 1 ? `<span class="hp-n">${r + 1}</span>` : ''}<div class="hp-boxes">${boxes}</div></div>`).join('');
  return `<div class="hp-track"><h3 class="sec">Puntos de golpe${rows > 1 ? ` <small>· ${rows} criaturas</small>` : ''}</h3><div class="hp-grid" style="--hp-cols:${cols}">${blocks}</div></div>`;
}

/** Separa "2 × garras (1d4), 1 × mordisco (1d8)" en ataques, respetando paréntesis. */
export function splitAttacks(text) {
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of String(text || '')) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';' || ch === '\n') && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts.map(p => p.trim()).filter(Boolean).map(p => {
    const mt = p.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    return mt ? { what: mt[1], dmg: mt[2] } : { what: p, dmg: '' };
  });
}

function attacksHTML(text) {
  const list = splitAttacks(text);
  if (!list.length) return '';
  return `<section class="attacks"><h3 class="sec">Ataques</h3>${list.map(a =>
    `<div class="atk"><span class="atk-what">${md(a.what)}</span>${a.dmg ? `<span class="atk-dmg">${esc(a.dmg)}</span>` : ''}</div>`).join('')}</section>`;
}

/** Habilidades especiales y tesoro: en el anverso, o en el reverso si el anverso lleva casillas de PG. */
function combatExtras(m) {
  const abilities = entriesHTML(m.abilities);
  return (abilities ? `<section><h3 class="sec">Habilidades especiales</h3>${abilities}</section>` : '') +
    (has(m.treasureText) ? `<section><h3 class="sec">Tesoro</h3><p>${md(m.treasureText)}</p></section>` : '');
}

function entriesHTML(list) {
  return list.filter(a => has(a.name) || has(a.text)).map(a =>
    `<p class="entry">${has(a.name) ? `<b>${md(a.name.trim().replace(/[.:]$/, ''))}:</b> ` : ''}${md(a.text)}</p>`).join('');
}

export function renderFront(m) {
  const d = derived(m);
  const subtitle = [m.alignment, m.kind].filter(has).join(' · ');
  const saves = SAVE_KEYS.map(k => row(SAVE_LABELS[k].short, d.saves[k])).join('');
  const track = hpTrack(m, d.hp);
  return shell('front', `
    <div class="top">
      <div class="col-left">
        <h3 class="sec">Combate</h3>
        <dl>
          ${row('CA', d.ac)}${row('DG', m.hd)}${row('PG', d.hp)}${row('TAC0', d.thac0)}
          ${row('MOV', m.move)}${row('MOR', m.morale)}
        </dl>
      </div>
      <div class="portrait${m.frame ? ' framed' : ''}"><div class="pimg">${portrait(m)}</div>${m.frame ? frameOrnaments() : ''}</div>
      <div class="col-right">
        <h3 class="sec">Salvación</h3>
        <dl class="saves">${saves}</dl>
        ${has(d.saveAs) ? `<p class="save-as">como ${esc(d.saveAs)}</p>` : ''}
        <h3 class="sec">Encuentro</h3>
        <dl class="enc">${row('Nº', m.appearing)}${row('PX', d.xp)}${row('TES', m.treasure)}</dl>
      </div>
    </div>
    <div class="title">${subtitle ? `<p>${esc(subtitle)}</p>` : ''}<h1>${esc(m.name)}</h1></div>
    ${track}
    <div class="body fit">
      ${attacksHTML(m.attacks)}
      ${track ? '' : combatExtras(m)}
    </div>`);
}

export function renderBack(m) {
  return shell('back', `
    <header class="back-head">${[m.alignment, m.kind].filter(has).length ? `<p>${esc([m.alignment, m.kind].filter(has).join(' · '))}</p>` : ''}<h2>${esc(m.name)}</h2></header>
    <div class="fit back-body">
      ${hpTrack(m, derived(m).hp) ? combatExtras(m) : ''}
      ${has(m.description) ? `<section><h3 class="sec">Descripción</h3><p>${md(m.description)}</p></section>` : ''}
      ${has(m.notes) ? `<section><h3 class="sec">Notas del DJ</h3><p>${md(m.notes)}</p></section>` : ''}
    </div>`);
}

export function renderFace(m, side = 'front') {
  return side === 'back' ? renderBack(m) : renderFront(m);
}
