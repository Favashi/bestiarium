// Modelo de monstruo al estilo Old-School Essentials / Aventuras en la Marca del Este,
// con las tablas B/X para calcular TAC0, salvaciones, PX y PG medios a partir de los DG.

export const CARD = { w: 70, h: 120 }; // tamaño tarot, mm

export const SAVE_KEYS = ['d', 'w', 'p', 'b', 's'];
export const SAVE_LABELS = {
  d: { short: 'M', long: 'Muerte / veneno' },
  w: { short: 'V', long: 'Varitas' },
  p: { short: 'P', long: 'Parálisis / petrificación' },
  b: { short: 'A', long: 'Aliento' },
  s: { short: 'S', long: 'Sortilegios / bastones' },
};

/** Decoraciones de fondo de las cartas MÖRK BORG (dibujos propios, no el logotipo). */
export const MB_DECOS = { none: 'Ninguna', initial: 'Inicial', skull: 'Calavera', tally: 'Tachones', splatter: 'Manchas' };

export const ALIGNMENTS = ['Legal', 'Neutral', 'Caótico'];

/** Sistemas de juego. 'ose' = Old-School Essentials / La Marca del Este; 'mb' = MÖRK BORG. */
export const SYSTEMS = { ose: 'OSE / Marca', mb: 'Mörk Borg' };
export const isMB = m => m?.system === 'mb';

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function newMonster(overrides = {}) {
  const now = Date.now();
  return {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    deck: 'General',
    system: 'ose',      // 'ose' | 'mb'
    name: 'Nuevo monstruo',
    alignment: 'Caótico',
    kind: '',
    image: null,
    imageX: 50,
    imageY: 50,
    imageZoom: 1,
    frame: false,       // OSE: marco alrededor de la ilustración · MB: marco alrededor de la carta
    mbPaper: 'white',   // MÖRK BORG: 'white' | 'yellow'
    mbDeco: 'initial',  // MÖRK BORG: decoración de fondo (ver MB_DECOS)
    hpBoxes: false,     // casillas para marcar PG
    hpRows: 1,          // una fila de casillas por cada monstruo
    // Bloque de estadísticas (vacío = calculado automáticamente cuando se puede)
    ac: '',
    armor: '',          // MÖRK BORG: armadura (p. ej. "-d2")
    hd: '1',
    hp: '',
    thac0: '',
    attacks: '',
    move: '',
    morale: '',
    appearing: '',
    xp: '',
    treasure: '',
    saveAs: '',
    saves: { d: '', w: '', p: '', b: '', s: '' },
    // Texto
    description: '',
    abilities: [],      // reverso: [{ name, text }]
    treasureText: '',   // reverso
    notes: '',          // reverso
    ...overrides,
  };
}

export function normalizeMonster(m) {
  const base = newMonster();
  const out = { ...base, ...m };
  out.saves = { ...base.saves, ...(m.saves || {}) };
  out.abilities = Array.isArray(m.abilities) ? m.abilities.map(a => ({ name: a.name || '', text: a.text || '' })) : [];
  return out;
}

// ---------- Dados de golpe ----------

/** "2", "2+1", "1-1", "3**", "1/2", "4+2*" → { n, mod, stars, valid } */
export function parseHD(hd) {
  const s = String(hd ?? '').trim().replace(/\s+/g, '').replace('½', '1/2');
  const m = s.match(/^(\d+(?:\/\d+)?)([+-]\d+)?(\**)/);
  if (!m) return { n: 0, mod: 0, stars: 0, valid: false };
  const n = m[1].includes('/') ? Number(m[1].split('/')[0]) / Number(m[1].split('/')[1]) : Number(m[1]);
  return { n, mod: m[2] ? Number(m[2]) : 0, stars: m[3].length, valid: true };
}

/** Por debajo de 1 DG (incluye 1-1, 1/2…). */
function belowOne({ n, mod }) { return n < 1 || (n === 1 && mod < 0); }

export function calcTHAC0(hd) {
  const p = parseHD(hd);
  if (!p.valid) return null;
  const eff = p.n + (p.mod > 0 ? 0.5 : 0);
  const steps = [[1, 19], [2, 18], [3, 17], [4, 16], [5, 15], [6, 14], [7, 13], [9, 12], [11, 11], [13, 10], [15, 9], [17, 8], [19, 7], [21, 6]];
  for (const [max, t] of steps) if (eff <= max) return t;
  return 5;
}

const SAVE_TABLE = [
  { maxLvl: 0, as: 'HN', v: [14, 15, 16, 17, 18] }, // humano normal
  { maxLvl: 3, v: [12, 13, 14, 15, 16] },
  { maxLvl: 6, v: [10, 11, 12, 13, 14] },
  { maxLvl: 9, v: [8, 9, 10, 10, 12] },
  { maxLvl: 12, v: [6, 7, 8, 8, 10] },
  { maxLvl: Infinity, v: [4, 5, 6, 5, 8] },
];

/** Nivel de guerrero equivalente para las salvaciones ("HN" = humano normal). */
export function calcSaveAs(hd) {
  const p = parseHD(hd);
  if (!p.valid) return null;
  if (belowOne(p)) return 'HN';
  return `G${Math.floor(p.n)}`;
}

/** Acepta "G3", "F3", "3", "HN", "NH". */
export function savesFor(saveAs) {
  const s = String(saveAs ?? '').trim().toUpperCase();
  if (!s) return null;
  if (s === 'HN' || s === 'NH') return SAVE_TABLE[0].v;
  const lvl = parseInt(s.replace(/[^0-9]/g, ''), 10);
  if (Number.isNaN(lvl)) return null;
  return SAVE_TABLE.find(r => lvl <= r.maxLvl && r.maxLvl > 0).v;
}

const XP_TABLE = [
  ['<1', 5, 1], ['1', 10, 3], ['1+', 15, 4], ['2', 20, 5], ['2+', 25, 10], ['3', 35, 15], ['3+', 50, 25],
  ['4', 75, 50], ['4+', 125, 75], ['5', 175, 125], ['5+', 225, 175], ['6', 275, 225], ['6+', 350, 300],
];

export function calcXP(hd) {
  const p = parseHD(hd);
  if (!p.valid) return null;
  let base, bonus;
  if (belowOne(p)) [, base, bonus] = XP_TABLE[0];
  else {
    const n = Math.floor(p.n);
    const key = `${n}${p.mod > 0 ? '+' : ''}`;
    const row = XP_TABLE.find(r => r[0] === key);
    if (row) [, base, bonus] = row;
    else if (n <= 7) [base, bonus] = [450, 400];
    else if (n <= 8) [base, bonus] = [650, 550];
    else if (n <= 10) [base, bonus] = [900, 700];
    else if (n <= 12) [base, bonus] = [1100, 800];
    else if (n <= 16) [base, bonus] = [1350, 950];
    else if (n <= 20) [base, bonus] = [2000, 1150];
    else [base, bonus] = [2500, 2000];
  }
  return base + bonus * p.stars;
}

/** PG medios: d8 por DG (½ DG = 1d4). */
export function calcHP(hd) {
  const p = parseHD(hd);
  if (!p.valid) return null;
  if (p.n < 1) return Math.max(1, Math.round(2.5 * Math.max(p.n * 2, 1)) + p.mod);
  return Math.max(1, Math.round(4.5 * p.n) + p.mod);
}

export function ascendingAC(ac) {
  const n = parseInt(String(ac ?? '').replace('−', '-'), 10);
  return Number.isNaN(n) ? null : 19 - n;
}

export function signed(n) { return n >= 0 ? `+${n}` : `−${Math.abs(n)}`; }

/** Monstruo nuevo de MÖRK BORG (sin DG, alineamiento ni salvaciones). */
export function newMBMonster(overrides = {}) {
  return newMonster({ system: 'mb', alignment: '', hd: '', hp: '6', morale: '7', armor: '', ...overrides });
}

/** Valores efectivos para mostrar (lo escrito o lo calculado). */
export function derived(m) {
  if (isMB(m)) return { ac: '', hp: String(m.hp ?? '').trim(), thac0: '', xp: '', saveAs: '', saves: {} };
  const thac0 = String(m.thac0).trim() !== '' ? parseInt(m.thac0, 10) : calcTHAC0(m.hd);
  const saveAs = String(m.saveAs).trim() || calcSaveAs(m.hd) || '';
  const table = savesFor(saveAs) || [];
  const saves = {};
  SAVE_KEYS.forEach((k, i) => { saves[k] = String(m.saves[k] ?? '').trim() || (table[i] ?? ''); });
  const acAsc = ascendingAC(m.ac);
  return {
    ac: String(m.ac).trim() ? `${m.ac}${acAsc !== null ? ` [${acAsc}]` : ''}` : '',
    hp: String(m.hp).trim() || (calcHP(m.hd) ?? ''),
    thac0: Number.isNaN(thac0) || thac0 === null ? (m.thac0 || '') : `${thac0} [${signed(19 - thac0)}]`,
    xp: String(m.xp).trim() || (calcXP(m.hd) ?? ''),
    saveAs,
    saves,
  };
}
