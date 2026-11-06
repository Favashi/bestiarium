// Tema de la interfaz: 'classic' (blanco y negro) o 'mb' (MÖRK BORG: amarillo y negro).
// Se guarda en este navegador; index.html lo aplica antes de pintar para evitar parpadeos.
const KEY = 'bestiarium-theme';

export function getTheme() {
  try { return localStorage.getItem(KEY) === 'mb' ? 'mb' : 'classic'; } catch { return 'classic'; }
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* sin almacenamiento */ }
  applyTheme(theme);
}

export function applyTheme(theme = getTheme()) {
  document.documentElement.dataset.theme = theme;
}

/** Sistema por defecto de los monstruos nuevos: el del tema elegido. */
export const defaultSystem = () => (getTheme() === 'mb' ? 'mb' : 'ose');
