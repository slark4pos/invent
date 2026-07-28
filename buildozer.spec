[app]
title = Инвентаризация бара
package.name = barinventory
package.domain = org.slark4pos

source.dir = .
source.include_exts = py,png,jpg,kv,atlas

version = 0.1

# openpyxl тянет за собой et_xmlfile — оба чистый Python, ставятся через pip
requirements = python3==3.11.6,hostpython3==3.11.6,kivy==2.3.0,openpyxl,et_xmlfile,pyjnius

orientation = all
fullscreen = 0

android.permissions = WRITE_EXTERNAL_STORAGE,READ_EXTERNAL_STORAGE
android.accept_sdk_license = True

# Нужно для кнопки "Экспорт в Excel" -> системное меню "Поделиться":
# FileProvider объявлен в android_extra/manifest_provider.xml, список
# расшариваемых папок — в android_extra/res/xml/file_paths.xml
android.add_src = android_extra
android.extra_manifest_application_arguments = android_extra/manifest_provider.xml
android.enable_androidx = True

android.api = 34
android.minapi = 24
android.ndk = 25b
android.archs = arm64-v8a, armeabi-v7a

[buildozer]
log_level = 2
warn_on_root = 0
