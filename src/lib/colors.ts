/**
 * Палитра разделов: равномерно разнесённые по кругу пастельные тона.
 * Один и тот же цвет используется и в отчёте (заливка строки раздела),
 * и в приложении (плашка раздела), поэтому живёт отдельным модулем.
 */

const STEP = 21; // на столько оттенков делим круг — по числу разделов в справочнике

function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * v)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  };
  return `${f(0)}${f(8)}${f(4)}`;
}

/** Пастельная заливка для раздела с указанным порядковым номером (1, 2, 3…). */
export function categoryColor(order: number): string {
  // Шаг 8 по кругу из 21 оттенка — соседние разделы не сливаются по цвету.
  const hue = (((order - 1) * 8) % STEP) * (360 / STEP);
  return hslToHex(hue, 62, 82);
}

/** Тот же цвет в CSS-виде. */
export function cssColor(hex: string): string {
  return `#${hex}`;
}
