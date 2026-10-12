import type * as XLSXTypes from 'xlsx-js-style';
import type { Session, WriteoffSnapshot } from '../types';
import { BAR_NAME, WRITEOFF_SECTIONS } from '../config';
import {
  amountInUnit,
  categorySummaries,
  fileStamp,
  fmtDateTime,
  productTotals,
  sessionProgress,
  unitLabel,
} from './calc';

const round2 = (n: number) => Math.round(n * 100) / 100;
type Row = (string | number | null)[];

/* ---------------- оформление ---------------- */

const LINE = { style: 'thin' as const, color: { rgb: 'FFD0CCC8' } };
const BORDER = { top: LINE, bottom: LINE, left: LINE, right: LINE };

const HEAD_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 },
  fill: { patternType: 'solid', fgColor: { rgb: 'FF3F3A36' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: BORDER,
};

const catStyle = (color: string) => ({
  font: { bold: true, sz: 12, color: { rgb: 'FF26201B' } },
  fill: { patternType: 'solid', fgColor: { rgb: `FF${color}` } },
  alignment: { vertical: 'center' as const },
  border: BORDER,
});

const TEXT_STYLE = { border: BORDER, alignment: { vertical: 'center' as const } };
const NUM_STYLE = { border: BORDER, alignment: { horizontal: 'right' as const, vertical: 'center' as const } };

/**
 * Собирает .xlsx в формате прошлых инвентаризаций бара:
 * лист «Инвентаризация» — Наименование / Обозначение / Ед. / Остаток, разделы цветными
 * строками в CAPS с пустой строкой перед каждым;
 * лист «Детализация» показывает, из чего сложился остаток (полные и открытые бутылки);
 * «По разделам» — свод, «Инфо» — шапка пересчёта.
 *
 * В отчёт идёт только готовый остаток: разбивка по точкам подсчёта (склад / бар)
 * живёт в приложении и в файл не выносится.
 *
 * xlsx-js-style подгружается динамически — библиотека тяжёлая, а нужна только при экспорте.
 */
export async function buildWorkbook(session: Session, wo: WriteoffSnapshot): Promise<XLSXTypes.WorkBook> {
  const XLSX = await import('xlsx-js-style');
  const wb = XLSX.utils.book_new();
  const ordered = [...session.categories].sort((a, b) => a.order - b.order);

  /* ---------- Лист 1: «Инвентаризация» ---------- */

  const width = 4;
  const main: Row[] = [['Наименование товара', 'Обозначение товара', 'Ед.', 'Остаток']];
  const catRows: { row: number; color: string }[] = [];
  let first = true;

  for (const c of ordered) {
    const list = session.products.filter((p) => p.categoryId === c.id);
    if (list.length === 0) continue;

    // Пустая строка-отступ перед каждым следующим разделом.
    if (!first) main.push([]);
    first = false;

    catRows.push({ row: main.length, color: c.color });
    // Пустые строки, а не null — иначе ячейки не создадутся и заливка оборвётся.
    main.push([c.name.toUpperCase(), ...Array.from({ length: width - 1 }, () => '')]);

    for (const p of list) {
      const t = productTotals(session, p);
      main.push([p.name, p.tag, unitLabel(p.unit), amountInUnit(t, p.unit)]);
    }
  }

  /* Списания за период — в самом конце того же листа, по разделам. */
  if (wo.items.length > 0) {
    const date = (iso: string) => new Date(iso).toLocaleDateString('ru-RU');
    const period = wo.from ? `с ${date(wo.from)} по ${date(wo.to)}` : `по ${date(wo.to)}`;
    const blank = (text: string): Row => [text, ...Array.from({ length: width - 1 }, () => '')];

    main.push([]);
    catRows.push({ row: main.length, color: 'FFD966' });
    main.push(blank(`СПИСАНИЯ ${period}`));

    const sectionOf = (m: { section?: string }) => m.section ?? 'Без раздела';
    const sections = [...new Set<string>([...WRITEOFF_SECTIONS, ...wo.items.map(sectionOf)])];
    for (const sec of sections) {
      const inSection = wo.items.filter((m) => sectionOf(m) === sec);
      if (!inSection.length) continue;

      // Одна строка на позицию: суммируем количество, имена тех, кто брал, — через запятую.
      const merged = new Map<string, { name: string; unit: (typeof inSection)[number]['unit']; qty: number; who: Set<string> }>();
      for (const m of inSection) {
        const key = `${m.productId ?? `n:${m.name.toLowerCase()}`}|${m.unit}`;
        const row = merged.get(key) ?? { name: m.name, unit: m.unit, qty: 0, who: new Set<string>() };
        row.qty += m.qty;
        if (m.who) row.who.add(m.who);
        merged.set(key, row);
      }

      catRows.push({ row: main.length, color: 'FFF2CC' });
      main.push(blank(sec.toUpperCase()));
      for (const r of merged.values()) main.push([r.name, [...r.who].join(', '), unitLabel(r.unit), r.qty]);
    }
  }

  const wsMain = XLSX.utils.aoa_to_sheet(main);
  wsMain['!cols'] = [{ wch: 34 }, { wch: 20 }, { wch: 6 }, { wch: 14 }];
  wsMain['!rows'] = main.map((_, i) => (i === 0 ? { hpt: 30 } : { hpt: 17 }));
  wsMain['!freeze'] = { xSplit: '1', ySplit: '1' };

  const catRowSet = new Map(catRows.map((c) => [c.row, c.color]));
  for (let r = 0; r < main.length; r++) {
    if (main[r].length === 0) continue; // строка-отступ остаётся пустой
    const color = catRowSet.get(r);
    for (let c = 0; c < width; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      const cell = wsMain[ref] as XLSXTypes.CellObject | undefined;
      if (!cell) continue;
      if (r === 0) cell.s = HEAD_STYLE;
      else if (color) cell.s = catStyle(color);
      else cell.s = typeof cell.v === 'number' ? NUM_STYLE : TEXT_STYLE;
    }
  }

  XLSX.utils.book_append_sheet(wb, wsMain, 'Инвентаризация');

  /* ---------- Лист 2: «Детализация» ---------- */

  const detHead: Row = [
    'Раздел',
    'Наименование товара',
    'Обозначение',
    'Ед.',
    'Объём бутылки, мл',
    'Полных бутылок',
    'Открытых бутылок, шт',
    'Остаток в открытых, мл',
    'Всего, мл',
    'Всего, л',
    'Бутылок (эквивалент)',
    'Посчитано',
  ];

  const det: Row[] = [detHead];
  const detColors: (string | undefined)[] = [undefined];

  for (const c of ordered) {
    for (const p of session.products.filter((x) => x.categoryId === c.id)) {
      const t = productTotals(session, p);
      const row: Row = [c.name, p.name, p.tag, unitLabel(p.unit), p.unit === 'ml' ? p.volumeMl : null];
      row.push(
        t.full,
        p.unit === 'ml' ? t.openCount : null,
        p.unit === 'ml' ? t.openMl : null,
        p.unit === 'ml' ? t.ml : null,
        p.unit === 'ml' ? round2(t.ml / 1000) : null,
        p.unit === 'ml' ? round2(t.bottleEq) : null,
        t.counted ? 'да' : 'нет',
      );
      det.push(row);
      detColors.push(c.color);
    }
  }

  const wsDet = XLSX.utils.aoa_to_sheet(det);
  wsDet['!cols'] = [
    { wch: 24 },
    { wch: 32 },
    { wch: 15 },
    { wch: 6 },
    { wch: 17 },
    { wch: 15 },
    { wch: 20 },
    { wch: 22 },
    { wch: 12 },
    { wch: 11 },
    { wch: 19 },
    { wch: 11 },
  ];
  wsDet['!rows'] = det.map((_, i) => (i === 0 ? { hpt: 34 } : { hpt: 17 }));
  wsDet['!freeze'] = { xSplit: '2', ySplit: '1' };

  for (let r = 0; r < det.length; r++) {
    for (let c = 0; c < detHead.length; c++) {
      const cell = wsDet[XLSX.utils.encode_cell({ r, c })] as XLSXTypes.CellObject | undefined;
      if (!cell) continue;
      if (r === 0) cell.s = HEAD_STYLE;
      // Колонка «Раздел» красится в цвет раздела — блоки видно и здесь.
      else if (c === 0 && detColors[r]) cell.s = catStyle(detColors[r]!);
      else cell.s = typeof cell.v === 'number' ? NUM_STYLE : TEXT_STYLE;
    }
  }

  XLSX.utils.book_append_sheet(wb, wsDet, 'Детализация');

  /* ---------- Лист 3: «По разделам» ---------- */

  const summaries = categorySummaries(session);
  const catsHead: Row = ['Раздел', 'Позиций', 'Полных бутылок', 'Открытых, шт', 'Остаток в открытых, мл', 'Жидкость, мл', 'Жидкость, л', 'Штучно, шт', 'Вес, г'];
  const cats: Row[] = [
    catsHead,
    ...summaries.map((s) => [s.name, s.positions, s.full - s.pcs, s.openCount, s.openMl, s.ml, round2(s.ml / 1000), s.pcs, s.g]),
  ];
  const wsCat = XLSX.utils.aoa_to_sheet(cats);
  wsCat['!cols'] = [{ wch: 26 }, { wch: 9 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
  wsCat['!rows'] = cats.map((_, i) => (i === 0 ? { hpt: 34 } : { hpt: 17 }));

  for (let r = 0; r < cats.length; r++) {
    for (let c = 0; c < catsHead.length; c++) {
      const cell = wsCat[XLSX.utils.encode_cell({ r, c })] as XLSXTypes.CellObject | undefined;
      if (!cell) continue;
      if (r === 0) cell.s = HEAD_STYLE;
      else if (c === 0) cell.s = catStyle(summaries[r - 1].color);
      else cell.s = typeof cell.v === 'number' ? NUM_STYLE : TEXT_STYLE;
    }
  }

  XLSX.utils.book_append_sheet(wb, wsCat, 'По разделам');

  /* ---------- Лист 4: «Инфо» ---------- */

  const pr = sessionProgress(session);
  const info: Row[] = [
    ['Заведение', BAR_NAME],
    ['Начало пересчёта', fmtDateTime(session.createdAt)],
    ['Завершён', session.finishedAt ? fmtDateTime(session.finishedAt) : '— (черновик)'],
    ['Кто считал', session.author || '—'],
    ['Точки подсчёта', session.locations.map((l) => l.name).join(', ')],
    ['Позиций посчитано', `${pr.counted} из ${pr.total}`],
    ['Записей о списании в отчёте', String(wo.items.length)],
    ['Комментарий', session.note || '—'],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(info);
  wsInfo['!cols'] = [{ wch: 22 }, { wch: 52 }];
  for (let r = 0; r < info.length; r++) {
    const key = wsInfo[XLSX.utils.encode_cell({ r, c: 0 })] as XLSXTypes.CellObject | undefined;
    const val = wsInfo[XLSX.utils.encode_cell({ r, c: 1 })] as XLSXTypes.CellObject | undefined;
    if (key) key.s = { font: { bold: true }, border: BORDER };
    if (val) val.s = TEXT_STYLE;
  }
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Инфо');

  return wb;
}

export async function workbookToBlob(wb: XLSXTypes.WorkBook): Promise<Blob> {
  const XLSX = await import('xlsx-js-style');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function reportFileName(session: Session): string {
  const safeBar = BAR_NAME.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '');
  return `инвентаризация_${safeBar}_${fileStamp(session.finishedAt ?? session.createdAt)}.xlsx`;
}

export async function buildReport(
  session: Session,
  wo: WriteoffSnapshot,
): Promise<{ blob: Blob; filename: string }> {
  const wb = await buildWorkbook(session, wo);
  return {
    blob: await workbookToBlob(wb),
    filename: reportFileName(session),
  };
}
