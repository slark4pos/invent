# -*- coding: utf-8 -*-
"""
Хук для python-for-android: правит AndroidManifest.xml напрямую после того,
как p4a его сгенерирует, но до сборки gradle.

Нужен, потому что стандартная опция buildozer.spec
"android.extra_manifest_application_arguments" рассчитана на добавление
АТРИБУТОВ в тег <application ...>, а не целых дочерних тегов вроде
<provider>...</provider> — то, что нужно для FileProvider (шеринг файла).
Это известное ограничение python-for-android, поэтому здесь мы просто
дописываем нужный XML прямо в файл текстом.

Подключается в buildozer.spec строкой:
    p4a.hook = android_extra/hook.py
"""

from pathlib import Path

PROVIDER_XML = """
    <provider
        android:name="androidx.core.content.FileProvider"
        android:authorities="org.slark4pos.barinventory.fileprovider"
        android:exported="false"
        android:grantUriPermissions="true">
        <meta-data
            android:name="android.support.FILE_PROVIDER_PATHS"
            android:resource="@xml/file_paths" />
    </provider>
"""


def after_apk_build(toolchain):
    manifest_file = Path(toolchain._dist.dist_dir) / "src" / "main" / "AndroidManifest.xml"
    manifest_text = manifest_file.read_text(encoding="utf-8")

    if "FileProvider" in manifest_text:
        # Уже вставлено при предыдущей сборке этого же dist — не дублируем
        return

    patched = manifest_text.replace(
        "</application>", f"{PROVIDER_XML}\n</application>"
    )
    manifest_file.write_text(patched, encoding="utf-8")
    print("[hook] FileProvider добавлен в AndroidManifest.xml")
