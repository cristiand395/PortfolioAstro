# Portfolio
![Portfolio Screenshot](./public/screenshot.webp)


## 🧞 Commands

For this projects I've used [Bun](https://bun.sh/docs/installation), its to fast!

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `bun install`             | Installs dependencies                            |
| `bun run dev`             | Starts local dev server at `localhost:4321`      |
| `bun run build`           | Build your production site to `./dist/`          |
| `bun run preview`         | Preview your build locally, before deploying     |
| `bun run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `bun run astro -- --help` | Get help using the Astro CLI                     |
| `bun astro add --list`    | Show some integrations                           | 

## Resources
- Font: [Onest](https://fontsource.org/fonts/onest/install)
- Background: [bg.ibelick](https://bg.ibelick.com/) 
- Tailwind components: [Flowbite](https://flowbite.com/)
- Icons: [Tablericons](https://tablericons.com/) - [Vercel](https://vercel.com/design/icons) 
- Mockup: [Shots](https://shots.so/)
- Image Optimizer: [Squoosh](https://squoosh.app/)
- Deploy: [Netlify](https://app.netlify.com/drop)


## TODO:
- [⌛] Sections:
  - [✅] Experience Timeline
  - [⌛] Projects 
- [✅] Light and Dark Mode switch
- [✅] Colors schemes
- [✅] i18n
  - [✅] English
  - [✅] Spanish
- [✅] Responsive
- [⌛] Deploy

## Añadir una estrella

Cada estrella del cielo es un archivo Markdown en `src/content/estrellas/`. Para añadir un post de LinkedIn, un repo o una faceta nueva, crea un archivo así y despliega:

```md
---
constelacion: publicaciones # oficio | laboratorio | publicaciones
tipo: post # faceta | repo | post
brillo: 2 # 1 a 3: cuánto destaca en el cielo
enlace: https://www.linkedin.com/posts/...
es:
  titulo: Título en español
  texto: Una o dos frases.
  cifra: Dato medible (opcional)
en:
  titulo: English title
  texto: One or two sentences.
---
```

Las constelaciones sin estrellas no se muestran; la primera publicación hace aparecer la de Publicaciones.
