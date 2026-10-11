import type { Category, Db, LocationDef, Product, Unit } from '../types';
import { categoryColor } from '../lib/colors';

/**
 * Справочник перенесён из файла «инвентаризация_2026-16-06.xlsx»:
 * разделы идут в том же порядке, названия позиций и колонка «Обозначение товара»
 * взяты оттуда. Объёмы бутылок в исходном файле не указаны — выставлены типовые
 * (вино 0,75; крепкое 0,7; коньяк/водка/чача 0,5; мартини 1 л) и правятся в «Справочнике».
 */

const cat = (id: string, name: string, emoji: string, order: number): Category => ({
  id,
  name,
  emoji,
  order,
  color: categoryColor(order),
});

export const seedCategories: Category[] = [
  cat('wine_red_ge', 'Красное вино Грузия', '🍷', 1),
  cat('wine_white_ge', 'Белое вино Грузия', '🥂', 2),
  cat('wine_red_eu', 'Красное вино Европа', '🍷', 3),
  cat('wine_white_eu', 'Белое вино Европа', '🥂', 4),
  cat('wine_rose', 'Розовое вино', '🌸', 5),
  cat('wine_special', 'Специальное предложение', '⭐', 6),
  cat('sparkling', 'Игристое вино', '🍾', 7),
  cat('beer_draft', 'Разливное пиво', '🍺', 8),
  cat('martini', 'Мартини', '🌿', 9),
  cat('liqueur', 'Ликёры', '🍯', 10),
  cat('rum', 'Ром', '🏴‍☠️', 11),
  cat('tequila', 'Текила', '🌵', 12),
  cat('gin', 'Джин', '🍸', 13),
  cat('beer_bottle', 'Бутылочное пиво', '🍻', 14),
  cat('whisky', 'Виски', '🥃', 15),
  cat('cognac', 'Коньяк', '🍇', 16),
  cat('vodka', 'Водка', '🧊', 17),
  cat('chacha', 'Чача', '🫗', 18),
  cat('house', 'Хаусный алкоголь', '🏠', 19),
  cat('nonalc', 'Безалкогольное', '🥤', 20),
  cat('other', 'Другое', '📦', 21),
];

/** Порядок как в исходном файле: сначала склад, потом бар. */
export const seedLocations: LocationDef[] = [
  { id: 'storage', name: 'Склад' },
  { id: 'bar', name: 'Бар' },
];

let n = 0;
const mk = (categoryId: string, name: string, tag: string, unit: Unit, volumeMl: number): Product => ({
  id: `p${++n}`,
  categoryId,
  name,
  tag,
  unit,
  volumeMl,
});

/** Бутылочный алкоголь: считаем полные бутылки + остатки в открытых. */
const btl = (categoryId: string, name: string, tag: string, volumeMl: number) =>
  mk(categoryId, name, tag, 'ml', volumeMl);
/** Штучный товар: только количество. */
const pcs = (categoryId: string, name: string, tag: string) => mk(categoryId, name, tag, 'pcs', 0);
/** Весовой товар: граммы. */
const gr = (categoryId: string, name: string, tag: string) => mk(categoryId, name, tag, 'g', 0);

const WINE = 750;

export const seedProducts: Product[] = [
  /* --- Красное вино Грузия --- */
  btl('wine_red_ge', 'Домашнее красное', 'вино', WINE),
  btl('wine_red_ge', 'Саперави Некреси', 'вино', WINE),
  btl('wine_red_ge', 'Мукузани', 'вино', WINE),
  btl('wine_red_ge', 'Киндзмараули', 'вино', WINE),
  btl('wine_red_ge', 'Пиросмани', 'вино', WINE),
  btl('wine_red_ge', 'Алазанская долина красное', 'вино', WINE),
  btl('wine_red_ge', 'Саперави супериор', 'вино', WINE),
  btl('wine_red_ge', 'Колексион сикрет красное', 'вино', WINE),
  btl('wine_red_ge', 'Хванчкара', 'вино', WINE),
  btl('wine_red_ge', 'Резерв рояль красное', 'вино', WINE),

  /* --- Белое вино Грузия --- */
  btl('wine_white_ge', 'Домашнее белое', 'вино', WINE),
  btl('wine_white_ge', 'Алазанская долина белое', 'вино', WINE),
  btl('wine_white_ge', 'Ркацители Некреси', 'вино', WINE),
  btl('wine_white_ge', 'Цинандали', 'вино', WINE),
  btl('wine_white_ge', 'Киси', 'вино', WINE),
  btl('wine_white_ge', 'Горули', 'вино', WINE),
  btl('wine_white_ge', 'Ркацители мухрани', 'вино', WINE),
  btl('wine_white_ge', 'Колекшион сикрет белое', 'вино', WINE),
  btl('wine_white_ge', 'Резерв рояль белое', 'вино', WINE),

  /* --- Красное вино Европа --- */
  btl('wine_red_eu', 'Кьянти', 'вино', WINE),
  btl('wine_red_eu', 'Мальбек', 'вино', WINE),
  btl('wine_red_eu', 'Домини венети вальполичелла', 'вино', WINE),
  btl('wine_red_eu', 'Цитран', 'вино', WINE),
  btl('wine_red_eu', 'Ле вольте дель тоскана', 'вино', WINE),
  btl('wine_red_eu', 'Ле вольте дель оренлайа', 'вино', WINE),

  /* --- Белое вино Европа --- */
  btl('wine_white_eu', 'Маре гриль', 'вино', WINE),
  btl('wine_white_eu', 'Бруни пино гриджо', 'вино', WINE),
  btl('wine_white_eu', 'Вернача ди сан джиминьяно', 'вино', WINE),
  btl('wine_white_eu', 'Ханс Баер Рислинг', 'вино', WINE),
  btl('wine_white_eu', 'Трапичи шардоне', 'вино', WINE),
  btl('wine_white_eu', 'Паддл Крик Мальборо', 'вино', WINE),
  btl('wine_white_eu', 'Приара пино гриджо', 'вино', WINE),
  btl('wine_white_eu', 'Гави валентино', 'вино', WINE),
  btl('wine_white_eu', 'Пфеффер', 'вино', WINE),
  btl('wine_white_eu', 'Грилло сицилия', 'вино', WINE),
  btl('wine_white_eu', 'Шато тамань мускат пино гриджо', 'вино', WINE),
  btl('wine_white_eu', 'Шато тамань шардоне', 'вино', WINE),
  btl('wine_white_eu', 'Ле гран нуар шардоне', 'вино', WINE),

  /* --- Розовое вино --- */
  btl('wine_rose', 'Маре гриль розе', 'вино', WINE),
  btl('wine_rose', 'Легран нуар розе', 'вино', WINE),
  btl('wine_rose', 'Тавквери', 'вино', WINE),

  /* --- Специальное предложение --- */
  btl('wine_special', 'Пино гриджо ахсар', 'вино', WINE),

  /* --- Игристое вино --- */
  btl('sparkling', 'Асканели брют', 'вино', WINE),
  btl('sparkling', 'Санмарюцио пресекко', 'вино', WINE),
  btl('sparkling', 'Санмарюцио москато', 'вино', WINE),
  btl('sparkling', 'Санмарюцио розе', 'вино', WINE),
  btl('sparkling', 'Сан марюцио асти', 'вино', WINE),
  btl('sparkling', 'Асти мартини', 'вино', WINE),
  btl('sparkling', 'Моёт', 'вино', WINE),
  btl('sparkling', 'Лайт хаус', 'вино', WINE),

  /* --- Разливное пиво (кега 30 л) --- */
  btl('beer_draft', 'Амбервайс', 'пиво', 30000),
  btl('beer_draft', 'Стелла Артуа', 'пиво', 30000),

  /* --- Мартини --- */
  btl('martini', 'Мартини бьянко', 'Мартини', 1000),
  btl('martini', 'Мартини россо', 'Мартини', 1000),
  btl('martini', 'Мартини фиеро', 'Мартини', 1000),

  /* --- Ликёры --- */
  btl('liqueur', 'Бехеровка', 'Ликёр', 1000),
  btl('liqueur', 'Егермейстер', 'Ликёр', 1000),
  btl('liqueur', 'Крем де касис', 'Ликёр', 700),
  btl('liqueur', 'Лимончелло', 'Ликёр', 700),
  btl('liqueur', 'Амарето', 'Ликёр', 700),
  btl('liqueur', 'Самбука', 'Ликёр', 700),
  btl('liqueur', 'Трипл сек', 'Ликёр', 700),
  btl('liqueur', 'Кофейный ликёр', 'Ликёр', 700),
  btl('liqueur', 'Бейлис', 'Ликёр', 700),
  btl('liqueur', 'Кампари', 'Ликёр', 1000),
  btl('liqueur', 'Апероль', 'Ликёр', 1000),
  btl('liqueur', 'Абсент', 'Ликёр', 700),
  btl('liqueur', 'Ликёр блю кюрасао', 'Ликёр', 700),

  /* --- Ром --- */
  btl('rum', 'Легендарио аньехо бланко', 'Ром', 700),
  btl('rum', 'Легендарио рон дорадо', 'Ром', 700),
  btl('rum', 'Легендарио элексир де куба', 'Ром', 700),
  btl('rum', 'Легендарио рон аньехо', 'Ром', 700),
  btl('rum', 'Карта Вьехо Аньехо', 'Ром', 750),
  btl('rum', 'Такамака белый', 'Ром', 700),
  btl('rum', 'Такамака золотой', 'Ром', 700),

  /* --- Текила --- */
  btl('tequila', 'Эсполон бланко', 'Текила', 700),
  btl('tequila', 'Эсполон репосадо', 'Текила', 700),
  btl('tequila', 'Хосе куерво сильвер', 'Текила', 700),
  btl('tequila', 'Хосе куерво золотая', 'Текила', 700),

  /* --- Джин --- */
  btl('gin', 'Гордонс', 'Джин', 700),
  btl('gin', 'Бомбей', 'Джин', 700),
  btl('gin', 'Хопперс джин', 'Джин', 500),
  btl('gin', 'Беркшир джин', 'Джин', 500),

  /* --- Бутылочное пиво (штуки) --- */
  pcs('beer_bottle', 'Каяки', 'пиво'),
  pcs('beer_bottle', 'Казбеки', 'пиво'),
  pcs('beer_bottle', 'Айнзинлер шварцбир', 'пиво'),
  pcs('beer_bottle', 'Корона экстра', 'пиво'),
  pcs('beer_bottle', 'Корона церо', 'пиво'),
  pcs('beer_bottle', 'Бичо', 'пиво'),
  pcs('beer_bottle', 'Хевсурули', 'пиво'),
  pcs('beer_bottle', 'Зедазени', 'пиво'),
  pcs('beer_bottle', 'Машенька без башеньки', 'пиво'),
  pcs('beer_bottle', 'Гинес', 'пиво'),
  pcs('beer_bottle', 'Vanila milk stout', 'пиво'),
  pcs('beer_bottle', 'In the sky', 'пиво'),

  /* --- Виски --- */
  btl('whisky', 'Джемесон', 'Виски', 700),
  btl('whisky', 'Джим бим', 'Виски', 700),
  btl('whisky', 'Джек дениелс', 'Виски', 700),
  btl('whisky', 'Чивас ригал', 'Виски', 700),
  btl('whisky', 'Макалан', 'Виски', 700),
  btl('whisky', 'Балантайс', 'Виски', 500),

  /* --- Коньяк --- */
  btl('cognac', 'Сариджишвили ХО', 'Коньяк', 500),
  btl('cognac', 'Сариджишвили VS', 'Коньяк', 500),
  btl('cognac', 'Сариджишвили VSOP', 'Коньяк', 500),
  btl('cognac', 'Арарат', 'Коньяк', 500),
  btl('cognac', 'Курвазье VS', 'Коньяк', 700),
  btl('cognac', 'Шото некреси', 'Коньяк', 500),

  /* --- Водка --- */
  btl('vodka', 'Царская оригинальная', 'Водка', 500),
  btl('vodka', 'Царская золотая', 'Водка', 500),
  btl('vodka', 'Балчуг', 'Водка', 500),
  btl('vodka', 'Белуга', 'Водка', 700),
  btl('vodka', 'Мамонт', 'Водка', 500),
  btl('vodka', 'Онегин', 'Водка', 500),
  btl('vodka', 'Чистые росы', 'Водка', 500),

  /* --- Чача --- */
  btl('chacha', 'Асканели платина', 'чача', 500),
  btl('chacha', 'Асканели голд', 'чача', 500),

  /* --- Хаусный алкоголь --- */
  btl('house', 'Хаус ром', 'Хаус', 1000),
  btl('house', 'Хаус водка', 'Хаус', 1000),
  btl('house', 'Хаус текила', 'Хаус', 1000),
  btl('house', 'Хаус джин', 'Хаус', 1000),

  /* --- Безалкогольное --- */
  pcs('nonalc', 'Саирме', 'Безалкогольное'),
  pcs('nonalc', 'Натахтари лимонад', 'Безалкогольное'),
  pcs('nonalc', 'Сильногазированные напитки 0,33', 'Безалкогольное'),
  pcs('nonalc', 'Боржоми 0,5', 'Безалкогольное'),
  pcs('nonalc', 'Боржоми 0,7', 'Безалкогольное'),
  pcs('nonalc', 'Боржоми 0,33', 'Безалкогольное'),
  pcs('nonalc', 'Редбул', 'Безалкогольное'),
  pcs('nonalc', 'Сок риоба 0,25', 'Безалкогольное'),
  btl('nonalc', 'Сок 1 литр', 'Безалкогольное', 1000),
  btl('nonalc', 'Сильногазированные напитки 1 литр', 'Безалкогольное', 1000),

  /* --- Другое --- */
  btl('other', 'Сиропы', 'Другое', 1000),
  gr('other', 'Кофе', 'Другое'),
  gr('other', 'Ромашка', 'Другое'),
  gr('other', 'Чай', 'Другое'),
  gr('other', 'Какао', 'Другое'),
  gr('other', 'Кардамон', 'Другое'),
  gr('other', 'Гвоздика', 'Другое'),
  gr('other', 'Корица', 'Другое'),
  gr('other', 'Бадьян', 'Другое'),
];

/** Поднимать при изменении структуры справочника — старая база заменится на новую. */
export const SEED_VERSION = 4;

export function makeSeedDb(): Db {
  return {
    version: SEED_VERSION,
    categories: seedCategories,
    products: seedProducts,
    locations: seedLocations,
    sessions: [],
    settings: { author: '' },
  };
}
