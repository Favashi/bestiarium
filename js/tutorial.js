// Tutorial de bienvenida: pasos en un diálogo. Se muestra la primera vez hasta que se marca «No volver a mostrar».
import { getMeta, setMeta } from './store.js';
import { h } from './ui.js';

const ICON = {
  skull: '<path d="M32 8c13 0 21 9 21 20 0 7-3 11-6 13v6a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3v-6c-3-2-6-6-6-13C11 17 19 8 32 8z"/><circle cx="24.5" cy="30" r="5.5"/><circle cx="39.5" cy="30" r="5.5"/><path d="M32 38l-3 5h6zM24 50v-5M29 50v-5M35 50v-5M40 50v-5"/>',
  quill: '<path d="M48 8C30 12 20 26 16 46l4 2c4-6 10-10 18-12-6-1-10 0-14 2 6-8 14-12 22-12-6-2-12-1-16 1C36 18 42 12 48 8z"/><path d="M14 56l6-10"/><path d="M28 56h22"/>',
  card: '<rect x="12" y="8" width="26" height="42" rx="3"/><rect x="26" y="14" width="26" height="42" rx="3" fill="#fff"/><path d="M31 22h16M31 27h10M31 34h16M31 39h16M31 44h10"/>',
  deck: '<rect x="18" y="16" width="28" height="40" rx="3" transform="rotate(-10 32 36)"/><rect x="18" y="14" width="28" height="40" rx="3" transform="rotate(6 32 34)" fill="#fff"/><rect x="18" y="12" width="28" height="40" rx="3" fill="#fff"/><path d="M28 26l4-4 4 4-4 4zM24 40h16"/>',
  print: '<path d="M18 22V8h28v14M16 46h-6V26a4 4 0 0 1 4-4h36a4 4 0 0 1 4 4v20h-6"/><rect x="18" y="36" width="28" height="20"/><path d="M23 42h18M23 48h12"/>',
  offline: '<path d="M32 8l20 8v14c0 14-9 22-20 26-11-4-20-12-20-26V16z"/><path d="M24 32l6 6 12-12"/>',
};

const STEPS = [
  { icon: 'skull', title: 'Bienvenido a Bestiarium',
    text: ['Crea cartas de monstruos tamaño tarot para **Old-School Essentials** y **Aventuras en la Marca del Este**, con anverso y reverso, listas para imprimir.',
      'Funciona en el móvil y en el ordenador, incluso sin conexión. Este recorrido dura un minuto.'] },
  { icon: 'quill', title: 'Crea un monstruo',
    text: ['Pulsa **+ Nuevo monstruo** en el Bestiario y rellena el formulario. Escribe los **DG** y la app calcula PG, TAC0, salvaciones y PX con las tablas B/X (los campos marcados como *auto*).',
      '¿Lo tienes en un libro o PDF? Usa **Pegar bloque de estadísticas** y se rellenan los campos solos.'] },
  { icon: 'card', title: 'Anverso y reverso',
    text: ['El **anverso** lleva todo lo necesario para el combate: estadísticas, ataques con su daño, habilidades y tesoro.',
      'Activa **Casillas para marcar PG** en Estadísticas para tachar los puntos de golpe de cada criatura; entonces las habilidades pasan al **reverso**, junto a la descripción y tus notas.'] },
  { icon: 'deck', title: 'Organiza tus mazos',
    text: ['Crea un mazo por aventura con **+ Nuevo mazo**. Un monstruo puede estar en varios mazos, y en cada uno decides cuántas **copias** quieres con − / +.',
      'También puedes seleccionar varios monstruos y pulsar **Añadir a mazo…**'] },
  { icon: 'print', title: 'Imprime',
    text: ['En **Imprimir** elige un mazo y ajusta qué cartas y cuántas copias. Caben 4 cartas tarot por hoja A4, con reversos a doble cara.',
      'En el diálogo de impresión usa escala **100 %** y sin márgenes. Desde el móvil puedes **guardar como PDF**.'] },
  { icon: 'offline', title: 'Tus datos, a salvo',
    text: ['Todo se guarda en este dispositivo. **Instala** la app (menú del navegador → Instalar / Añadir a pantalla de inicio) para usarla sin conexión.',
      'Exporta copias de seguridad desde **Ajustes**; ahí también puedes volver a ver este tutorial.'] },
];

function rich(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
}

/** Abre el tutorial. Devuelve una promesa que se resuelve al cerrarlo. */
export function openTutorial({ firstRun = false } = {}) {
  return new Promise(resolve => {
    let i = 0;
    const dlg = h('dialog', { class: 'dlg tut', 'aria-label': 'Tutorial' });
    const stage = h('div', { class: 'tut-stage' });
    const dots = h('div', { class: 'tut-dots' });
    const prev = h('button', { type: 'button', class: 'btn', onclick: () => go(i - 1) }, '← Anterior');
    const next = h('button', { type: 'button', class: 'btn primary', onclick: () => (i < STEPS.length - 1 ? go(i + 1) : close()) });
    const never = h('input', { type: 'checkbox', checked: !firstRun });
    const neverLabel = h('label', { class: 'check tut-never' }, never, 'No volver a mostrar al abrir');

    async function close() {
      await setMeta('tutorialDone', never.checked);
      dlg.close(); dlg.remove(); resolve();
    }
    function go(n) {
      i = Math.max(0, Math.min(STEPS.length - 1, n));
      const s = STEPS[i];
      stage.innerHTML = `
        <div class="tut-icon"><svg viewBox="0 0 64 64" aria-hidden="true">${ICON[s.icon]}</svg></div>
        <p class="tut-step">Paso ${i + 1} de ${STEPS.length}</p>
        <h3>${rich(s.title)}</h3>
        ${s.text.map(t => `<p>${rich(t)}</p>`).join('')}`;
      dots.replaceChildren(...STEPS.map((_, k) => h('button', { type: 'button', class: `tut-dot${k === i ? ' on' : ''}`, 'aria-label': `Paso ${k + 1}`, onclick: () => go(k) })));
      prev.disabled = i === 0;
      next.textContent = i === STEPS.length - 1 ? '¡A jugar!' : 'Siguiente →';
    }

    dlg.append(
      h('header', { class: 'dlg-head' }, h('h2', {}, 'Cómo funciona'),
        h('button', { type: 'button', class: 'dlg-x', 'aria-label': 'Cerrar', onclick: close }, '✕')),
      h('div', { class: 'dlg-body' }, stage, dots),
      h('footer', { class: 'dlg-foot tut-foot' }, neverLabel, h('div', { class: 'tut-nav' }, prev, next)));
    dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
    dlg.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    });
    document.body.append(dlg);
    go(0);
    dlg.showModal();
    next.focus();
  });
}

/** Muestra el tutorial al arrancar si no se ha marcado «No volver a mostrar». */
export async function maybeShowTutorial() {
  if (!(await getMeta('tutorialDone', false))) await openTutorial({ firstRun: true });
}
