# hasannawaz.com

Design engineering partner site. Plain HTML, CSS and classic scripts, no build step.
How it looks, sounds, moves and performs: [DESIGN.md](DESIGN.md).

## Hosting (Cloudflare Workers, connected to this repo)

The Worker `designengineer` deploys on every push to `main` with `npx wrangler deploy`
(no build command). `wrangler.jsonc` serves the repo root as static files, and
`.assetsignore` keeps `scripts/`, `DESIGN.md` and this README out of the upload. `_headers`
sets caching and security headers, `_redirects` sends the old portfolio pages to
product.hasannawaz.com, and `404.html` answers any missing page.

## Working locally

```bash
python3 scripts/serve.py 5175
```

- Articles: `python3 scripts/build-articles.py` regenerates `thoughts/` and the homepage list from the Medium feed.
- Reels: `scripts/reel/` (see the comments at the top of each script).
