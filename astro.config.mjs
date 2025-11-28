import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
// Use top-level await to import CJS/ESM modules correctly in ESM Astro config.
const tailwindPostcssMod = await import('@tailwindcss/postcss');
const tailwindPostcss = tailwindPostcssMod.default ?? tailwindPostcssMod;
const autoprefixerMod = await import('autoprefixer');
const autoprefixer = autoprefixerMod.default ?? autoprefixerMod;

export default defineConfig({
  // Configure Tailwind v4 via Vite PostCSS plugins directly.
  vite: {
    css: {
      postcss: {
        plugins: [
          // Note: Tailwind v4 doesn't expose the internal nesting plugin path; skip nesting.
          tailwindPostcss({ config: './tailwind.config.mjs' }),
          autoprefixer(),
        ],
      },
    },
    plugins: [tailwindcss()],
  },
  i18n: {
    defaultLocale: "en",
    locales: ["en", "es"],
    routing: {
      prefixDefaultLocale: false
    }
  }
});