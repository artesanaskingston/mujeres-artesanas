# Mujeres Artesanas de Kingston

Bilingual (ES/EN) website, built with [Eleventy](https://www.11ty.dev/) and edited with [Pages CMS](https://pagescms.org/).

- `src/index.njk`: the page template (design, fixed text, scripts)
- `content/`: editable content (home text, events, gallery, testimonials, report), managed in Pages CMS via `.pages.yml`
- `media/`: uploaded photos and PDFs (photos are resized at build time)

```bash
npm install
npm start        # local preview at http://localhost:8080
npm run build    # output in _site/
```

Deployed on Cloudflare Workers (static assets from `_site/`, see `wrangler.jsonc`).
