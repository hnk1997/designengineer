# Handoff — hasannawaz.com (design engineering partner site)

Everything a new assistant (or person) needs to pick this up from zero. Written 2026-10-29.
Read this first, then `DESIGN.md` (the design system: voice, tokens, components, motion, performance).

---

## 1. Who and what

- **Owner:** Hasan Nawaz. Senior product designer and design engineer in Dubai, 7+ years.
  Email `heyhasannawaz@gmail.com` · WhatsApp `+971 54 794 5306` · GitHub `hnk1997`.
- **Two sites:**

| Site | What | Code | Hosting |
|---|---|---|---|
| **hasannawaz.com** | The new "design engineering partner" landing site (this folder). Goal: get founders and product leads to email or WhatsApp him about a project. | `/Users/hasannawaz/Desktop/Shortcuts/hasancooks2` → GitHub **[hnk1997/designengineer](https://github.com/hnk1997/designengineer)** | **Cloudflare Workers** (Worker named `designengineer`), auto-deploys on every push to `main` |
| **product.hasannawaz.com** | His older product-design portfolio (a Framer export: case studies, About, awards, testimonials). Aimed at hiring managers. | `/Users/hasannawaz/Desktop/Shortcuts/hasannawaz` → GitHub **[hnk1997/hasannawaz](https://github.com/hnk1997/hasannawaz)** | **GitHub Pages** from `main` / root, custom domain via the `CNAME` file |

- An older, unused copy of the portfolio: `/Users/hasannawaz/Desktop/Shortcuts/hasanhere2` → `hnk1997/hasanhere`. Its CNAME file also says `hasannawaz.com`; if GitHub Pages is still on for it, switch it off (Settings → Pages).

---

## 2. How Hasan works (important)

- **Nothing is pushed unless he says "push".** He reviews locally first. Push to `main` = live in ~1–3 minutes.
- He gives short, direct feedback and iterates visually. Show him (screenshot or the browser), don't describe.
- He cares a lot about polish: "immaculate", "premium", "award-winning". Calm motion beats flashy.
- **One thing at a time** when he sends several requests.
- Confirm before anything outward-facing (DNS, accounts, deleting things).
- He has access to a friend's (Justin's) Cloudflare account too. **Always check the account switcher shows Hasan's own account** before any Cloudflare setup.

### Content rules (always)
- First person, plain, dry wit, no exclamation marks, no buzzwords, no emoji in copy, no em-dash asides.
- Numerals, never words ("2 distinct", "3 minutes"). Experience is always **"7+ years"**.
- Never invent or paraphrase testimonials; trim real ones only, marking cuts with "…".
- Full names first ("Kuwait Finance House Capital", then "KFH Capital").
- Don't name awards on project cards; "award-winning" is enough. Awards: **6x** total (Cannes Lions 2026: 1 silver, 2 bronze, 5 shortlists for The Birdwatcher; Loeries: 2 silver, 1 bronze).
- No "01 / 02" index numbers or "Fig." labels as decoration.
- Highlight colour is the site blue `#2563EB` (a lede's second sentence goes blue).
- Keep visitors on the site: articles are republished locally, never linked out to Medium.
- Never use Apple's device bezels/Design Resources (licence); the site uses its own SVG frames.

---

## 3. Hosting and DNS (current, working)

- **Domain registrar:** Spaceship (spaceship.com). Nameservers changed to Cloudflare: `connie.ns.cloudflare.com`, `noel.ns.cloudflare.com`. Don't edit DNS at Spaceship any more; it says "Managed with Custom DNS".
- **Cloudflare (Hasan's own account):** zone `hasannawaz.com`.
  - `hasannawaz.com` and `www.hasannawaz.com` → custom domains on the Worker `designengineer` (Workers & Pages → designengineer → Settings → Domains & Routes).
  - `product` → **CNAME `hnk1997.github.io`**, **DNS only (grey cloud)**.
  - Old GitHub A records for the apex were deleted.
- **Worker build settings** (Workers & Pages → designengineer → Settings → Build): repo `hnk1997/designengineer`, branch `main`, no build command, deploy command `npx wrangler deploy`, root `/`.
- **Repo files that control hosting:**
  - `wrangler.jsonc` — serves the repo root as static assets, `404.html` for missing pages.
  - `worker.js` — runs only for `/assets/work/*` and `/assets/building/*` (`run_worker_first`) to answer byte-range requests, which the static asset server doesn't. Without it iPhones download each reel in full before playing. It also sets those files' caching, since `_headers` doesn't apply to Worker responses. Check after a deploy: `curl -sI -H 'Range: bytes=0-99' https://hasannawaz.com/assets/work/cadillac.mp4` should say `206`.
  - `.assetsignore` — keeps `.git`, `scripts/`, `DESIGN.md`, `README.md`, `HANDOFF.md`… out of the upload (Workers caps a file at 25 MiB; `.git` once broke the deploy).
  - `_headers` — caching (vendor/fonts 1 year immutable; reels/posters/logos/og 1 day + stale-while-revalidate) and security headers.
  - `_redirects` — old portfolio URLs (`/dxb.html`, `/kia`, `/about.html`…) → 301 to `product.hasannawaz.com`.
  - `robots.txt`, `sitemap.xml`, `404.html`.

### ⚠️ Open issue: product.hasannawaz.com HTTPS
GitHub Pages is stuck on **"DNS Check in Progress"** and hasn't issued a certificate, so `https://product.hasannawaz.com` shows a browser "not safe" warning (`http://` works). DNS is correct. Two fixes, Option 1 recommended:
1. **Let Cloudflare do HTTPS:** Cloudflare → DNS → edit `product` → set **Proxied** (orange). Then SSL/TLS → Overview → mode **Full** (not "Full (strict)"). Leave GitHub's "Enforce HTTPS" unticked.
2. **Nudge GitHub:** repo `hnk1997/hasannawaz` → Settings → Pages → Custom domain → Remove → wait a minute → re-add `product.hasannawaz.com` → Save; optionally verify the domain under GitHub profile → Settings → Pages. Can take hours.
Hasan hadn't confirmed which he did when this was written. Check: `curl -sv https://product.hasannawaz.com 2>&1 | grep subject` should name `product.hasannawaz.com`, not `*.github.io`.

---

## 4. ⚠️ Uncommitted work in the site repo (not live yet)

At handoff, these changes are on disk in `hasancooks2` but **not committed or pushed**. Hasan had been shown them and asked "push these changes live?". Ask him before pushing.
- Kia Tasman showcase → **Cadillac IQ** (new reel `assets/work/cadillac*.mp4`, poster, edit list `scripts/reel/cadillac.json`).
- Dubai Airports showcase → **GrowthMotive** on a laptop (new reel `assets/work/growthmotive*.mp4`, edit list `scripts/reel/growthmotive.json`).
- GrowthMotive removed from Currently building (its old clips deleted from `assets/building/`).
- WhatsApp sticky button: shadow removed (`styles.css`).
- Reel tooling upgrades in `scripts/reel/reel.swift` and `scripts/reel/capture.py` (see §7).
- `HANDOFF.md` (this file).

To ship: `git add -A && git commit -m "…" && git push` from `hasancooks2`.
Optional cleanup Hasan may want: `assets/work/kia-tasman*` and `assets/work/dubai-airports*` are no longer used by the page (kept in case he switches back); `assets/building/growthmotive-logo.svg` and the `.build-logo--gm` CSS rule are unused now.

Portfolio repo (`hasannawaz`) is clean and pushed (latest: email → heyhasannawaz@gmail.com, Loeries row added).

---

## 5. The site, section by section (`index.html`)

Static HTML, one `styles.css`, classic scripts on `window.HC` (`js/ui.js`, `js/textures.js`, `js/scene.js`, `js/annotations.js`, `js/main.js`). No framework, no build step; also works opened from `file://`.

1. **Hero** — live three.js 3D layer stack (self-hosted three.js r160 in `assets/vendor/three-0.160.0/`), headline **"Design / engineering / partner."** (3 lines), Get in touch button, intro paragraph, rotating testimonial card. On phones the headline + CTA sit at the bottom (thumb reach) and the stack is fitted into the space above by measuring its real on-screen bounds (`fitBand` in `js/scene.js`). Performance governor degrades quality, never turns 3D off.
2. **Stats / Track record** — 6x awards, 9+ industries, 2M+ people, 15+ brands (count-up).
3. **Selected work** (`#work`) — sticky device stage with wipes between projects. Order: **The Birdwatcher** (laptop) · **McNomNoms** (phone) · **Cadillac IQ** (laptop) · **GrowthMotive** (laptop). Each step has a disabled "Case study coming soon" button. On phones/tablets the stage pins to the top half and the text scrolls below. Clips play only while their layer shows.
4. **Why me** — bento tiles (1 partner no drift, activity log, brands, 6x award wreath, quotes).
5. **What I do** (`#services`) — 5 rows (Research, Design, Build, QA, Launch). Desktop: hover plays the row's diagram. Phones/touch: the row crossing mid-screen plays. One at a time.
6. **How I work** (`#process`) — dark band, 4 steps + "Ways to work together" cards.
7. **Thought leadership** — 6 articles in `thoughts/*.html`, generated by `scripts/build-articles.py` from his Medium RSS (republished here, never linked out). Each article has its own link-preview card `assets/og/<slug>.jpg`.
8. **Currently building** — BrokerConnector (looping 3D city clip) and Kuraimi Islamic Microfinance Bank (logo bloom + home-screen teaser).
9. **Hiring banner** — "Hiring a product designer?" → `https://product.hasannawaz.com/`.
10. **Footer** (`#contact`, dark) — big email (click copies), WhatsApp line, socials (LinkedIn, Behance, Dribbble `HNK001`, Instagram `hasan.dsign`, Medium `@hasannawaz97`).
- **Sticky UI:** "Get in touch" top-right once the nav scrolls away; **WhatsApp** button bottom-right (52px desktop, 44px phone, no shadow, hover label "Chat on WhatsApp", hides over the footer and under the menu). No pre-filled message (Hasan removed it; the visitor writes their own).
- **Mobile hero:** on touch screens the hold-back and frame shrink run as CSS scroll-driven animations (`hero-hold`, `hero-shrink` in `styles.css`), so they stay in step with the finger; desktop keeps the JS version. Reels start loading about a screen early (`warm()` in `js/ui.js`), and reels that fade in from black carry `data-from="0.7"` with posters taken at 0.7s, so the poster hands over with no black flash.
- **Link previews:** `assets/og.jpg?v=3` (home card) + per-article cards. Bump the `?v=` when the home card changes.

---

## 6. Running it locally

```bash
cd /Users/hasannawaz/Desktop/Shortcuts/hasancooks2
python3 scripts/serve.py 5175      # then open http://localhost:5175
```
(Port 5173 belongs to another of his projects; don't kill it.)
Portfolio: `cd /Users/hasannawaz/Desktop/Shortcuts/hasannawaz && python3 -m http.server 5190`.
Articles: `python3 scripts/build-articles.py` (needs the Medium feed; a new article needs a slug/caption/cover added in the script, and a preview card made).

---

## 7. Reel pipeline (how the showcase videos are made)

No ffmpeg or Homebrew on this Mac. Everything uses macOS's own video stack + headless Chrome.

- **`scripts/reel/reel.swift`** — the encoder/editor (AVFoundation + VideoToolbox). Compile once:
  `swiftc -O -o /tmp/reel scripts/reel/reel.swift`
  - `reel info|sheet|still <movie>` — inspect, contact sheet, single frame.
  - `reel cut <movie> <edit.json> <out.mp4>` — frame-exact shots, speed, `fade`/`black`/`wipe` transitions, fade in/out. Edit JSON can add `"zoom": 1.06` (scale past cover, centred, to fill the screen), `"sources": [...]` with a shot `"src": n` to cut between several recordings, and `"fit": "width"` to keep a wider recording's full width (top-anchored, gap filled with the page colour; used for Cadillac so the crest isn't cropped).
  - `reel frames <dir of PNGs> <out.mp4> [fps] [h264|hevc] [bitrate]` — encode a rendered frame sequence.
  - Output: 1512×982 for the laptop screen, 660×1434 / 602×1310 for phones, HEVC (~1.5–1.7 Mbps) + H.264 (~2.4–2.6 Mbps), fast-start. Posters → 1200px WebP.
- **`scripts/reel/capture.py`** — records a live web page as an evenly timed frame sequence by taking over its clock. Env: `VW/VH/SCALE`, `WARM`, `LOOP`, `XFADE` (seam crossfade for loops), `SETUP`, `ACTIONS` (JSON `[[seconds, js], …]`, e.g. clicks), `SCROLL` (JSON keys `[[seconds, y | "selector" | ["selector", offset]], …]`, eased), `MOBILE=1`, and **`VIRTUAL=1`** (timers + Web Animations/CSS animations also run on the virtual clock — needed for GrowthMotive's page transitions and GSAP). Then encode with `reel frames`.
- **`scripts/reel/journey.js` + `scripts/reel/<project>/journey.html`** — animate Figma SVG exports layer by layer on one timeline (McNomNoms, Dubai Airports, Kia, Kuraimi). `scripts/reel/render.py <url> <out_dir> [scale]` renders them frame by frame. The SVG sources must be served next to the page (see §8).
- **`scripts/reel/phone-card.py`** — frames a phone recording as a 16:10 card (used for the old GrowthMotive mobile clip).
- Reel rules Hasan set: ~1x speed (never fast), best parts only (~10–20 s), calm dips through black between busy screens (no ghosting crossfades), no zooms, configurator angles cut instantly, bottom sheets change content in place (no sideways slide), loops close cleanly.

Current reels and how each was made:
| Reel | Source | Made with |
|---|---|---|
| The Birdwatcher | Hasan's screen recording `~/Desktop/Screen Recording 2026-10-28 at 4.46.12 AM.mov` | `reel cut` + `scripts/reel/birdwatcher.json` |
| McNomNoms | Figma SVGs `~/Desktop/mcnomnoms/` | `journey.js` + `scripts/reel/mcnomnoms/journey.html` → `render.py` → `reel frames` |
| Cadillac IQ | Hasan's recording `~/Desktop/cadillac scroller2.mp4` (the lineup carousel), used whole | `reel cut` + `scripts/reel/cadillac.json` (1.5x, `zoom: 1.06`). Earlier versions are in `hasancooks2-workspace/old-reels/` |
| GrowthMotive | Live site https://www.growthmotive.co/ recorded with `capture.py VIRTUAL=1`; raw takes saved in the workspace (§8) | `reel cut` + `scripts/reel/growthmotive.json` |
| BrokerConnector (building) | Local site `~/Desktop/Shortcuts/BrokerConnector/BrokerConnector 3/index.html` | `capture.py` with seam crossfade (8 s loop) |
| Kuraimi (building) | Figma SVGs `~/Downloads/Kuraimi/` | `scripts/reel/kuraimi/journey.html` → `render.py` |
| Kia Tasman (unused now) | Figma SVGs `~/Desktop/kia tasman/` (+ `Desktop/LX/` angle renders) | `scripts/reel/kia/journey.html` |
| Dubai Airports (unused now) | Figma SVGs `~/Desktop/dxb/` | `scripts/reel/dxb/journey.html` |

---

## 8. Files outside the repo

- **Workspace (keep it):** `/Users/hasannawaz/Desktop/Shortcuts/hasancooks2-workspace/`
  - `reel-sources/` — ready-to-serve folders for the SVG journeys (each `<project>/` has the SVGs + `journey.html`, with `journey.js` at the top). Serve with `cd reel-sources && python3 -m http.server 5197`, then `python3 scripts/reel/render.py http://127.0.0.1:5197/<project>/journey.html <out_dir> <scale>`.
  - `recordings/` — raw GrowthMotive takes (`growthmotive-motive-flow.mp4` is the main source passed to `reel cut`; `growthmotive-home-boxes-work.mp4` is referenced by `scripts/reel/growthmotive.json`).
  - `banners/` — HTML sources of the social covers (`linkedin.html`, `behance.html`, `whatsapp.html`, `medium.html`, older `banner2.html`) + `stack.png` (the hero 3D stack, captured without text). Render with headless Chrome at the file's size.
  - `og-cards/` — HTML sources of the link-preview cards.
- **Social covers (final, on the Desktop):** `linkedin-banner.png` (3168×792) + `linkedin-banner-1584x396.png`, `behance-cover-3200x410.png`, `whatsapp-business-cover-1920x1080.png/.jpg`, `medium-header-1500x500.png`. Current copy on all: "Enterprise-grade digital products, / from idea to launch. / **7+ years, 6x award-winning.**" (last line blue `#3b7bff`) + `HASANNAWAZ.COM →` button + the 3D stack. They aren't uploaded anywhere by us; Hasan uploads them.
- **Design assets from Hasan:** `~/Desktop/mcnomnoms`, `~/Desktop/dxb`, `~/Desktop/kia tasman`, `~/Desktop/Cadillac`, `~/Downloads/Kuraimi`, `~/Desktop/Shortcuts/Growth Motive` (brand files + the local GrowthMotive site), `~/Desktop/Shortcuts/BrokerConnector`.
- **Brand/logo kit:** `~/Desktop/Shortcuts/favicon-site-colours_1` (used for the site's favicon and logo).
- The old manual-upload folder `~/Desktop/hasannawaz-site` is obsolete (deploys are via git now); safe to delete.

---

## 9. Design system in one paragraph (full version: `DESIGN.md`)

Dark (`#050505`) and paper (`#eceef1`) grounds, one accent blue `#2563EB`; rose/orange only in glows. One typeface: **Inter Tight** (self-hosted, 400/500), tight negative tracking on display sizes, 12px uppercase labels at +0.08em with a small blue square marker. Square corners, no UI shadows, hairline rules with "+" registration marks. Buttons: white label block + blue arrow square. Motion: two easings (`cubic-bezier(.16,1,.3,1)` out, `(.65,0,.35,1)` in-out), reveal on scroll, play only what's visible, hover only for mice (touch gets scroll-driven versions), reduced motion respected. Budgets: first load ≤1.5 MB before video, 0 long tasks, 0 layout shift, each reel ≤~4.5 MB H.264.

---

## 10. Things that were tried and rejected (don't redo)

- Hero headline "I design it. Then I build it." → replaced by "Design engineering partner." (no label above it).
- Sticky nav bar (too prominent); bottom-placed Get in touch on mobile (he wants top-right).
- Full-width blue highlight panel / gliding highlight on What I do (went back to the original square-to-diagram effect).
- Dark-glow or "fluid glow" hiring banner; a moving ticker; dark article thumbnails; card hover shadows/lifts.
- Fast reels (>1.1x), zoom transitions, sideways-sliding sheets, ghosting crossfades, full macOS UI around the Birdwatcher reel.
- A "lite" low-performance version of the site (everyone gets the 3D; it self-tunes instead).

---

## 11. Likely next steps

1. Ask Hasan whether to push the uncommitted work (§4), then push.
2. Fix product.hasannawaz.com HTTPS (§3, Option 1).
3. Optional: delete unused Kia / Dubai Airports reels and the GrowthMotive logo/CSS rule.
4. When a case study is ready, replace that project's "Case study coming soon" button with a real link.
5. New article → run `build-articles.py`, add its cover + preview card, push.
