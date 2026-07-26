# -*- coding: utf-8 -*-
"""
Локальное хранение введённых количеств между запусками приложения.

Формат файла (JSON):
{
  "<category_key>": {
      "<item_index>": {"qty": "1.5", "rest": "300"}                # single
      "<item_index>": {"qty1": "2", "qty2": "", "qty3": "", "rest": "300"}  # multi
      "<item_index>": {"qty": "4"}                                  # misc
  },
  ...
}

Все значения хранятся как строки (то, что человек ввёл в поле) — так
проще без потерь возвращать их обратно в текстовое поле при следующем
открытии экрана. Пересчётом (в граммы и т.п.) занимается export_xlsx.py.
"""

import json
import os

STORE_FILENAME = "inventory_data.json"


def get_store_path(base_dir):
    return os.path.join(base_dir, STORE_FILENAME)


def load_store(base_dir):
    path = get_store_path(base_dir)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def save_store(base_dir, store):
    path = get_store_path(base_dir)
    tmp_path = path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, path)


def get_item_values(store, category_key, item_index):
    return store.get(category_key, {}).get(str(item_index), {})


def set_item_value(store, category_key, item_index, field, value):
    cat_store = store.setdefault(category_key, {})
    item_store = cat_store.setdefault(str(item_index), {})
    if value:
        item_store[field] = value
    elif field in item_store:
        del item_store[field]
