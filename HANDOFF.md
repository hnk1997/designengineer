# Handoff — hasannawaz.com (design engineering partner site)

Everything a new assistant (or person) needs to pick this up from zero. Last updated 2026-11-06.
Read this first, then `DESIGN.md` (the design system: voice, tokens, components, motion, performance).

---

## 1. Who and what

- **Owner:** Hasan Nawaz. Design engineer and product designer in Dubai, 7+ years. Since 09/2026 an
  independent **design engineering partner** (founders, agencies, product teams); before that Senior
  Product Designer at MRM McCann (06/2024 to 09/2026).
  Email `heyhasannawaz@gmail.com` · WhatsApp `+971 54 794 5306` (see the open question in §11) · GitHub `hnk1997`.
- **Two sites:**

| Site | What | Code | Hosting |
|---|---|---|---|
| **hasannawaz.com** | The "design engineering partner" landing site (this folder). Goal: get founders and product leads to email or WhatsApp him about a project. | `/Users/hasannawaz/Desktop/Shortcuts/hasancooks2` → GitHub **[hnk1997/designengineer](https://github.com/hnk1997/designengineer)** | **Cloudflare Workers** (Worker named `designengineer`), auto-deploys on every push to `main` (live in ~30–90 s) |
| **product.hasannawaz.com** | His product-design portfolio (a Framer export: case studies, About, awards, testimonials). Aimed at hiring managers. Title: **"Senior Product Designer"**. | `/Users/hasannawaz/Desktop/Shortcuts/hasannawaz` → GitHub **[hnk1997/hasannawaz](https://github.com/hnk1997/hasannawaz)** | **GitHub Pages** from `main` / root, custom domain via the `CNAME` file (live in ~1 min) |

- An older, unused copy of the portfolio: `/Users/hasannawaz/Desktop/Shortcuts/hasanhere2` → `hnk1997/hasanhere`. Its CNAME file also says `hasannawaz.com`; if GitHub Pages is still on for it, switch it off (Settings → Pages).

---

## 2. How Hasan works (important)

- **Nothing is pushed unless he says "push".** He reviews locally first.
- He gives short, direct feedback and iterates visually. Show him (screenshot, the browser, or send the file), don't describe.
- He cares a lot about polish: "immaculate", "premium", "award-winning". Calm motion beats flashy.
- **One thing at a time** when he sends several requests.
- Confirm before anything outward-facing (DNS, accounts, deleting things).
- He has access to a friend's (Justin's) Cloudflare account too. **Always check the account switcher shows Hasan's own account** before any Cloudflare setup.
- For copy he wants drafts in the chat first, then the file. He'll trim hard; keep it short and specific.

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
- Kuraimi Islamic Microfinance Bank: he is **leading the design** of its new app, not building it. Say so exactly.
- Positioning line he likes: "I partner with founders, agencies and product teams…" (partner *with*, not design *for*).

---

## 3. Hosting and DNS (current, working)

- **Domain registrar:** Spaceship (spaceship.com). Nameservers are Cloudflare: `connie.ns.cloudflare.com`, `noel.ns.cloudflare.com`. Don't edit DNS at Spaceship any more.
- **Cloudflare (Hasan's own account):** zone `hasannawaz.com`.
  - `hasannawaz.com` and `www.hasannawaz.com` → custom domains on the Worker `designengineer`.
  - `product` → CNAME `hnk1997.github.io`, now **proxied** (Cloudflare serves HTTPS). The old "not safe" certificate problem is **fixed**: the certificate verifies (Google Trust Services, `CN=hasannawaz.com`).
- **Worker build settings:** repo `hnk1997/designengineer`, branch `main`, no build command, deploy command `npx wrangler deploy`, root `/`.
- **Repo files that control hosting:**
  - `wrangler.jsonc` — serves the repo root as static assets (`ASSETS` binding), `404.html` for missing pages, runs `worker.js` first for `/api/*` and the reel folders, and binds Workers AI (`AI`).
  - `worker.js` — runs only for `/assets/work/*` and `/assets/building/*` and answers **byte-range requests**, which the static asset server doesn't. Without it iPhones download each reel in full before playing. It also sets those files' caching, since `_headers` doesn't apply to Worker responses. Check after a deploy: a `Range: bytes=0-99` request for any reel should return `206`.
  - `.assetsignore` — keeps `.git`, `scripts/`, `worker.js`, `DESIGN.md`, `README.md`, `HANDOFF.md`… out of the upload (Workers caps a file at 25 MiB; `.git` once broke the deploy).
  - `_headers` — caching (vendor/fonts 1 year immutable; posters/logos/og 1 day + stale-while-revalidate) and security headers.
  - `_redirects` — old portfolio URLs (`/dxb.html`, `/kia`, `/about.html`…) → 301 to `product.hasannawaz.com`.
  - `robots.txt`, `sitemap.xml`, `404.html`.
- **This Mac can't resolve hasannawaz.com or product.hasannawaz.com** through its own DNS (it still has the old answer cached), and the in-app browser pane can't open them either. Test the live sites with curl over Cloudflare's DNS: `curl -s --doh-url https://1.1.1.1/dns-query https://hasannawaz.com/` (needs the sandbox off).
- **Paths with `@` get redirected.** The Workers asset server 307-redirects `@` to `%40`; that's why three.js now lives in `assets/vendor/three-0.160.0/` (not `three@0.160.0`). Don't put `@` in asset paths.

---

## 4. State at handoff

**Everything is committed and pushed** in both repos; nothing is waiting locally.

Shipped to hasannawaz.com in this session (newest last):
- Selected work: Kia Tasman → **Cadillac IQ**, Dubai Airports → **GrowthMotive** (laptop); GrowthMotive left Currently building.
- WhatsApp: button shadow removed; **no pre-filled message** (opens an empty chat; also in the articles and `build-articles.py`).
- Byte-range Worker for the reels; reels load ahead (see §5); no black flash when a reel starts; mobile hero smooth (scroll-driven); phone mockup sized off the laptop (1.5×).
- First-visit **blueprint intro** in the hero (see §5).
- three.js moved out of the `@` path (it was costing a redirect on every visit).
- Reel preloading after the hero: all reels on desktop, first 2 on phones.
- McNomNoms "Tap to tickle me" bubble fixed (no ghosting); GrowthMotive re-recorded so each Box plays its animation.
- **Phone-size reels** (≤599px wide screens): about a third of the size, no visible quality difference.

Latest round on hasannawaz.com: Solve my problem as the main CTA, problem-first Yalla with roles and a progress bar, new section order, client photos, the testimonial bar and Pricing nudge on Pricing, and written Yalla answers when the AI runs out (details in §5).

Shipped to product.hasannawaz.com:
- Link-preview cards: every page has a 1200×630 JPG in `assets/og/` (WebP previews were being dropped by WhatsApp/LinkedIn/iMessage). Home and About use a designed card (source `hasancooks2-workspace/og-cards/portfolio.html`, `#about` for the About variant).
- Title briefly changed to "Product Designer", then **back to "Senior Product Designer"** at Hasan's request (home headline, titles, descriptions, preview cards). Past job titles and case-study "Role" lines were never changed.
- About → Work Experience: new **Design Engineering Partner** (Independent · 2026 - Present) with the partner paragraph (§8); MRM MENAT now 2024 - 2026.
- Home shows the top 4 case studies (Sastaticket search to book, Sastaticket Wallet, Aramco, Design System) and a "See more case studies" button (`.hn-more-cta`, `hn-cta hn-cta-secondary`) to the new **`case-studies.html`**: the same shell as the home page (nav, glow, cards, footer) with KFH Capital, Dubai Airports, Cadillac and Kia, a "More case studies" heading instead of the photo hero, and a "Back to selected case studies" button. It was cut from `index.html` by script; if the home page's card markup changes, rebuild it the same way (or edit both).

Optional cleanup still open: `assets/work/kia-tasman*` and `assets/work/dubai-airports*` are unused (kept in case he switches back); `assets/building/growthmotive-logo.svg` and the `.build-logo--gm` CSS rule are unused; each step's hidden `.showcase-media` copy of the device markup is never shown (`display: none` everywhere) and could go.

---

## 5. The site, section by section (`index.html`)

Static HTML, one `styles.css`, classic scripts on `window.HC` (`js/ui.js`, `js/textures.js`, `js/scene.js`, `js/annotations.js`, `js/yalla.js`, `js/main.js`). No framework, no build step; also works opened from `file://`.

1. **Hero** — live three.js 3D layer stack (self-hosted r160 in `assets/vendor/three-0.160.0/`), headline **"Design / engineering / partner."**, Solve my problem button with a moving Yalla logo and a small Takes 1 minute bubble (the main CTA: it opens Yalla straight into scoping; Get in touch stays in the nav and menu), intro paragraph, rotating testimonial card without photos. The floating Yalla stays hidden until this button scrolls away. On phones the headline + CTA sit at the bottom and the stack is fitted into the space above (`fitBand` in `js/scene.js`). A performance governor degrades quality, never turns 3D off.
   - **First-visit blueprint intro.** On a first visit the hero opens as a blueprint: drafting grid with "+" marks (`.hero-bp`, marks built in `main.js`), the headline in outline inside a blue Figma-style selection box with 4 handles (CSS on `.bp .hero-title::before/::after`). Each line fills in white as the page really loads (parsed → font → 3D warmed), at least 0.6 s, at most 2.5 s, then the outline and grid fade and the usual intro plays (nav, button, intro text rise; layers drop). Return visits skip it (`localStorage` key `hn-seen`). Classes: `bp` while it shows, `bp-done` as the outline fades, `bp-was` afterwards (stops the headline sliding in a second time). The 3D waits on `blueprint.released` before its drop. Skipped with reduced motion or a `#hash` URL.
   - **Test switches:** `?blueprint` shows it every time; `?blueprint=slow` also plays it at its full 2.5 s. Work on the live site too.
   - **Mobile scroll:** on touch screens the hold-back and frame shrink run as CSS scroll-driven animations (`hero-hold`, `hero-shrink` in `styles.css`) so they stay in step with the finger; desktop keeps the JS version (`applyScroll` in `main.js`). Address-bar resizes no longer resize the canvas. A pinned (sticky) version was tried and rejected.
   - Gotcha: `--drift` is registered as an `<integer>` `@property` for the Why me tile, so CSS reads the hero's `--drift: 0.7` as 0. JS falls back to 0.7, and the `hero-hold` keyframe writes 0.7 out. Don't rely on `var(--drift)` in hero CSS.
2. **Stats / Track record** — in this order: 6x awards, 15+ enterprise brands, 2M+ people, 10+ industries (count-up).
3. **Selected work** (`#work`) — sticky device stage with wipes between projects. Order: **The Birdwatcher** (laptop) · **McNomNoms** (phone) · **Cadillac IQ** (laptop) · **GrowthMotive** (laptop).  On phones/tablets the stage pins to the top half and the text scrolls below. Clips play only while their layer shows. The phone mockup is sized off the laptop (1.5× the laptop's height, via container units on `.stage-layers`); 1.2× was too small, full stage height too big.
4. **Currently building** (compact, right after the work, because it shows Hasan is busy) — BrokerConnector (looping 3D city clip) and Kuraimi Islamic Microfinance Bank (logo bloom + home-screen teaser).
5. **Why me** — bento tiles (1 partner no drift, activity log, brands, 6x award wreath, quotes with client photos from `assets/people/`).
6. **What I do** (`#services`) — 5 rows (Research, Design, Build, QA, Launch). Desktop: hover plays the row's diagram. Touch: the row crossing mid-screen plays.
7. **How I work** (`#process`) — dark band, 4 steps. A photo of Hasan with Meet the person behind the work (`.me`) sits on the right of the left-aligned title; this section has no label. A full About section felt too heavy. The Ways to work together cards were removed: Pricing covers the same ground.
8. **Pricing** (`#pricing`) — paper band: "Need something custom? Just ask." + WhatsApp, left-aligned head, Projects / Monthly toggle, a clear WhatsApp link for the full rate card (under the plans on phones, `.price-card--foot`), 1 white panel of plans. Prices live in the `index.html` markup. White-label and Sprint are enquire-only. Client photos live in `assets/people/`, used in Why me and the sticky `.proof-bar` (bottom centre on desktop, top on phones).
9. **FAQ** (`#faq`) — straight after Pricing, because price raises the questions it answers.
10. **Thought leadership** — 6 articles in `thoughts/*.html`, generated by `scripts/build-articles.py` from his Medium RSS. Each article has its own preview card `assets/og/<slug>.jpg`. Last section before the footer.
11. **Footer** (`#contact`, dark) — big `WhatsApp me` link and number, then a small email (click copies), socials (LinkedIn, Behance, Dribbble `HNK001`, Instagram `hasan.dsign`, Medium `@hasannawaz97`). The bottom row has a small `Product design portfolio` link to product.hasannawaz.com (it replaced the old hiring banner), Privacy and Back to top.
   **Yalla** (homepage only) — the AI assistant, "Hasan's AI assistant", in `js/yalla.js`. It exists to get WhatsApp messages and to show Hasan can design AI products. A sticky button bottom right (`.yalla-float`) opens a native `<dialog>` from the right, full screen on phones. Its label follows the section in view ("Which plan fits?" on Pricing).
   - **Character (`.yc`):** the logo is a white Y with curved arms and 2 pill eyes with a glint, in an orange circle (`--orange`). `js/yalla.js` makes it alive with the Web Animations API (`moves`: blink, wave, jump, hop, nod, aha, tilt, stretch, pop, glance) using anticipation, squash and stretch, overshoot and arms that follow a beat behind. It blinks, its eyes dart to the pointer and follow what you type, it entertains itself when idle, says hi from the corner up to 3 times, ponders while thinking, nods along as words stream in, jumps when a brief is ready, and shrugs when off-topic. CSS holds moods via `data-mood`. Check poses with `HC.yallaMoves.jump()`, then pause and scrub `document.getAnimations()`. Rejected on the way: a Kufic mark, a spark-headed figure, a gradient square, a glowing orb, the character on black, a dark panel. The panel is light: orange is Yalla, blue is anything tappable, green is WhatsApp.
   - **Emotions:** the model ends each reply with `[[mood: x]]`, and `FEELINGS` in `yalla.js` plays it: excited, happy, proud, curious, sad, surprised, embarrassed, playful. It also dozes off after 12s untouched and reacts when you tap it. `yalla-prompt.txt` holds its personality.
   - **Conversation:** streaming replies with a soft fade, memory of the last 12 messages, a small thinking character with a shimmering status that turns into the reply, always a next step (`keepGoing`: unused starters plus a labelled WhatsApp link), Stop, New chat, Try again on failure. It's meant to feel like a normal AI chat: it stays at the bottom with older messages right above, follows new words unless you've scrolled up (`sticky`), text comes out at a steady pace (`typer`), written answers pause briefly first (`reveal`). The chat survives closing the panel, but a refresh starts over.
   - **Opening screen:** the logo with Yalla's name and role, a small Runs on karak tag with a karak glass icon (`.yalla-karak`), 1 heading, Solve my problem and 3 plain options. None of these call the model. Hasan felt earlier versions looked AI-generated and cluttered, so keep it sparse: no intro text, no subtitles, no avatars in the thread, no boxes around cards. The subtle fluid gradient stays: Hasan asked for it back.
   - **Page behind the sheet:** everything is held still while Yalla is open (CSS animations paused, videos paused and resumed, 3D frames skipped, bento timers skipped), because the hero's grain and 3D read as blinking through the backdrop.
   - **Pricing nudge:** after 15 s in total on Pricing (time adds up across scrolling), once per page load and only if no chat has started, it waves and its own label types Not sure which plan fits? for 9 s (phones show the label just for this). Tapping then starts Solve my problem and is tracked as `yalla_option: pricing nudge`.
   - **Who's asking:** the opening screen has an I am row of white pills, a founder / an agency / a product lead, solid orange when picked (`ROLES`), and the heading fades to the new question when one is picked. It's optional. It changes the heading and first question, reorders the problems and the work card, fills the brief's For field and tells the model. The work order is a guess: check it with Hasan.
   - **Scoping (Solve my problem):** problem first. `PROBLEMS` holds the 6 problems, each with a follow-up that picks the plan, then timing, then `verdict()` gives the plan, starting price and timeline, then Does that work for you? replaces asking for a budget up front (`FIT`: Sounds good or I'd like to talk it through, wording that neither invites a lower price nor says it's fixed). Monthly plans skip timing, White-label and agency work skip the fit check, and I already know what I need goes to the project options. A one-off agency project says Hasan shares pricing directly; confirm with him whether he takes these. A thin bar (`setProgress`) shows progress. Tapped problems are tracked as `yalla_option`. All of it is written and needs no model. If prices change, update `PLANS` in `js/yalla.js` too. Each line reacts to the answer chosen. Dubai words only open and close the flow (karak at the start, khalas at the end), because a word on every line sounded formulaic. Anything typed goes to the model as normal conversation; if the model fails, a typed answer falls back to the written flow.
   - **Cards:** pricing, work and process cards are built from the page itself, so prices never come from the model. Tapping a plan opens its details in the chat, written from the page; only a button labelled Enquire on WhatsApp goes to WhatsApp. Never send people to WhatsApp from something that doesn't say so. Work cards jump to the project on the page.
   - **Brief:** the model and quick answers fill in Problem, Project, For, Timing and Budget in the background. With a project plus 2 more details, a brief card appears in the thread, a small Your brief bar appears under the header for editing, and the header's WhatsApp link carries the brief.
   - **Model:** `POST /api/yalla` in `worker.js`, `@cf/meta/llama-3.3-70b-instruct-fp8-fast` on Workers AI (gpt-oss-120b was slower: 3 to 19 s before the first word, against about 2 s; Llama 4 Scout was 1.5 s but mislabelled and invented more), free plan, so past 10,000 Neurons a day (resets 00:00 UTC) calls fail and never bill. The Worker turns the event stream into plain text; JSON `{limit:true}` means limit or failure. Rules are in `yalla-prompt.txt`, facts in `llms.txt`, both bundled into the Worker. Replies end with `[[fields:…]]`, `[[show:…]]`, `[[handoff]]` or `[[offtopic]]`, parsed in `yalla.js`. If the model skips `show`, keywords in `TOPICS` fill in.
   - **Models tested live, 11/2026, all rejected:** DeepSeek V4.1 Flash and GLM 5.3 Flash need a paid plan (error 5035, so check Cloudflare's paid list first). Gemma 4 26B gave blank replies in 4 to 18 s. Llama 4 Scout was stiffer and handed over too early, Mistral Small 3.1 invented a claim and once took 11 s, SEA-LION invented a Gucci project. Test new models without sending visitors to them.
   - **Performance:** the panel's glow is plain radial gradients, not animated blur, which flickered on phones. `--e`, `--lx` and `--ly` are set on the logo parts only, never the panel, so it doesn't repaint each frame. On phones the page is hidden behind the settled sheet (`yalla-covered`).
   - **Phones:** the page is held still while the panel is open by blocking wheel and touch scrolling outside it (`lock`, on every device). Don't use `overflow: hidden` on the html or `position: fixed` on the body: both break the sticky Selected work stage and make the mockups jump. and the sheet never moves or resizes for the keyboard. Only the message box lifts (`--kb`, a transform), the moment you tap, using the last measured keyboard height. That keeps it clear of the keyboard so Safari doesn't pan the page. Resizing the sheet with `visualViewport` looked jerky and showed the page behind; don't go back to that.
   - **When the AI runs out:** Yalla keeps answering from `WRITTEN` in `js/yalla.js` (keyword matched, facts only, keep in step with `llms.txt`) and scoping still works. A question it can't match gets a karak break line, Solve my problem and a WhatsApp button.
   - **Limits:** 50 messages per visitor per day (edge cache, hash of IP + date, so approximate), 500 characters a message, 1,500 a reply, only requests from hasannawaz.com. Limit or failure hands over to WhatsApp. Typed chats are saved for 30 days in Workers KV (`yalla-chats`, binding `CHATS`) with a random id, the section and the messages, no IP or name (last 12 turns). Hasan reads them at `/api/chats`, protected by the `CHATS_PASSWORD` Worker secret; without it the page is a 404. Nothing is kept for the visitor: a refresh starts a new chat. The note under the message box and `privacy.html` say chats are saved, so keep them true. Turnstile was left out because it's a third-party script.
- **Sticky UI:** "Get in touch" top-right once the nav scrolls away, swapped on Pricing for `.proof-bar`, a bar of short trimmed real quotes (68px on desktop, 48px on phones) that changes every 4 s (a bigger quote card by the prices was tried and removed); **Yalla** bottom-right (hides over the footer and under the menu). The sticky WhatsApp button was removed at Hasan's request on 2026-11-06; WhatsApp stays in the menu, step link, What I do, pricing, footer, article asides and Yalla.
- **How reels load** (`js/ui.js` `warm()`/`playClip()`, `js/main.js`):
  - All videos are `preload="none"`, so the first load stays light. Every reel has a WebP poster taken from the frame it starts on.
  - After the hero is in and the page has loaded, reels download 1 at a time in page order: **all 6 on desktop** (`hover: hover` + fine pointer), **the first 2 on phones/tablets**, just the first with data saver. Each waits for the previous to be playable through, or 10 s.
  - Otherwise each reel starts loading about a screen before it's needed, and the next project's reel loads while the current one plays.
  - Reels that fade in from black (Birdwatcher, Cadillac, GrowthMotive) carry `data-from="0.7"`: the first play starts at 0.7 s and the poster is that frame, so there's no black flash. Seeking needs byte ranges (the Worker; locally `serve.py`).
  - **Phone-size files:** each Selected work `<video>` lists `<name>-m-hevc.mp4` and `<name>-m.mp4` with `media="(max-width: 599px)"` ahead of the full-size sources. Tablets, desktops and landscape phones get full size.
  - Reels keep their names when re-cut and are cached for a day, so a returning visitor can see the old cut for up to a day. Nobody but Hasan has visited yet, so no cache-busting was added; once there are real visitors, add a `?v=` to a reel's links when it's re-cut.
- **Link previews:** `assets/og.jpg?v=3` (home card) + per-article cards. Bump the `?v=` when the home card changes.

---

## 6. Running it locally

```bash
cd /Users/hasannawaz/Desktop/Shortcuts/hasancooks2
python3 scripts/serve.py 5175      # then open http://localhost:5175
```
- `serve.py` turns caching off and answers byte-range requests like the live Worker, so reels stream and `data-from` seeking works. (Python's plain `http.server` doesn't do ranges.)
- **On his phone:** `python3 scripts/serve.py 5176 0.0.0.0`, then `http://<the Mac's Wi-Fi IP>:5176/` on the same Wi-Fi (`ipconfig getifaddr en0`; it was `192.168.18.56`). Add `?blueprint=slow` to watch the intro.
- **Yalla locally:** `serve.py` gives test replies, labelled on the page, so the UI states can be checked: try the 4 starters, then a website, who it's for and a date to fill the brief, a recipe for off-topic, `limit` for the daily limit, anything else for a handoff. For the real model, start it with `CF_ACCOUNT_ID` and `CF_API_TOKEN` set (a Workers AI token on Hasan's own account). No Node on this Mac, so `wrangler dev` isn't available.
- Port 5173 belongs to another of his projects; don't kill it.
- Portfolio: `cd /Users/hasannawaz/Desktop/Shortcuts/hasannawaz && python3 -m http.server 5190`.
- Articles: `python3 scripts/build-articles.py` (needs the Medium feed; a new article needs a slug/caption/cover added in the script, and a preview card made).
- The in-app browser pane is often hidden while testing: it then draws no frames, so rAF, CSS animations and video playback don't advance. Freeze states by hand (add a class, set a variable) and take a screenshot, rather than timing anything there.

---

## 7. Reel pipeline (how the showcase videos are made)

No ffmpeg or Homebrew on this Mac. Everything uses macOS's own video stack + headless Chrome.

- **`scripts/reel/reel.swift`** — the encoder/editor (AVFoundation + VideoToolbox). Compile once:
  `swiftc -O -o /tmp/reel scripts/reel/reel.swift`
  - `reel info|sheet|still <movie>` — inspect, contact sheet, single frame.
  - `reel cut <movie> <edit.json> <out.mp4>` — frame-exact shots, speed, `fade`/`black`/`wipe` transitions, fade in/out. Edit JSON options: `"zoom": 1.06` (scale past cover, centred, to fill the screen), `"sources": [...]` with a shot `"src": n` to cut between several recordings (0 = the one on the command line), `"fit": "width"` (keep a wider recording's full width, top-anchored).
  - Frame grabs snap to the middle of each source frame. Asking for exact boundaries on a 59.99 fps screen recording used to repeat or skip frames (a visible hitch).
  - Speed-ups only look smooth when each output frame is a whole number of source frames: from a 60 fps recording at 30 fps output that's 1x or 1.5x (1.25x judders).
  - `reel frames <dir of PNGs> <out.mp4> [fps] [h264|hevc] [bitrate]` — encode a rendered frame sequence.
  - **Desktop output:** 1512×982 for the laptop screen, 660×1434 for the phone, HEVC + H.264, fast-start. Posters → 1200px WebP from the reel's starting frame (0.7 s for reels that fade in).
  - **Phone output** (`<name>-m.mp4`, `<name>-m-hevc.mp4`): laptop reels 900×585, made with the same edit JSON with `width`/`height` set to 900/585 (H.264 ~0.6–0.9 Mbps, HEVC ~0.45–0.6 Mbps); McNomNoms 440×956 from its rendered frames downscaled. Same bits per pixel as desktop; compared at phone size there's no visible difference. **Re-cut a reel → re-cut its phone version too.**
  - The Birdwatcher source's filename has a special narrow space before "AM"; use a glob (`Screen Recording 2026-10-28 at 4.46.12*.mov`).
- **`scripts/reel/capture.py`** — records a live web page as an evenly timed frame sequence by taking over its clock. Env: `VW/VH/SCALE`, `WARM`, `LOOP`, `XFADE`, `SETUP`, `ACTIONS` (JSON `[[seconds, js], …]`), `SCROLL` (JSON keys `[[seconds, y | "selector" | ["selector", offset]], …]`), `MOBILE=1`, `VIRTUAL=1` (timers + Web Animations/CSS run on the virtual clock; needed for GrowthMotive's GSAP). Build the env in Python (`json.dumps`) rather than shell-quoting ACTIONS. Then encode with `reel frames`.
- **`scripts/reel/journey.js` + `scripts/reel/<project>/journey.html`** — animate Figma SVG exports layer by layer on one timeline. `group(s, [layers])` wraps several layers that form one object (a speech bubble: outline, fill, text) so they move and fade as one; animating them separately lets the outline show through a half-faded fill (ghosting). `scripts/reel/render.py <url> <out_dir> [scale] [times]` renders every frame, or just a few stills for review. The served copy lives in the workspace (§8): edit the repo copy, then copy it to `reel-sources/`.
- **`scripts/reel/phone-card.py`** — frames a phone recording as a 16:10 card (old GrowthMotive mobile clip).
- Reel rules Hasan set: ~1x speed unless he asks (Cadillac is 1.5x at his request), best parts only (~10–20 s; GrowthMotive is 28.5 s because he wanted each Box to play out), calm dips through black between busy screens, no ghosting crossfades, no zooms, configurator angles cut instantly, bottom sheets change content in place, loops close cleanly. Prefer his own recordings used whole over heavy cutting (my multi-source Cadillac cut was "glitchy").

Current reels and how each was made:
| Reel | Source | Made with |
|---|---|---|
| The Birdwatcher | Hasan's screen recording `~/Desktop/Screen Recording 2026-10-28 at 4.46.12 AM.mov` | `reel cut` + `scripts/reel/birdwatcher.json` |
| McNomNoms | Figma SVGs `~/Desktop/mcnomnoms/` | `journey.js` + `scripts/reel/mcnomnoms/journey.html` → `render.py` (scale 1.5) → `reel frames` (H.264 1.4 Mbps, HEVC 0.94 Mbps) |
| Cadillac IQ | Hasan's recording `~/Desktop/cadillac scroller2.mp4` (the lineup carousel), used whole | `reel cut` + `scripts/reel/cadillac.json` (1.5x, `zoom: 1.06`). Earlier versions in `hasancooks2-workspace/old-reels/` |
| GrowthMotive | Live site https://www.growthmotive.co/ via `capture.py VIRTUAL=1`; takes in `hasancooks2-workspace/recordings/` | `reel cut` + `scripts/reel/growthmotive.json` (28.5 s, H.264 1.4 Mbps / HEVC 1.1 Mbps). Hero + Motive from `growthmotive-motive-flow.mp4`, stats and the wipe into Work from `growthmotive-home-boxes-work.mp4`, the 4 Boxes from `growthmotive-boxes-long.mp4` |
| BrokerConnector (building) | Local site `~/Desktop/Shortcuts/BrokerConnector/BrokerConnector 3/index.html` | `capture.py` with seam crossfade (8 s loop), 1200×750 |
| Kuraimi (building) | Figma SVGs `~/Downloads/Kuraimi/` | `scripts/reel/kuraimi/journey.html` → `render.py`, 1200×750 |
| Kia Tasman (unused now) | Figma SVGs `~/Desktop/kia tasman/` | `scripts/reel/kia/journey.html` |
| Dubai Airports (unused now) | Figma SVGs `~/Desktop/dxb/` | `scripts/reel/dxb/journey.html` |

**GrowthMotive Boxes take, to redo it:** the Boxes switch on click (`.acc__item`), and clicking an open one does nothing, so the take calls the site's own `window.GMBoxes.open(item)`. Viewport 1512×982, `SETUP` scrolls `.services__grid` to 163 px from the top, `ACTIONS` open Box 0–3 at 1.2 / 5.0 / 8.8 / 12.6 s (3.8 s each), `LOOP=18`, `XFADE=0`. The site leaves GrowthBox's "+AED 2.4M" label up when LoyaltyBox opens; an action at 12.64 s clears any `.boxviz` leaf whose text contains "AED". Box animations live in the site's `js/main.js` (`services()`, `FX`).

---

## 8. Files outside the repo

- **Workspace (keep it):** `/Users/hasannawaz/Desktop/Shortcuts/hasancooks2-workspace/`
  - `reel-sources/` — ready-to-serve folders for the SVG journeys (each `<project>/` has the SVGs + `journey.html`, with `journey.js` at the top). Serve with `cd reel-sources && python3 -m http.server 5197`, then `python3 scripts/reel/render.py http://127.0.0.1:5197/<project>/journey.html <out_dir> <scale>`.
  - `recordings/` — raw GrowthMotive takes (see §7).
  - `old-reels/` — earlier Cadillac cut (`cadillac-multi/`) and the previous GrowthMotive edit list (`growthmotive-v1.json`).
  - `banners/` — HTML sources of the social covers + `stack.png` (the hero 3D stack without text).
  - `og-cards/` — HTML sources of the link-preview cards (`home.html` etc. for hasannawaz.com; `portfolio.html` for product.hasannawaz.com, `#about` variant).
- **CVs** (`~/Desktop/Resume/`):
  - `Hasan_Nawaz_Design_Engineer_CV.pdf` — title "Design Engineer"; summary leads with "6x award winning Design Engineer…" (no "product designer", no Aramco example, no "Computer Science graduate"); Design Engineering Partner role (09/2026 to Present) with GrowthMotive / BrokerConnector / Kuraimi bullets; MRM ends 09/2026; portfolio link hasannawaz.com.
  - `Hasan_Nawaz_Senior_Product_Designer_CV.pdf` — the product CV: title kept "Senior Product Designer", original summary, "Available Immediately" removed, the same partner role (a partner line + 3 project bullets), MRM ends 09/2026; portfolio link product.hasannawaz.com.
  - Sources: `~/Desktop/Resume/source/design-engineer-cv.html` and `product-designer-cv.html` (DejaVu Serif in `source/fonts/`, matching the original LibreOffice layout). Edit the HTML, then export with headless Chrome: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer --print-to-pdf=../<name>.pdf <file>.html` from `source/`.
  - The originals are untouched (`… CV 2.pdf`, `Old/`).
- **LinkedIn role text** (Hasan pastes it himself; the About page on product.hasannawaz.com uses the same paragraph without the first line):
  > Independent design engineering partner to founders, agencies and product teams. I design and build digital products from first call to launch.
  >
  > I take websites and leaner products end to end. On larger platforms, I design the product and build the front end alongside their engineers. No handoffs, no account managers, no juniors picking up where I left off, so what gets approved is what ships.
  >
  > Recent work includes GrowthMotive and Motive, its AI assistant that finds where growth is stuck in 3 minutes. I'm currently building BrokerConnector and leading design for Kuraimi Islamic Microfinance Bank's new app.
- **Social covers (final, on the Desktop):** `linkedin-banner.png` (3168×792) + `linkedin-banner-1584x396.png`, `behance-cover-3200x410.png`, `whatsapp-business-cover-1920x1080.png/.jpg`, `medium-header-1500x500.png`. Hasan uploads them.
- **Design assets from Hasan:** `~/Desktop/mcnomnoms`, `~/Desktop/dxb`, `~/Desktop/kia tasman`, `~/Desktop/Cadillac`, `~/Desktop/cadillac scroller2.mp4`, `~/Downloads/Kuraimi`, `~/Desktop/Shortcuts/Growth Motive` (brand files + the local GrowthMotive site source), `~/Desktop/Shortcuts/BrokerConnector`.
- **Brand/logo kit:** `~/Desktop/Shortcuts/favicon-site-colours_1`.
- The old manual-upload folder `~/Desktop/hasannawaz-site` is obsolete; safe to delete.

---

## Analytics

- Google Tag Manager `GTM-TCNQ8QDS` sends to GA4 `G-FHPT21Y31F`. `js/analytics.js` loads it after the page, on the live site only (add `?gtm` to load it locally). Tags are managed in Tag Manager, not the repo.
- Published in Tag Manager as version 2. `scripts/gtm-events.json` is an import file with the 5 event tags, triggers and variables, reusable for other containers. Custom dimensions in GA4: CTA location, Plan name, Yalla section, Yalla option. Still to do once it appears in GA4: mark `whatsapp_click` as a key event (Admin → Events → star it).
- Data layer events: `whatsapp_click` (`cta_location`, `plan_name`), `yalla_open` (`yalla_section`), `yalla_option` (`yalla_option`), `yalla_message`, `yalla_brief_ready`. `whatsapp_click` is the key event.
- **Privacy:** never send what visitors type. WhatsApp links carry their question or brief in the URL, so automatic outbound click tracking must stay off in 2 places: GA4 Enhanced measurement, and Tag Manager → Settings → Manage automatic event detection (it defaults on and overrides GA4). No cookie banner: Hasan found it distracting. Tag Manager doesn't load for visitors in Europe (browser time zone, approximate) unless they turn it on from `privacy.html`; anyone else can turn it off there (`hn-consent` in localStorage). `privacy.html` must stay accurate: if Yalla starts saving chats, update it and tell visitors.

- Microsoft Clarity: project `z9m4n2dg2l`, published as a Custom HTML tag (`Clarity - Tracking`, Tag Manager version 3, `scripts/gtm-clarity.json`), so it respects the same Europe rule. The Yalla panel carries `data-clarity-mask`, so chats never appear in recordings.

## SEO and AI search

- `index.html` head holds JSON-LD: `WebSite`, `Person` and `ProfessionalService`, with an `OfferCatalog` of the pricing. `llms.txt` at the root is the same facts in plain text for AI assistants.
- **When prices, plans, stats or contact details change, update 4 places:** the visible section, the homepage FAQ, the JSON-LD (`OfferCatalog` and `FAQPage`) and `llms.txt`.
- **Yalla reads `llms.txt`**, so changing that file changes what it knows. If prices change, also update `PLANS` in `js/yalla.js`.
- **FAQ:** homepage `#faq`, between Pricing and Thought leadership, 9 questions. Each article has 3 "Quick answers" from the `FAQS` dict in `scripts/build-articles.py`, restating only what the article says. A new article needs an entry there or the build fails.
- Articles carry `BlogPosting` + `BreadcrumbList`, generated by `schema()` in `scripts/build-articles.py`. `sitemap.xml` is edited by hand: add new articles with their date, and bump the homepage `lastmod`.
- `robots.txt` names the main AI crawlers as allowed. Checked 2026-11-05: Cloudflare isn't blocking GPTBot, ClaudeBot, PerplexityBot, Googlebot or bingbot. Keep Cloudflare's "block AI bots" setting off.
- Cloudflare serves articles without `.html` and redirects the `.html` version (307), so canonical tags, `sitemap.xml`, JSON-LD and `llms.txt` use `/thoughts/<slug>` with no extension. Internal links keep `.html` so the site still works from disk and on the local server.
- Section statements are `h2`s. Selected work has a hidden `h2`.
- Google Search Console: `hasannawaz.com` verified as a Domain property through a DNS TXT record in Cloudflare (2026-11-05). Don't delete that record. Bing Webmaster Tools was imported from it.

---

## 9. Design system in one paragraph (full version: `DESIGN.md`)

Dark (`#050505`) and paper (`#eceef1`) grounds, one accent blue `#2563EB`; rose/orange only in glows. One typeface: **Inter Tight** (self-hosted, 400/500), tight negative tracking on display sizes, 12px uppercase labels at +0.08em with a small blue square marker. Square corners, no UI shadows, hairline rules with "+" registration marks. Buttons: white label block + blue arrow square. Motion: two easings (`cubic-bezier(.16,1,.3,1)` out, `(.65,0,.35,1)` in-out), reveal on scroll, play only what's visible, hover only for mice (touch gets scroll-driven versions), reduced motion respected. Budgets: first load ≤1.5 MB before video, 0 long tasks, 0 layout shift, each reel ≤~4.5 MB H.264.

`DESIGN.md` is partly out of date: it still says Cloudflare **Pages** and "redeploy the clean folder" (it's Workers + git push now), lists a WhatsApp shadow and pre-fill (both gone), and doesn't cover the blueprint intro, the reel loading strategy or the phone-size reels.

---

## 10. Things that were tried and rejected (don't redo)

- Hero headline "I design it. Then I build it." → replaced by "Design engineering partner." (no label above it).
- Sticky nav bar (too prominent); bottom-placed Get in touch on mobile (he wants top-right).
- Full-width blue highlight panel / gliding highlight on What I do.
- Pricing: a centred head (left-aligned looks better) and a visible Extras block (rate card is on request instead).
- A hiring banner before the footer: it looked like job hunting and sent clients away; it's a footer link now.
- Yalla's budget question before the price, and It's a stretch / Need something smaller as answers: they invite haggling.
- Letter-by-letter typing on Yalla's heading (clunky, it fades now). It's fine on the short Pricing nudge.
- A dark quote card, and a bigger quote card by the prices. The sticky bar replaced them.
- "2 project slots open this month" in the hero and pricing: Hasan felt it looked cheap. Crossed-out discount prices were also ruled out.
- A second WhatsApp button in the hero: 1 button is enough there.
- Pricing v1: outlined tabs with a blue fill, black CTA buttons, separate cards with a dark popular card ("needs to feel more SaaS").
- Dark-glow or "fluid glow" hiring banner; a moving ticker; dark article thumbnails; card hover shadows/lifts.
- Fast reels (>1.1x unless he asks), zoom transitions, sideways-sliding sheets, ghosting crossfades, full macOS UI around the Birdwatcher reel.
- A "lite" low-performance version of the site (everyone gets the 3D; it self-tunes instead).
- **Mobile hero pinned with `position: sticky`** — he disliked the "pinned scroll effect"; it must feel like desktop.
- **A fixed-time splash screen** — the blueprint intro waits for real readiness instead (0.6–2.5 s), first visit only.
- **WhatsApp pre-fill wording** — formal, "saw your website", and warm versions all rejected. Now in use: 1 plain line ("Hi Hasan, can we talk?") on the general links, a message per plan on the pricing CTAs. Full list of WhatsApp entry points in `DESIGN.md` §6. Article pages are edited through `scripts/build-articles.py`; their nav, sticky button, menu and aside all say WhatsApp me instead of Get in touch (`whatsapp_ctas`).
- CV copy: "Computer Science graduate" (reads junior), process lists (research → design → build…), "product designer turned design engineer", leading with the Aramco dashboard.
- Phone mockup at full stage height (too big) and at 1.2× the laptop (too small); 1.5× is right.

---

## 11. Likely next steps

0. **Yalla:** live since 2026-11-06, and the Workers AI stream works. 13 awkward questions run on the live model: it held prices, refused off-topic and tricks, invented nothing. Keep testing as real chats happen. Have a native Arabic speaker check the name and the Dubai words. Typed chats can only be read once the `CHATS_PASSWORD` Worker secret is set. Articles don't have Yalla yet (`scripts/build-articles.py`), and they no longer have a sticky button.
1. **Phone number:** the CVs say +971 54 **477** 5306; the website's WhatsApp link says +971 54 **794** 5306. Ask Hasan which is right and fix the other.
2. Portfolio "Download Resume" button (About page) links a Google Drive file nobody here can see; ask Hasan to check it's the CV he wants.
3. When a case study is ready, add a real link to that project in Selected work.
4. GrowthMotive reel is 28.5 s; if he finds it long, drop CRMBox or trim the opening (~22 s).
5. Optional: a thin blue loading line on a device screen while its reel buffers (offered, not built). Phones could also preload all 4 reels now that the phone files are small.
6. **Check on a real phone:** the keyboard fix, the jump when it opens, the Solve my problem button width (the logo block stretched in Safari) and blinking behind Yalla. None can be proven in a desktop browser. Inspect Element never shows a phone keyboard.
7. **Hasan to answer:** should the hero button show the I am row first (it skips it now)? Does he take one-off agency projects? Is the work order in `ROLES` right?
8. **Risk reversal:** agreed in principle, not built. Hasan to confirm which promises are true (payment in stages, he owns the work, sees the design first, free first call), then add 1 quiet line by Pricing and 2 FAQs. Don't call the price fixed: he doesn't want that, or wording that invites a lower price.
9. Still to add: a photo of Hasan, and 1 true result per project in Selected work. Merging What I do and How I work was raised, not agreed.
10. Payments: decided against a checkout on the site. Send a Ziina or Stripe link on WhatsApp after agreeing scope.
11. Optional cleanup (§4).
12. New article → run `build-articles.py`, add its cover + preview card, push.
