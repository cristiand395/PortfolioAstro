import { getCollection } from 'astro:content';
import { geti18n } from '@i18n/index';

// Color de cada constelación: el cielo 3D y las tarjetas comparten estos valores.
const COLORS: Record<string, string> = {
  oficio: '#ffa36b',
  laboratorio: '#9fb6ff',
  publicaciones: '#7ff0d0',
};

/**
 * Carga las estrellas y las agrupa por constelación, en el orden de CONSTELLATIONS.
 * Las constelaciones sin estrellas no se muestran: el cielo nunca enseña huecos.
 */
export async function loadSky(locale: string | undefined) {
  const i18n = geti18n({ currentLocale: locale });
  const lang = locale === 'es' ? 'es' : 'en';
  const entries = await getCollection('estrellas');

  const constellations = i18n.CONSTELLATIONS
    .map((c) => ({
      id: c.ID,
      name: c.NAME,
      text: c.TEXT,
      color: COLORS[c.ID],
      stars: entries
        .filter((e) => e.data.constelacion === c.ID)
        .sort((a, b) => b.data.brillo - a.data.brillo || a.id.localeCompare(b.id))
        .map((e) => ({ id: e.id, ...e.data, ...e.data[lang] })),
    }))
    .filter((c) => c.stars.length > 0);

  const stars = constellations.flatMap((c, index) =>
    c.stars.map((s) => ({ ...s, constellationIndex: index, color: c.color })),
  );
  return { i18n, constellations, stars };
}
