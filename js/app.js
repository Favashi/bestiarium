import { getMeta, setMeta, putCards, requestPersistence } from './store.js';
import { sampleMonsters } from './samples.js';
import { migrateDecks } from './decks.js';
import { libraryView } from './views/library.js';
import { editorView } from './views/editor.js';
import { printView } from './views/print.js';
import { settingsView } from './views/settings.js';
import { creditsView } from './views/credits.js';
import { CREDITS } from './credits.js';
import { maybeShowTutorial } from './tutorial.js';

const view = document.getElementById('view');
let cleanup = null;

const routes = [
  { re: /^#?\/?$/, nav: 'library', fn: () => libraryView(view) },
  { re: /^#\/edit\/(.+)$/, nav: 'library', fn: m => editorView(view, decodeURIComponent(m[1])) },
  { re: /^#\/print$/, nav: 'print', fn: () => printView(view) },
  { re: /^#\/settings$/, nav: 'settings', fn: () => settingsView(view) },
  { re: /^#\/credits$/, nav: 'credits', fn: () => creditsView(view) },
];

async function route() {
  if (typeof cleanup === 'function') { try { await cleanup(); } catch (e) { console.error(e); } }
  cleanup = null;
  document.getElementById('page-style').textContent = '';
  const hash = location.hash || '#/';
  const r = routes.find(x => x.re.test(hash)) || routes[0];
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === r.nav));
  view.replaceChildren();
  window.scrollTo(0, 0);
  try {
    cleanup = await r.fn(hash.match(r.re));
  } catch (e) {
    console.error(e);
    view.textContent = `Error: ${e.message}`;
  }
}

async function init() {
  const foot = document.getElementById('foot-text');
  if (foot) foot.textContent = `${CREDITS.app} · © ${CREDITS.year} ${CREDITS.author}`;
  if (!(await getMeta('seeded'))) {
    await putCards(sampleMonsters());
    await setMeta('seeded', true);
  }
  await migrateDecks();
  requestPersistence();
  window.addEventListener('hashchange', route);
  await route();
  maybeShowTutorial();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW no registrado', err));
  }
}

init();
