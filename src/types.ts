/** Раздел на домашней странице: «Красное вино Грузия», «Виски», «Бутылочное пиво»… */
export type Category = {
  id: string;
  name: string;
  emoji: string;
  order: number;
  /** Цвет раздела без «#»: заливка строки в отчёте и акцент на плашке. */
  color: string;
};

/**
 * Единица, в которой считается позиция:
 *  - 'ml'  — бутылочный алкоголь: полные бутылки + остатки в открытых, итог в мл;
 *  - 'pcs' — штучный товар (бутылочное пиво, вода, банки), итог в штуках;
 *  - 'g'   — весовой товар (кофе, чай, специи), итог в граммах.
 */
export type Unit = 'ml' | 'pcs' | 'g';

/** Позиция (SKU). volumeMl имеет смысл только при unit === 'ml'. */
export type Product = {
  id: string;
  categoryId: string;
  name: string;
  /** Колонка «Обозначение товара» в отчёте: вино, Виски, Ликёр, пиво… */
  tag: string;
  unit: Unit;
  volumeMl: number;
  archived?: boolean;
};

/** Точка подсчёта: склад, бар, второй бар... */
export type LocationDef = {
  id: string;
  name: string;
};

/**
 * Данные подсчёта одной позиции в одной точке.
 * full  — полные (запечатанные) бутылки при unit 'ml', количество штук при unit 'pcs';
 * open  — остатки в мл по каждой открытой бутылке: [350, 120] = две открытые (только 'ml');
 * grams — вес при unit 'g'.
 */
export type Cell = {
  full: number;
  open: number[];
  grams?: number;
};

/** entries[productId][locationId] — ячейка есть только если позицию уже считали. */
export type Entries = Record<string, Record<string, Cell>>;

export type SessionStatus = 'draft' | 'finished';

/**
 * Пересчёт. Внутри лежит снимок справочников (categories/products/locations):
 * если позже переименовать или удалить позицию, старый отчёт не поедет.
 */
export type Session = {
  id: string;
  createdAt: string;
  finishedAt?: string;
  status: SessionStatus;
  author?: string;
  note?: string;
  locations: LocationDef[];
  categories: Category[];
  products: Product[];
  entries: Entries;
};

export type Settings = {
  author: string;
};

export type Db = {
  version: number;
  categories: Category[];
  products: Product[];
  locations: LocationDef[];
  sessions: Session[];
  settings: Settings;
};
