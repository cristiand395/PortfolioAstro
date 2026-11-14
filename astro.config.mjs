import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    // Safari 16 incluido: así el build conserva prefijos como -webkit-backdrop-filter (iOS 17 y antes).
    build: { cssTarget: ['chrome111', 'safari16', 'firefox115'] },
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
