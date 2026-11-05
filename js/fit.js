// Ajusta el tamaño de letra de cada carta para que el texto quepa sin desbordar.

const MAX_FS = 8.5;
const MIN_FS = 4.5;

function overflows(el) {
  return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
}

export function fitCard(cardEl) {
  const target = cardEl.querySelector('.fit');
  if (!target) return;
  let lo = MIN_FS, hi = MAX_FS, best = MIN_FS;
  cardEl.style.setProperty('--fs', `${MAX_FS}pt`);
  if (!overflows(target)) best = MAX_FS;
  else {
    for (let i = 0; i < 9; i++) {
      const mid = (lo + hi) / 2;
      cardEl.style.setProperty('--fs', `${mid}pt`);
      if (overflows(target)) hi = mid; else { best = mid; lo = mid; }
    }
  }
  cardEl.style.setProperty('--fs', `${best.toFixed(2)}pt`);
  cardEl.classList.toggle('overflow', overflows(target));
}

export async function fitWhenReady(root) {
  try { await document.fonts.ready; } catch { /* sin soporte */ }
  await Promise.all([...root.querySelectorAll('.card img')].map(img =>
    img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
  root.querySelectorAll('.card').forEach(fitCard);
}
