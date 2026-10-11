// Рисует иконку и заставку (бокал вина) и сохраняет PNG для @capacitor/assets.
// Запуск: node assets/make-icons.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const BG = '#14110f';
const AMBER = '#e0a44a';
const WINE = '#a8323e';

/** Бокал в системе координат 100×100; scale — доля холста, которую он занимает. */
const glass = (size, scale) => {
  const k = (size * scale) / 100;
  const off = (size - 100 * k) / 2;
  return `
  <g transform="translate(${off} ${off}) scale(${k})">
    <path d="M28 12 H72 C72 42 63 57 50 59 C37 57 28 42 28 12 Z" fill="none" stroke="${AMBER}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M30.5 30 H69.5 C68.5 44 62 54 50 56.5 C38 54 31.5 44 30.5 30 Z" fill="${WINE}"/>
    <rect x="48" y="59" width="4" height="25" rx="2" fill="${AMBER}"/>
    <rect x="34" y="84" width="32" height="4.5" rx="2.25" fill="${AMBER}"/>
  </g>`;
};

const svg = (size, { bg, scale }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg ? `<rect width="${size}" height="${size}" fill="${BG}"/>` : ''}
  ${glass(size, scale)}
</svg>`;

const out = (name, size, opts) =>
  sharp(Buffer.from(svg(size, opts))).png().toFile(join(dir, name)).then(() => console.log('✓', name));

await Promise.all([
  out('icon-only.png', 1024, { bg: true, scale: 0.82 }),
  // Адаптивная иконка Android: бокал внутри «безопасной» центральной зоны.
  out('icon-foreground.png', 1024, { bg: false, scale: 0.5 }),
  out('icon-background.png', 1024, { bg: true, scale: 0 }),
  out('splash.png', 2732, { bg: true, scale: 0.22 }),
  out('splash-dark.png', 2732, { bg: true, scale: 0.22 }),
]);
