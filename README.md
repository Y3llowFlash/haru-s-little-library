# Haru's Little Library

A mobile-first, atmospheric reading experience that turns Burmese essays into
books on a small wooden shelf. The library includes animated day and night
scenes, a Totoro shelf companion, optional background music, and a page-turning
reader.

## Features

- Seven editorially paginated Burmese books.
- A day or night scene that follows the operating-system/browser preference.
- A manual day/night button for readers who want to switch immediately.
- Video backgrounds with poster fallbacks and reduced-motion support.
- Optional BGM with a header control, gentle fades, and lower volume while the
  reader is open.
- Drag, swipe, and arrow-button page navigation.
- A single-page mobile reader and two-page desktop spread.
- Mobile safe-area and viewport handling without disabling normal scrolling.

## Current collection

- post00001
- post00004
- post00006
- post00007
- post00009
- post00014
- post00015

The pagination is editorially planned: chapters start on fresh pages, important
ideas receive dedicated spotlight pages, and selected images receive breathing
room.

## Local development

Requirements: Node.js 22 and npm.

```bash
npm install
npm run dev
```

`npm run dev` rebuilds the editorial content before starting Vite.

Production verification:

```bash
npm run lint
npm run build
git diff --check
```

## Adding content

Original posts live in `past_data/posts/` and their assets live in
`past_data/assets/`.

To add or edit a book:

1. Update its source HTML in `past_data/posts/`.
2. Add or revise its editorial section plan in `scripts/build-content.mjs`.
3. Add its shelf metadata in `src/little-library.tsx` when introducing a new
   book.
4. Run `npm run content:build`.

The build generates `public/content/*.json` and refreshes `public/assets/`.
Treat those paths as generated output rather than the primary editing source.

## Project structure

- `src/little-library.tsx` — shelf, book metadata, theme state, and reader.
- `src/starry-night-video.tsx` — day/night background playback and crossfade.
- `src/library-bgm.tsx` — music playback, fades, and reader-volume handling.
- `src/globals.css` — responsive library and reader styling.
- `scripts/build-content.mjs` — source extraction and editorial pagination.
- `past_data/` — original article and media sources.
- `public/content/` — generated reader payloads.

## Deployment

The project is configured for Vercel. Import this repository, keep the root
directory as `./`, and deploy. No environment variables are currently
required.

## Security

Real secrets never belong in this repository. Use `.env.example` only as a
public list of variable names and store real values in Vercel Environment
Variables. See [SECURITY.md](SECURITY.md) before adding an API.

## Licensing

- Application source code: [MIT License](LICENSE)
- Essays, editorial content, fonts, images and other media: see
  [CONTENT_LICENSE.md](CONTENT_LICENSE.md)
