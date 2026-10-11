import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Идентификатор приложения нельзя менять после установки на планшет —
  // Android посчитает это другим приложением, и локальные данные не перенесутся.
  appId: 'com.mimino.inventory',
  appName: 'Инвентаризация Мимино',
  webDir: 'dist',
  android: {
    // Приложение полностью офлайн, внешний http-трафик не нужен.
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      // Интерфейс тёмный — светлые значки в статус-баре и панели навигации.
      style: 'DARK',
    },
  },
};

export default config;
