// Monstruos de ejemplo con estadísticas B/X (las mecánicas son genéricas; textos originales).
import { newMonster } from './model.js';

export function sampleMonsters() {
  return [
    newMonster({
      deck: 'Ejemplos', name: 'Trasgo', alignment: 'Caótico', kind: 'Humanoide',
      ac: '6', hd: '1-1', hp: '3', attacks: '1 × arma (1d6)', move: '18 m (6 m)', morale: '7 (9)',
      appearing: '2d4 (6d10)', treasure: 'R (C)',
      description: 'Pequeños, verdosos y crueles. Viven en madrigueras bajo las colinas y salen de noche a saquear granjas aisladas. Odian a los enanos con toda su alma.',
      abilities: [
        { name: 'Infravisión', text: '18 m.' },
        { name: 'Luz del sol', text: '−1 a las tiradas de ataque bajo la luz del día.' },
        { name: 'Rey trasgo', text: 'En la guarida hay un rey (3 DG, 15 PG, 1d6+1 de daño) con 2d6 guardaespaldas (2 DG). Mientras el rey viva, la moral de los trasgos es 9.' },
        { name: 'Lobos', text: 'Un 20 % de las bandas cabalgan lobos terribles.' },
      ],
      treasureText: 'Monedas sucias, baratijas robadas y algún cuchillo bueno.',
    }),
    newMonster({
      deck: 'Ejemplos', name: 'Esqueleto', alignment: 'Caótico', kind: 'No muerto',
      ac: '7', hd: '1', attacks: '1 × arma (1d6)', move: '18 m (6 m)', morale: '12',
      appearing: '3d4 (3d10)', treasure: 'Ninguno',
      description: 'Huesos animados por magia oscura. Montan guardia en criptas y ruinas, obedeciendo sin descanso las órdenes de quien los alzó.',
      abilities: [
        { name: 'No muerto', text: 'Inmune a los efectos que afectan a seres vivos (veneno) y a la magia que afecta a la mente (*dormir*, *hechizar*, *inmovilizar*). Puede ser expulsado por clérigos.' },
        { name: 'Silencioso', text: 'No hace ruido hasta que ataca.' },
      ],
    }),
    newMonster({
      deck: 'Ejemplos', name: 'Ogro', alignment: 'Caótico', kind: 'Gigante',
      ac: '5', hd: '4+1', attacks: '1 × garrote (1d10)', move: '27 m (9 m)', morale: '10',
      appearing: '1d6 (2d6)', treasure: 'C',
      description: 'Gigantes brutos de casi tres metros, vestidos con pieles y armados con troncos. Huelen a carne podrida y nunca tienen bastante comida.',
      abilities: [
        { name: 'Avaricia', text: 'Pueden aceptar sobornos de comida o monedas. Cada ogro lleva 1d6 × 100 mo en un saco.' },
      ],
      treasureText: 'Saco de cada ogro: 1d6 × 100 mo.',
      notes: 'Ruge antes de cargar: los PJ que lo oigan no quedan sorprendidos.',
    }),
  ];
}
