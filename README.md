# hasannawaz.com

Design engineering partner site. Plain HTML, CSS and classic scripts, no build step.
How it looks, sounds, moves and performs: [DESIGN.md](DESIGN.md).

## Hosting (Cloudflare Pages, connected to this repo)

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `rm -rf scripts DESIGN.md README.md` |
| Build output directory | `/` |
| Production branch | `main` |

The build command only strips the tooling and docs, so they aren't published. Every push to
`main` redeploys. `_headers` sets caching and security headers, `_redirects` sends the old
portfolio pages to product.hasannawaz.com.

## Working locally

```bash
python3 scripts/serve.py 5175
```

- Articles: `python3 scripts/build-articles.py` regenerates `thoughts/` and the homepage list from the Medium feed.
- Reels: `scripts/reel/` (see the comments at the top of each script).
