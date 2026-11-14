import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const texto = z.object({
  titulo: z.string(),
  texto: z.string(),
  cifra: z.string().optional(),
});

/**
 * Cada archivo de src/content/estrellas es una estrella del cielo.
 * Añadir un post, repo o idea = añadir un archivo; no hay que tocar código.
 */
const estrellas = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/estrellas' }),
  schema: z.object({
    constelacion: z.enum(['oficio', 'laboratorio', 'publicaciones']),
    tipo: z.enum(['faceta', 'repo', 'post']),
    // 1 a 3: cuánto brilla en el cielo. Úsalo para lo que más impacto tuvo.
    brillo: z.number().int().min(1).max(3).default(1),
    enlace: z.url().optional(),
    es: texto,
    en: texto,
  }),
});

export const collections = { estrellas };
