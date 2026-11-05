// Estadísticas de visitas anónimas con GoatCounter (sin cookies, sin datos personales).
// Comparte la cuenta de toniruiz.es; todas las rutas van bajo el prefijo "bestiarium/".
// Sin conexión, en localhost o si el usuario lo desactiva en Ajustes, no se envía nada.

const ENDPOINT = 'https://toniruiz.goatcounter.com/count';
const SCRIPT = 'https://gc.zgo.at/count.js';
const PREFIX = 'bestiarium';
const OPT_OUT_KEY = 'skipgc'; // la misma clave que usa GoatCounter para ignorar un navegador

let loading = null;
let firstView = true;

function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storageSet(key, value) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* sin almacenamiento */ } }

/** El usuario ha desactivado las estadísticas en este navegador. */
export function optedOut() { return storageGet(OPT_OUT_KEY) === 't'; }

export function isEnabled() {
  if (optedOut()) return false;
  if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === 'file:') return false;
  return true;
}

export function setEnabled(on) {
  storageSet(OPT_OUT_KEY, on ? null : 't');
}

function load() {
  if (loading) return loading;
  loading = new Promise(resolve => {
    window.goatcounter = { no_onload: true, ...(window.goatcounter || {}) };
    const s = document.createElement('script');
    s.async = true;
    s.src = SCRIPT;
    s.dataset.goatcounter = ENDPOINT;
    s.dataset.goatcounterSettings = JSON.stringify({ no_onload: true });
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false); // sin conexión o bloqueado: se ignora
    document.head.append(s);
  });
  return loading;
}

async function send(data) {
  if (!isEnabled() || !navigator.onLine) return;
  if (!(await load())) return;
  try { window.goatcounter?.count?.(data); } catch { /* nunca romper la app por las estadísticas */ }
}

/** Visita a una pantalla. `name` sin datos personales ni ids (p. ej. "editor"). */
export async function pageview(name, title) {
  await send({ path: `${PREFIX}/${name}`, title: `Bestiarium · ${title || name}` });
  if (firstView) {
    firstView = false;
    // GoatCounter ya ha recogido ?ref= / utm_*; se quitan para no volver a contarlos
    if (/[?&](ref|utm_[a-z]+)=/.test(location.search)) {
      history.replaceState(null, '', location.pathname + location.hash);
    }
  }
}

/** Acción concreta (crear monstruo, imprimir…). */
export function track(event, title) {
  send({ path: `${PREFIX}/evento/${event}`, title: title || event, event: true });
}
