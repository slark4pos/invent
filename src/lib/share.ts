import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export type DeliveryResult = 'shared' | 'downloaded';

/** true внутри собранного Android-приложения, false в обычном браузере. */
export const isNative = (): boolean => Capacitor.isNativePlatform();

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * В WebView у Android нет скачивания по ссылке и нет Web Share для файлов,
 * поэтому файл кладём во временную папку приложения и отдаём системному
 * меню «Поделиться» (Telegram, почта, «Сохранить на устройство»…).
 */
async function shareNative(blob: Blob, filename: string, text?: string): Promise<DeliveryResult> {
  const written = await Filesystem.writeFile({
    path: filename,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  });
  try {
    await Share.share({ title: filename, text, files: [written.uri], dialogTitle: 'Отправить отчёт' });
  } catch (e) {
    // Закрыли шторку «Поделиться» — это не ошибка.
    const msg = e instanceof Error ? e.message : String(e);
    if (!/cancel/i.test(msg)) throw e;
  }
  return 'shared';
}

/**
 * Отдаёт файл пользователю: в приложении — через «Поделиться», в браузере —
 * через Web Share (Android Chrome) или обычное скачивание (компьютер).
 */
export async function shareOrDownload(blob: Blob, filename: string, text?: string): Promise<DeliveryResult> {
  if (isNative()) return shareNative(blob, filename, text);

  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };

  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename, text });
      return 'shared';
    } catch (e) {
      // Пользователь закрыл шторку «Поделиться» — это не ошибка, молча выходим.
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
      console.warn('Share не сработал, скачиваем файл', e);
    }
  }

  download(blob, filename);
  return 'downloaded';
}

/** Сохранить файл: в браузере — скачать, в приложении — то же системное меню (там есть «Сохранить»). */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (isNative()) {
    await shareNative(blob, filename);
    return;
  }
  download(blob, filename);
}
