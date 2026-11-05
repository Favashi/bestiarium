// Convierte un bloque de estadísticas pegado (OSE en inglés o Marca del Este en castellano)
// en campos del monstruo. Es tolerante: lo que no reconoce lo deja como descripción.

const FIELDS = [
  { key: 'ac', names: ['Clase de armadura', 'CA', 'AC'] },
  { key: 'hd', names: ['Dados de golpe', 'DG', 'HD'] },
  { key: 'attacks', names: ['Ataques', 'Ataque', 'Att', 'Attacks'] },
  { key: 'damage', names: ['Daño', 'Damage'] },
  { key: 'thac0', names: ['THAC0', 'TAC0', 'TACO'] },
  { key: 'move', names: ['Movimiento', 'MOV', 'MV'] },
  { key: 'saves', names: ['Tiradas de salvación', 'Salvaciones', 'Salvación', 'Salva como', 'TS', 'SV'] },
  { key: 'morale', names: ['Moral', 'ML'] },
  { key: 'alignment', names: ['Alineamiento', 'AL'] },
  { key: 'xp', names: ['Valor de PX', 'Valor PX', 'PX', 'XP'] },
  { key: 'appearing', names: ['Número de aparición', 'Nº de aparición', 'Nº aparición', 'Número', 'Nº', 'NA'] },
  { key: 'treasure', names: ['Tipo de tesoro', 'Valor del tesoro', 'Tesoro', 'TT'] },
];

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Cada etiqueta: precedida de inicio/separador y seguida de ":" o espacio.
const ALL = FIELDS.flatMap(f => f.names.map(n => ({ key: f.key, name: n }))).sort((a, b) => b.name.length - a.name.length);
const KEY_RE = new RegExp(`(^|[\\s,;.(])(${ALL.map(a => escRe(a.name)).join('|')})(?=\\s*[:\\s\\d(\\-−])`, 'gu');

const ALIGN = { chaotic: 'Caótico', lawful: 'Legal', neutral: 'Neutral', 'caótico': 'Caótico', caotico: 'Caótico', legal: 'Legal' };

function clean(v) { return v.replace(/^[\s:]+|[\s,;.]+$/g, '').replace(/\s+/g, ' ').trim(); }

export function parseStatBlock(text) {
  const out = {};
  const lines = String(text).replace(/\r/g, '').split('\n').map(l => l.trim());

  // Localiza etiquetas en todo el texto
  const flat = lines.join('\n');
  const hits = [];
  let m;
  KEY_RE.lastIndex = 0;
  while ((m = KEY_RE.exec(flat))) {
    const name = m[2];
    const def = ALL.find(a => a.name === name);
    hits.push({ key: def.key, start: m.index + m[1].length, valueStart: m.index + m[0].length });
  }
  if (!hits.length) return null;

  // Línea de cada etiqueta; el bloque son las líneas consecutivas con etiquetas
  const lineStart = [];
  lines.reduce((pos, l) => { lineStart.push(pos); return pos + l.length + 1; }, 0);
  const lineOf = pos => { let i = 0; while (i + 1 < lineStart.length && lineStart[i + 1] <= pos) i++; return i; };
  const hitLines = new Set(hits.map(h => lineOf(h.start)));
  const first = lineOf(hits[0].start);
  let lastLine = first;
  while (hitLines.has(lastLine + 1)) lastLine++;
  const blockEnd = lineStart[lastLine] + lines[lastLine].length;
  hits.splice(0, hits.length, ...hits.filter(h => h.start < blockEnd));

  // Nombre: última línea no vacía antes del bloque
  const before = lines.slice(0, first).filter(Boolean);
  if (before.length) out.name = before[0].replace(/[:.]$/, '');
  if (before.length > 1) out.description = before.slice(1).join(' ');

  hits.forEach((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].start : blockEnd;
    const raw = clean(flat.slice(h.valueStart, end));
    if (!raw || out[h.key] !== undefined) return;
    out[h.key] = raw;
  });

  // Normalizaciones
  if (out.ac) out.ac = (out.ac.match(/-?\d+/) || [out.ac])[0];
  if (out.hd) {
    const hp = out.hd.match(/\((\d+)\s*(?:hp|pg|pv)?\)/i);
    if (hp) out.hp = hp[1];
    out.hd = (out.hd.match(/^[\d/½]+(?:\s*[+-]\s*\d+)?\**/) || [out.hd])[0].replace(/\s+/g, '');
  }
  if (out.thac0) out.thac0 = (out.thac0.match(/\d+/) || [''])[0];
  if (out.xp) out.xp = (out.xp.replace(/[.,](?=\d{3})/g, '').match(/\d+/) || [out.xp])[0];
  if (out.damage) { out.attacks = out.attacks ? `${out.attacks} (${out.damage})` : out.damage; delete out.damage; }
  if (out.alignment) {
    const a = ALIGN[out.alignment.toLowerCase().split(/[\s/]/)[0]];
    if (a) out.alignment = a;
  }
  if (out.saves && typeof out.saves === 'string') {
    const s = out.saves;
    const map = { D: 'd', M: 'd', W: 'w', V: 'w', P: 'p', B: 'b', A: 'b', S: 's', C: 's' };
    const pairs = [...s.matchAll(/\b([DMWVPBACS])\s*(\d{1,2})\b/g)];
    const saves = {};
    pairs.forEach(([, l, v]) => { const k = map[l]; if (k && !saves[k]) saves[k] = v; });
    const as = s.match(/\b(?:como\s+)?(G|F|E|C|M|L|HN|NH)\s?(\d+)?\b(?!\s*\d)/i);
    const lvl = s.match(/\((?:[GF])?\s*(\d+|NH|HN)\)/i);
    out.saveAs = lvl ? (/\d/.test(lvl[1]) ? `G${lvl[1]}` : 'HN') : (!pairs.length && as ? `${as[1].toUpperCase()}${as[2] || ''}` : '');
    out.saves = saves;
  }

  // Después del bloque: descripción y habilidades (líneas con ▶, •, -, * o "Nombre: texto")
  const rest = flat.slice(blockEnd).split('\n').map(l => l.trim()).filter(Boolean);
  const abilities = [];
  const desc = [];
  for (const l of rest) {
    const bullet = l.match(/^[▶►•\-*–]\s*(.+)$/);
    const body = bullet ? bullet[1] : l;
    const named = body.match(/^([^:.]{2,40})[:.]\s+(.+)$/);
    if (bullet && named) abilities.push({ name: named[1], text: named[2] });
    else if (bullet) abilities.push({ name: '', text: body });
    else if (abilities.length) abilities[abilities.length - 1].text += ` ${l}`;
    else desc.push(l);
  }
  if (desc.length) out.description = [out.description, ...desc].filter(Boolean).join(' ');
  if (abilities.length) out.abilities = abilities;
  return out;
}
