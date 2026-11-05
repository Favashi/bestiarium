import { getAllCards, putCards, deleteCard, getMeta, setMeta } from '../store.js';
import { exportJSON, parseImport, mergeDecks } from '../io.js';
import { getDecks, saveDecks, newDeck, setCount } from '../decks.js';
import { sampleMonsters } from '../samples.js';
import { pickFile } from '../image.js';
import { h, toast, download, confirmDialog } from '../ui.js';
import { state } from '../state.js';
import { openTutorial } from '../tutorial.js';
import { track, optedOut, setEnabled } from '../analytics.js';

export async function settingsView(root) {
  const storageInfo = h('p', { class: 'muted' }, '');

  async function doExport() {
    const list = await getAllCards();
    download(`bestiarium-${new Date().toISOString().slice(0, 10)}.json`, exportJSON(list, await getDecks()));
    await setMeta('lastBackup', Date.now());
    track('exportar', 'Exportar copia');
    toast(`${list.length} monstruos exportados`);
  }

  async function doImport() {
    const file = await pickFile('application/json,.json');
    if (!file) return;
    try {
      const { monsters, decks } = parseImport(await file.text());
      await putCards(monsters);
      track('importar', 'Importar copia');
      if (decks.length) await saveDecks(mergeDecks(await getDecks(), decks));
      toast(`${monsters.length} monstruos${decks.length ? ` y ${decks.length} mazo(s)` : ''} importados`);
    } catch (e) {
      toast(`No se pudo importar: ${e.message}`, 4000);
    }
  }

  async function addSamples() {
    const samples = sampleMonsters();
    await putCards(samples);
    const decks = await getDecks();
    let deck = decks.find(d => d.name === 'Ejemplos');
    if (!deck) { deck = newDeck('Ejemplos'); decks.push(deck); }
    samples.forEach(m => setCount(deck, m.id, 1));
    await saveDecks(decks);
    toast('Ejemplos añadidos al mazo «Ejemplos»');
  }

  async function wipe() {
    if (!(await confirmDialog('Borrar todo', 'Se borrarán TODOS los monstruos y mazos. Exporta una copia antes. No se puede deshacer.', 'Borrar todo'))) return;
    for (const c of await getAllCards()) await deleteCard(c.id);
    await saveDecks([]);
    state.selection.clear();
    toast('Todo borrado');
  }

  const lastBackup = await getMeta('lastBackup');
  const section = (title, ...children) => h('section', { class: 'group' }, h('header', {}, h('h3', {}, title)), children);

  root.append(h('div', { class: 'settings' },
    h('h2', { class: 'view-title' }, 'Ajustes'),
    section('Tutorial',
      h('p', { class: 'muted' }, 'Un recorrido rápido por cómo crear monstruos, organizar mazos e imprimir.'),
      h('button', { class: 'btn primary', onclick: () => openTutorial() }, 'Ver tutorial')),
    section('Copias de seguridad',
      h('p', { class: 'muted' }, 'Los monstruos y mazos se guardan solo en este dispositivo. Exporta un archivo para pasarlos del móvil al ordenador o para guardar una copia. ',
        lastBackup ? `Última exportación: ${new Date(lastBackup).toLocaleString()}.` : 'Aún no has exportado ninguna copia.'),
      h('div', { class: 'toolbar', style: { margin: 0 } },
        h('button', { class: 'btn primary', onclick: doExport }, 'Exportar todo'),
        h('button', { class: 'btn', onclick: doImport }, 'Importar archivo…'),
        h('button', { class: 'btn', onclick: addSamples }, 'Añadir ejemplos'))),
    section('Uso sin conexión',
      h('p', { class: 'muted' }, 'Tras abrirla una vez con conexión, la app funciona sin internet. Para instalarla: en Android/Chrome, menú ⋮ → «Instalar aplicación»; en iPhone/Safari, Compartir → «Añadir a pantalla de inicio».'),
      storageInfo),
    section('Estadísticas anónimas',
      h('p', { class: 'muted' }, 'Bestiarium cuenta las visitas y algunas acciones (crear monstruo, imprimir…) con GoatCounter: sin cookies, sin datos personales y sin enviar el contenido de tus cartas. Sirve para saber si la app se usa y desde dónde llegan las visitas.'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !optedOut(),
        onchange: e => { setEnabled(e.target.checked); toast(e.target.checked ? 'Estadísticas activadas' : 'Estadísticas desactivadas en este navegador'); } }),
        'Enviar estadísticas anónimas desde este navegador')),
    section('Créditos', h('p', { class: 'muted' }, 'Autoría, tipografías y avisos legales.'), h('a', { class: 'btn', href: '#/credits', style: { alignSelf: 'flex-start' } }, 'Ver créditos')),
    section('Zona peligrosa', h('button', { class: 'btn danger', onclick: wipe }, 'Borrar todos los monstruos y mazos'))));

  try {
    const est = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    storageInfo.textContent = `Espacio usado: ${(est.usage / 1048576).toFixed(1)} MB · ${persisted ? 'almacenamiento persistente' : 'almacenamiento no persistente: exporta copias de vez en cuando'}.`;
  } catch { /* sin soporte */ }
}
