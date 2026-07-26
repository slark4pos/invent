# -*- coding: utf-8 -*-
"""
Инвентаризация бара — мобильное приложение (Kivy).

Экраны:
  CategoriesScreen — список категорий, кнопка "Экспорт в Excel" внизу.
  ItemsScreen       — позиции выбранной категории с полями ввода.

Данные сохраняются локально в JSON (storage.py) при каждом изменении поля,
поэтому ничего не теряется при закрытии приложения. Экспорт (export_xlsx.py)
строит .xlsx с той же структурой листов и формул, что и оригинальный
bar_inventory.py, но уже заполненный введёнными значениями.

Запуск для разработки (на компьютере, окно вместо телефона):
    pip install kivy openpyxl
    python3 main.py

Сборка APK — см. buildozer.spec и README.md.
"""

import os
from datetime import datetime

from kivy.app import App
from kivy.uix.screenmanager import ScreenManager, Screen, SlideTransition
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.scrollview import ScrollView
from kivy.uix.gridlayout import GridLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.popup import Popup
from kivy.metrics import dp
from kivy.utils import platform

from data import CATEGORIES, get_category, ALT_VOLUMES
import storage
import export_xlsx

ACCENT = (0.42, 0.17, 0.17, 1)      # #6B2B2B
BG = (0.98, 0.97, 0.94, 1)          # тёплый светлый фон
INPUT_BG = (1, 0.95, 0.77, 1)       # жёлтая заливка полей ввода


def make_label(text, **kwargs):
    kwargs.setdefault("color", (0.15, 0.1, 0.1, 1))
    kwargs.setdefault("halign", "left")
    kwargs.setdefault("valign", "middle")
    lbl = Label(text=text, **kwargs)
    lbl.bind(size=lambda inst, val: setattr(inst, "text_size", val))
    return lbl


def make_qty_input(initial_text, hint):
    ti = TextInput(
        text=initial_text or "",
        hint_text=hint,
        multiline=False,
        input_filter=None,  # разрешаем дробные через запятую/точку
        size_hint=(1, None),
        height=dp(40),
        background_color=INPUT_BG,
        padding=[dp(8), dp(8), dp(8), dp(8)],
    )
    return ti


class CategoriesScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        root = BoxLayout(orientation="vertical")

        title = Label(
            text="Инвентаризация бара",
            size_hint=(1, None), height=dp(56),
            font_size=dp(22), bold=True,
            color=(1, 1, 1, 1),
        )
        with title.canvas.before:
            from kivy.graphics import Color, Rectangle
            Color(*ACCENT)
            title._bg_rect = Rectangle(pos=title.pos, size=title.size)
        title.bind(pos=lambda i, v: setattr(i._bg_rect, "pos", v))
        title.bind(size=lambda i, v: setattr(i._bg_rect, "size", v))
        root.add_widget(title)

        scroll = ScrollView(size_hint=(1, 1))
        grid = GridLayout(cols=1, size_hint_y=None, spacing=dp(6), padding=dp(10))
        grid.bind(minimum_height=grid.setter("height"))

        for cat in CATEGORIES:
            btn = Button(
                text=f"{cat['title']}  ({len(cat['items'])})",
                size_hint=(1, None), height=dp(50),
                background_normal="", background_color=(1, 1, 1, 1),
                color=(0.15, 0.1, 0.1, 1),
                halign="left",
            )
            btn.bind(size=lambda i, v: setattr(i, "text_size", (v[0] - dp(20), None)))
            btn.bind(on_release=lambda inst, k=cat["key"]: self.open_category(k))
            grid.add_widget(btn)

        scroll.add_widget(grid)
        root.add_widget(scroll)

        export_btn = Button(
            text="Экспорт в Excel",
            size_hint=(1, None), height=dp(56),
            background_normal="", background_color=ACCENT,
            color=(1, 1, 1, 1), bold=True, font_size=dp(18),
        )
        export_btn.bind(on_release=self.do_export)
        root.add_widget(export_btn)

        self.add_widget(root)

    def open_category(self, key):
        self.manager.transition = SlideTransition(direction="left")
        self.manager.get_screen("items").load_category(key)
        self.manager.current = "items"

    def do_export(self, *args):
        app = App.get_running_app()
        store = storage.load_store(app.user_data_dir)
        filename = f"инвентаризация_{datetime.now().strftime('%Y-%m-%d_%H%M')}.xlsx"
        filepath = os.path.join(app.user_data_dir, filename)
        try:
            export_xlsx.export_to_file(store, filepath)
        except Exception as e:
            self._show_popup("Ошибка экспорта", str(e))
            return

        shared = try_share_file(filepath)
        if not shared:
            self._show_popup(
                "Файл сохранён",
                f"{filename}\n\nПапка приложения:\n{app.user_data_dir}\n\n"
                "Найдите файл через файловый менеджер или подключите телефон "
                "к компьютеру, чтобы забрать его.",
            )

    def _show_popup(self, title, message):
        content = BoxLayout(orientation="vertical", padding=dp(12), spacing=dp(10))
        content.add_widget(make_label(message, size_hint=(1, 1)))
        close_btn = Button(text="Ок", size_hint=(1, None), height=dp(44))
        content.add_widget(close_btn)
        popup = Popup(title=title, content=content, size_hint=(0.9, 0.6))
        close_btn.bind(on_release=popup.dismiss)
        popup.open()


class ItemsScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.category_key = None
        self.root_layout = BoxLayout(orientation="vertical")
        self.add_widget(self.root_layout)

    def load_category(self, key):
        self.category_key = key
        self.root_layout.clear_widgets()
        cat = get_category(key)
        app = App.get_running_app()
        self.store = storage.load_store(app.user_data_dir)

        header = BoxLayout(size_hint=(1, None), height=dp(56))
        with header.canvas.before:
            from kivy.graphics import Color, Rectangle
            Color(*ACCENT)
            header._bg_rect = Rectangle(pos=header.pos, size=header.size)
        header.bind(pos=lambda i, v: setattr(i._bg_rect, "pos", v))
        header.bind(size=lambda i, v: setattr(i._bg_rect, "size", v))

        back_btn = Button(text="< Назад", size_hint=(None, 1), width=dp(90),
                           background_normal="", background_color=ACCENT,
                           color=(1, 1, 1, 1))
        back_btn.bind(on_release=self.go_back)
        header.add_widget(back_btn)
        header.add_widget(Label(text=cat["title"], color=(1, 1, 1, 1),
                                 font_size=dp(18), bold=True))
        self.root_layout.add_widget(header)

        scroll = ScrollView(size_hint=(1, 1))
        list_layout = GridLayout(cols=1, size_hint_y=None, spacing=dp(10), padding=dp(10))
        list_layout.bind(minimum_height=list_layout.setter("height"))

        for idx, item in enumerate(cat["items"]):
            list_layout.add_widget(self._build_item_row(cat, idx, item))

        scroll.add_widget(list_layout)
        self.root_layout.add_widget(scroll)

    def _build_item_row(self, cat, idx, item):
        box = BoxLayout(orientation="vertical", size_hint=(1, None),
                         padding=dp(8), spacing=dp(4))
        box.bind(minimum_height=box.setter("height"))
        with box.canvas.before:
            from kivy.graphics import Color, Rectangle
            Color(1, 1, 1, 1)
            box._bg_rect = Rectangle(pos=box.pos, size=box.size)
        box.bind(pos=lambda i, v: setattr(i._bg_rect, "pos", v))
        box.bind(size=lambda i, v: setattr(i._bg_rect, "size", v))

        name = item[0]
        box.add_widget(make_label(name, size_hint=(1, None), height=dp(28),
                                   bold=True, font_size=dp(15)))

        values = storage.get_item_values(self.store, cat["key"], idx)

        if cat["type"] == "single":
            volume = item[1]
            box.add_widget(make_label(f"Объём бутылки: {volume} мл",
                                       size_hint=(1, None), height=dp(20),
                                       font_size=dp(12), color=(0.4, 0.4, 0.4, 1)))
            row = BoxLayout(size_hint=(1, None), height=dp(40), spacing=dp(8))
            qty = make_qty_input(values.get("qty"), "Кол-во бутылок, шт")
            qty.bind(focus=self._on_focus_factory(cat, idx, "qty", qty))
            row.add_widget(qty)
            rest = make_qty_input(values.get("rest"), "Остаток, г")
            rest.bind(focus=self._on_focus_factory(cat, idx, "rest", rest))
            row.add_widget(rest)
            box.add_widget(row)

        elif cat["type"] == "multi":
            volume_spec = item[1]
            if isinstance(volume_spec, (tuple, list)):
                default_volume = volume_spec[0]
                alt = list(volume_spec[1:])
            else:
                default_volume = volume_spec
                alt = [v for v in ALT_VOLUMES if v != default_volume]
            volumes = [default_volume] + alt
            qty_fields = ["qty1", "qty2", "qty3"]
            for slot, vol in enumerate(volumes[:3]):
                row = BoxLayout(size_hint=(1, None), height=dp(40), spacing=dp(8))
                row.add_widget(make_label(f"{vol} мл", size_hint=(0.35, 1)))
                field = qty_fields[slot]
                ti = make_qty_input(values.get(field), "Кол-во, шт")
                ti.bind(focus=self._on_focus_factory(cat, idx, field, ti))
                row.add_widget(ti)
                box.add_widget(row)
            rest_row = BoxLayout(size_hint=(1, None), height=dp(40), spacing=dp(8))
            rest_row.add_widget(make_label("Остаток откр., г", size_hint=(0.35, 1)))
            rest = make_qty_input(values.get("rest"), "г")
            rest.bind(focus=self._on_focus_factory(cat, idx, "rest", rest))
            rest_row.add_widget(rest)
            box.add_widget(rest_row)

        else:  # misc
            unit = item[1]
            row = BoxLayout(size_hint=(1, None), height=dp(40), spacing=dp(8))
            row.add_widget(make_label(f"Ед. изм.: {unit}", size_hint=(0.4, 1)))
            qty = make_qty_input(values.get("qty"), "Кол-во")
            qty.bind(focus=self._on_focus_factory(cat, idx, "qty", qty))
            row.add_widget(qty)
            box.add_widget(row)

        box.height = box.minimum_height + dp(10)
        return box

    def _on_focus_factory(self, cat, idx, field, widget):
        def _on_focus(instance, has_focus):
            if not has_focus:
                storage.set_item_value(self.store, cat["key"], idx, field, widget.text)
                app = App.get_running_app()
                storage.save_store(app.user_data_dir, self.store)
        return _on_focus

    def go_back(self, *args):
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = "categories"


def try_share_file(filepath):
    """Пытается открыть системное меню 'Поделиться' на Android.
    Возвращает True, если запрос на шеринг отправлен, иначе False
    (тогда вызывающий код покажет путь к файлу вместо этого)."""
    if platform != "android":
        return False
    try:
        from jnius import autoclass
        from android import mActivity  # noqa

        Intent = autoclass("android.content.Intent")
        File = autoclass("java.io.File")
        FileProvider = autoclass("androidx.core.content.FileProvider")

        file_obj = File(filepath)
        authority = mActivity.getPackageName() + ".fileprovider"
        uri = FileProvider.getUriForFile(mActivity, authority, file_obj)

        intent = Intent(Intent.ACTION_SEND)
        intent.setType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        intent.putExtra(Intent.EXTRA_STREAM, uri)
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        chooser = Intent.createChooser(intent, "Поделиться файлом")
        mActivity.startActivity(chooser)
        return True
    except Exception as e:
        print("share_file failed:", e)
        return False


class BarInventoryApp(App):
    def build(self):
        from kivy.core.window import Window
        Window.clearcolor = BG

        sm = ScreenManager()
        sm.add_widget(CategoriesScreen(name="categories"))
        sm.add_widget(ItemsScreen(name="items"))
        return sm


if __name__ == "__main__":
    BarInventoryApp().run()
