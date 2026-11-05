import { CREDITS } from '../credits.js';
import { h } from '../ui.js';

export function creditsView(root, { focusApps = false } = {}) {
  const c = CREDITS;
  const section = (title, ...children) => h('section', { class: 'group' }, h('header', {}, h('h3', {}, title)), children);
  const row = (label, ...value) => [h('dt', {}, label), h('dd', {}, value)];

  root.append(h('div', { class: 'credits' },
    h('h2', { class: 'view-title' }, 'Créditos'),
    h('p', { class: 'lead' }, h('b', {}, c.app), ` · versión ${c.version} · © ${c.year} ${c.author}`),

    c.apps && c.apps.length ? h('section', { class: 'group', id: 'apps' }, h('header', {}, h('h3', {}, 'Más herramientas para el DJ')),
      h('div', { class: 'app-links' }, c.apps.map(a => h('a', { class: 'app-link', href: a.url, target: '_blank', rel: 'noopener' },
        h('span', { class: 'app-name' }, a.name, h('span', { class: 'app-arrow', 'aria-hidden': 'true' }, '↗')),
        h('span', { class: 'app-text' }, a.text))))) : null,

    section('Autoría',
      h('dl', {},
        row('Idea y diseño', c.author),
        c.web ? row('Web', h('a', { href: c.web, target: '_blank', rel: 'noopener' }, c.web.replace(/^https?:\/\//, ''))) : null,
        c.thanks ? row('Agradecimientos', c.thanks) : null)),

    section('Juegos',
      h('p', {}, 'Las cartas siguen el formato de los bloques de monstruo de ',
        h('i', {}, 'Old-School Essentials'), ' y de ', h('i', {}, 'Aventuras en la Marca del Este'),
        '. Los cálculos automáticos (TAC0, salvaciones, PX) usan las tablas de la edición B/X.'),
      h('p', { class: 'fine' }, 'Proyecto de aficionado, no oficial y sin afiliación. Old-School Essentials es marca de Necrotic Gnome; Aventuras en la Marca del Este y el resto de marcas citadas pertenecen a sus respectivos propietarios.')),

    section('Tipografías',
      h('dl', {},
        row('Pirata One', 'Rodrigo Fuenzalida y Nicolás Massi · SIL Open Font License'),
        row('Oswald', 'Vernon Adams y colaboradores · SIL Open Font License'),
        row('Jost', 'Owen Earl (indestructible type*) · SIL Open Font License'))),

    section('Licencia',
      h('p', {}, 'El código de Bestiarium se distribuye bajo licencia MIT. Las tipografías mantienen su propia licencia (SIL OFL 1.1).')),

    section('Ejemplos',
      h('p', {}, 'Las estadísticas de los monstruos de ejemplo son mecánicas genéricas B/X; las descripciones son originales.'))));
  if (focusApps) requestAnimationFrame(() => document.getElementById('apps')?.scrollIntoView({ block: 'start' }));
}
