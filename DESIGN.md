# hasannawaz.com — design system

The rules behind hasannawaz.com: how it sounds, how it looks, how it moves, and how it's built
to stay fast. Read this before adding a section, a page, a component or a reel. Every value
here is the one the site actually uses (`styles.css`, `js/`); if the code and this file
disagree, fix one of them.

**The site's one job:** get a founder, product lead or agency to email or WhatsApp Hasan
about a project. Everything else (the 3D, the reels, the bento) exists to earn that.

**The idea in one line:** *I design it. Then I build it.* One person, designer and engineer,
and the site has to prove both: it should look like a senior designer made it and perform like
a senior engineer built it.

---

## 1. Principles

1. **Show, don't claim.** A reel of the real product beats a sentence about it. A diagram that
   plays beats an icon. Claims are numbers (6x, 2M+, 15+) and real quotes, never adjectives.
2. **One loud thing per screen.** The 3D hero, a pinned device, a big WhatsApp line. Around it
   everything is quiet: paper, hairlines, small uppercase labels.
3. **Square, flat, precise.** No rounded cards, no drop shadows on UI, no gradients on buttons.
   Hierarchy comes from type size, hairlines and the one accent blue.
4. **Motion means something.** Things move to show a process (layers stacking, a square opening
   into a diagram, a wipe between projects), never to decorate. Calm over flashy.
5. **Fast is part of the design.** The 3D runs for everyone; it scales its own quality down
   rather than switching off. Nothing loads from third parties.

---

## 2. Tone of voice

Human, first person, plain-spoken, with a dry edge. Like a senior designer talking to a founder
over coffee: confident, specific, never salesy.

**Do**
- Write in the first person, to "you": *"You talk to the person doing the work."*
- Lead with the claim, then the twist in blue: *"Research, design, build, QA and launch.
  **Agencies split that across 5 people. I don't.**"*
- Be specific and concrete: *"Weekly check-ins with real builds you can click, not slides about
  progress."*
- Use dry wit sparingly, once per block at most: *"Judged by people who are very hard to
  impress."* · *"This page didn't ship. The rest of the site did."*
- Keep sentences short. One idea each.

**Don't**
- No exclamation marks. No hedging ("I think", "maybe", "just"). No buzzwords ("synergy",
  "seamless", "cutting-edge", "passionate").
- No em-dash asides, no "not X, but Y" constructions, no emoji.
- No agency "we". It's always "I".
- Never invent or paraphrase a testimonial. Trim real ones only, marking cuts with "…".

**Content rules (always)**
- Numerals, never words: *"1 partner"*, *"2 distinct investor journeys"*, *"3 minutes"*.
- Experience is always **"7+ years"**.
- Names in full on first mention: *"Kuwait Finance House Capital"*, then *"KFH Capital"*.
- Don't name awards on project cards; *"award-winning"* is enough. The 6x award claim lives in
  the stats and the Why me tile.
- Labels and button text are UPPERCASE via CSS, written in sentence case in the HTML
  (`Get in touch`).
- No index numbers or "Fig." labels as decoration (no "01 / 04", "Fig. 01").
- Keep visitors on the site: articles are republished here, never linked out to Medium.
  External links only in the footer socials and the portfolio banner.

**Patterns that recur**
| Pattern | Example |
|---|---|
| Section lede: statement, then blue payoff | *"You get the designer and the developer. **They just happen to be the same person.**"* |
| Card line: what it is, in one breath | *"An Islamic microfinance bank in Yemen. Leading the design of its new banking app."* |
| Status, small caps | `IN PROGRESS` · `TAP TO COPY` |
| Rotating tab title when the visitor leaves | *"No handoffs were harmed"*, *"Figma, meet production"*, *"QA'd on every breakpoint"* |

---

## 3. Colour

Two grounds, one ink each, one accent. The palette comes from the hasannawaz.com fluid gradient
(blue, rose, orange); only blue is used in the UI, rose and orange live in glows.

| Token | Value | Use |
|---|---|---|
| `--dark` | `#050505` | Dark ground: hero, How I work, footer, 404 |
| `--ink` | `#f3f3f3` | Text on `--dark` |
| `--ink-2` | `rgba(243,243,243,.68)` | Secondary text on `--dark` (8.5:1) |
| `--ink-3` | `rgba(243,243,243,.42)` | Tertiary labels on `--dark` only (3.7:1, uppercase labels ≥12px, never body) |
| `--paper` | `#eceef1` | Light ground: stats, work, why, services, articles, building |
| `--paper-ink` | `#0b0c0f` | Text on `--paper` (16.8:1) |
| `--paper-line` | `rgba(11,12,15,.08)` | Hairlines on `--paper` (section rules use `.16`) |
| `--blue` | `#2563eb` | The accent: lede payoffs, `.ico` squares, active rules, links on hover, the `.sq` marker |
| `--rose` | `#e11d48` | Glow only (hero, footer, Why me tiles) |
| `--orange` | `#f97316` | Glow; Yalla's logo, the hero button's logo square and the progress bar |
| Purple | `#7c3aed` | Yalla's fluid glow only |
| `--glass` | `rgba(20,22,28,.56)` + 16px blur | Nav pills and cards over the 3D |
| `--glass-strong` | `rgba(20,22,28,.82)` | Pills when blur is off (`.perf-low`) |
| `--hair` | `rgba(255,255,255,.14)` | Hairlines on `--dark` |
| WhatsApp green | `#25d366` (hover `#1fbe5b`) | Only WhatsApp buttons and glyphs |

**Body text greys on paper:** `rgba(11,12,15,.62)` (5.3:1) for card copy, `.66` (6.1:1) for
service copy. Muted labels on paper use `.5`–`.56` (3.6–4.3:1); keep those to 12px uppercase
labels, never sentences.

**Rules**
- Blue is the only colour that means "this matters". Use it for one phrase per lede, the arrow
  square of a button, and selected or hovered states. Never for whole paragraphs or backgrounds
  of large areas.
- Blue on `--dark` is 3.9:1: fine for 24px+ display text and icons, not for small text.
- White on WhatsApp green is 2:1, which is why the button carries a white glyph, never small
  white text at rest (the hover label is 12px uppercase at 500, accepted as a brand exception).
- Section grounds alternate dark and paper. The floating CTA reads `[data-dark]` sections and
  inverts itself to stay visible.

---

## 4. Typography

**One family: Inter Tight**, variable 300–600, self-hosted (`assets/fonts/`, Latin preloaded,
Latin Extended on demand), with a metric-matched local fallback (`Inter Tight Fallback`:
Arial at 97% size) so nothing jumps when the font arrives. Weights in use: **400** (body),
**500** (everything display and labels). No italics, no bold 700.

| Style | Size | Line height | Tracking | Where |
|---|---|---|---|---|
| Hero | `clamp(52px, 7.4vw, 132px)` (phones `clamp(44px, 13vw, 64px)`) | 0.94 | −0.045em | Hero headline |
| Stat | `clamp(64px, 7vw, 120px)` | 0.9 | −0.055em, tabular figures | Track record numbers, suffix in blue |
| Service | `clamp(40px, 5.2vw, 88px)` | 0.95 | −0.05em | What I do rows |
| Project / article title | `clamp(40px, 4.4vw, 72px)` / `clamp(40px, 5.2vw, 84px)` | 0.98 / 1 | −0.045em | Selected work, article pages |
| Footer WhatsApp | `clamp(40px, 7vw, 96px)` | 1 | −0.05em | `WhatsApp me`, always one line |
| Lede | `clamp(26px, 2.8vw, 44px)` | 1.12 | −0.035em | Section statements |
| Card title | `22px` · post `clamp(22px, 1.9vw, 28px)` | 1.15 | −0.02 / −0.03em | Bento tiles, article cards |
| Body | `17px` (phones 16px) | 1.45 | 0 | Project and service copy, max ~44ch |
| Small body | `15px` | 1.45 | 0 | Tile and card copy |
| Label | `12px` uppercase | 1 | +0.08em | Eyebrows, buttons, pills, statuses |
| Tag | `11px` uppercase | 1 | +0.08em | Service tags |

**Rules**
- Display sizes are fluid (`clamp`), body sizes are fixed. Big type is tight (negative
  tracking, leading under 1); small uppercase type is open (+0.08em).
- A lede's second sentence sits in a `<span>` coloured `--blue`.
- Section labels: a 6px blue square (`.sq`) + uppercase label, always top-left of the section.
- Numbers that line up or count use `font-variant-numeric: tabular-nums`.

---

## 5. Layout and spacing

- **Gutter:** `--gutter` 28px (16px under 768px). Every section pads left and right by it.
- **Grid:** content sits on a 3-column page grid; section heads put the label in column 1 and
  the lede across columns 2–3 (`grid-template-columns: 1fr 2fr`). Faint vertical column lines
  (`--paper-line` / `--hair`) show the grid on hero and footer.
- **Section rhythm:** desktop 112–128px top and bottom; phones 56–88px.
- **Hairline + registration mark:** rows (stats, services) start with a 1px rule and an 11px
  "+" mark at its left end. Rules are `rgba(11,12,15,.16)` on paper.
- **Controls:** `--ctl` 36px tall (44px on touch screens). Buttons 40px (44px on touch).
- **Radius:** 0 everywhere in the UI. Exceptions are physical objects only: device frames
  (measured from the artwork), Currently building media (10px), the 3D layers.
- **Shadows:** none on UI. Allowed on objects that float: Currently building media
  (`0 28px 56px -32px rgba(11,12,15,.35)`), device mockups, Yalla's sticky label.

**Breakpoints**
| Query | What changes |
|---|---|
| `max-width: 1100px` | Bento to 6 columns, hero foot simplifies, building list full width |
| `max-width: 899px` | Nav links become the Menu; Selected work pins its stage to the top half |
| `max-width: 767px` | Phone layout: 16px gutter, hero text at the bottom, one-column bento, stacked rows |
| `max-width: 767px and max-height: 700px` | Short phones: hero drops the annotation and intro |
| `pointer: coarse` | 44px controls, press feedback instead of hover, no tap highlight |
| `hover: hover and pointer: fine` | Hover effects (arrow rolls, What I do diagrams, WhatsApp label) |

**Layers (z-index):** content 2–5 · menu 40 · nav 50 · testimonial bar 54 · floating Get in touch 55 · Yalla 56. The Yalla panel is a `<dialog>` in the top layer.

---

## 6. Components

All are plain HTML + `styles.css`. Markup patterns below are the real ones; copy them.

**Button** (`.btn`): white label block + blue arrow square, 2px apart, 40px tall. The hero's only button is Solve my problem (`.btn--yalla`): a white label with the orange Yalla logo square and a small chat bubble (`.yalla-says`, Takes 1 minute), which opens Yalla straight into scoping. Its logo breathes, blinks, waves and follows the cursor like the launcher.
```html
<a class="btn" href="#contact" data-roll-host>
  <span class="btn-label"><span data-roll>Get in touch</span></span>
  <span class="ico" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M2 8h11M9 4l4 4-4 4"/></svg><svg viewBox="0 0 16 16"><path d="M2 8h11M9 4l4 4-4 4"/></svg></span>
</a>
```
Hover (mouse only): the label's letters roll up (`data-roll`) and the arrow slides out right
while its twin slides in. The twin is parked at `translateX(-260%)` so it never peeks into a
44px box. Diagonal arrows (`↗`, external links) leave diagonally the same way.

**Pill** (`.pill`): glass, 12px uppercase, `--ctl` tall. Nav links and the floating CTA's label.
`.pill--light` = `--ink` fill with `--paper-ink` text.

**Icon square** (`.ico`): `--ctl` square, `--blue` fill, white 14px stroke icon, 1.5 stroke.

**Section head** (`.sec-head`): `.label.sec-label` with `.sq` + `.sec-lede` with a blue `<span>`.

**Testimonial bar** (`.proof-bar`): replaces the floating button on Pricing only. White, square, 1 small photo, a short real quote trimmed with `…`, name and role. 68px tall, bottom centre on desktop; 48px, at the top on phones, because Yalla has the bottom corner. Changes every 4s and glides in and out.

**Floating Get in touch** (`.cta-float`): fixed top right, appears once the nav scrolls away,
inverts on `[data-dark]` sections, hides while the menu is open.

**Reply promise:** `I usually reply within a few hours` sits at the 3 decision points only: pricing, the footer and Yalla's brief card, not on every button.

**WhatsApp entry points:** Yalla, menu (`.menu-wa`), the We talk step (`.step-link`), end of What I do (`.svc-cta`), pricing, footer, and every
article's nav, sticky button, menu and aside, which all say `WhatsApp me` (`.ico--wa`) instead of Get in touch. `.btn--green` is the green glyph square on any button. All pre-fill a message;
the general one is `Hi Hasan, can we talk?`

Honest about what isn't ready; never a fake link.

**Showcase** (`[data-showcase]`): Selected work. Desktop: steps scroll on the left, a sticky
stage on the right; each next device wipes up over the last (`--reveal`, blue leading rule).
Phones/tablets: the stage pins to the top half and the words scroll below. Order alternates
laptop · phone · laptop · phone.

**Device mockups** (`.mock--laptop`, `.mock--phone`): own SVG frames in `assets/devices/`
(never Apple's bezels). Screens are measured into the frame; reels fill them with
`object-fit: cover`. Laptop screen 1512×982, phone 660×1434 (or 602×1310).

**Service row** (`.svc-row`): title, copy, tags. One plays at a time: on desktop the hovered
row, on touch and phones the row crossing the middle of the screen. Playing = blue rule draws in
above, title nudges 0.08em, the diagram opens from the blue square and the blue drains away.

**Bento tile** (`.tile`): Why me. Flat `#eef1f6` surface (`--surface`), one soft colour glow in a corner,
a "+" top right, a live mini-visual, then title + one line. Animations run only while on screen.

**Build card** (`.build`): Currently building. 16:10 looping film, logo, `IN PROGRESS` status
with a pulsing blue dot, one line.

**Pricing** (`.pricing`, `#pricing`): paper band after How I work, left-aligned like every other section.
The head is just the `Pricing` label, so the plans come first. Under the plans, `.price-custom` holds
`Need a custom plan? Just ask.` with a WhatsApp button (`.btn--wa`: white label, green square,
white glyph). A toggle, Projects and Monthly (`.price-tabs`: white thumb in a soft track, sentence case;
`ui.js initPricing`, arrow keys work), with `Ask for the full rate card on WhatsApp` opposite it, with a
WhatsApp glyph so it's clear where it goes. Both panels share 1 grid cell so switching never moves the page.
**Plan card** (`.plan`): 4 white columns in 1 panel split by hairlines. Name, best for, price, CTA, then
timeline or hours and a check list. `.plan--top` is the "Most popular" plan: 2px blue edge, blue tab on
top, the 1 solid blue button. Other CTAs are blue tint with a blue arrow square. No black buttons here.
Every CTA reads `Enquire on WhatsApp`, with a diagonal arrow (`.ico--out`) and a short pre-filled message
naming that plan (`?text=`). The lead button and rate card link have their own. White-label and Sprint show `Enquire`, never a price. 2 columns under 1180px, a
swipeable row with the next card peeking under 768px.

**FAQ** (`.faq`, `.faq-item`): native `<details>` rows with hairlines, a "+" that turns to "×" when open, first
row open. Homepage: label and lede sticky on the left, list on the right, after Pricing. Articles: `.art-faq`,
"Quick answers", under the text. The answer text stays in the HTML for crawlers.

**Yalla** (`.yalla-float`, `.yalla`, `js/yalla.js`): the AI assistant, built to show product thinking. Mark: `.yc`, a white Y
with curved arms and 2 pill eyes, in an orange circle. It's the 1 round shape in the UI, because it's a character. It moves
like 1: anticipation, squash and stretch, overshoot; eyes dart, never drift. Launcher: hidden while the hero's Solve my problem button or the footer is on screen; after 15s on Pricing its label types `Not sure which plan fits?` once, and shows on phones for that moment; a contextual label + the orange mark,
bottom right, hides over the footer and under the menu, mark only on phones. Panel: a white `<dialog>` from the right,
500px wide, full screen on phones, 0.6s `--ease-out`, with a subtle blue, orange and purple fluid glow behind (`.yc-fluid`).
Colour has jobs: orange is Yalla (logo, send, brief meter; a soft tint for the primary action and your messages), blue is anything tappable, green
is WhatsApp. No gradients on controls.
When the day's AI runs out, the chat never ends: Yalla answers from written facts, and offers Solve my problem and WhatsApp for anything else. Keep it sparse, so it doesn't look AI-generated. Opening screen: logo with `Yalla`, `Hasan’s AI assistant` and a small `Runs on karak` tag beside it, a heading that follows the section and fades to a new question when a role is picked, an `I am` row of white pills (solid orange with white text when chosen), 1 soft orange action,
3 plain rows; the header stays empty until a chat starts. WhatsApp is always in the header (`.yalla-hwa`). Replies are plain
streaming text with no avatars, like Claude's chat. Inside the panel, chat elements have soft corners (bubble, composer, chips, brief card), the 1 exception to square UI; quick reply pills are a light orange tint with a thin orange outline and normal ink text, and sit under the latest message, wrapping rather than scrolling sideways, with a thin orange progress bar under the panel header during Solve my problem; the small thinking character and status are replaced by the reply. Cards reuse page content. `.yalla-brief` is the live brief bar. Yalla says "I" for itself and "Hasan" for Hasan, and never claims to be him. Its voice is Dubai English: a sharp friend, mostly English, at most 1 Arabic word a message (yalla, khalas, wallah, shukran, tamam…), and now and then a local reference (karak, Sheikh Zayed Road, Salik). Never mashallah, inshallah or bas. Have a native speaker check new lines.

**Footer contact** (`.wa-big`, `.mail`): WhatsApp leads as huge type with its green glyph and a green underline sweep on hover; the number sits under it. The email is a small line below. Clicking it copies it, a blue selection and `Copied` badge appear, and the note beside it confirms.

**Back button** (`.art-back`): a blue square with a left arrow + a white `Back` label, on articles and the privacy page.

**Menu** (`.menu`): full-screen glass, big links anchored to the bottom (thumb reach), locks
scroll, closes on link tap or Escape.

---

## 7. Imagery, reels and iconography

- **No stock photography, no illustrations.** The work is the imagery: product reels in device
  frames, logos of clients, the 3D stack.
- **Reels** are cut, not screen-recorded raw:
  - Calm pacing: ~1x speed, 9–20s, long dissolves (0.8–0.9s) or dips to black. No zooms.
  - Phone and app journeys are rebuilt from the Figma SVGs and animated layer by layer
    (`scripts/reel/journey.js`): pushes, sheets rising, real taps with a fingertip marker.
  - Show the best parts only. Cut text-heavy screens.
  - Bottom sheets change content in place (old clears, new cascades in); they don't slide sideways.
  - Configurators: angles cut instantly, paint dissolves, a part change shows on the object.
  - Teasers for unreleased work show a mark and a hint, never the whole flow.
  - Loops close cleanly: dip to the first frame, or a stepped-clock capture with a cross-faded
    seam (`scripts/reel/capture.py`).
- **Icons:** 16×16 viewBox, 1.5px stroke, no fill, square caps, drawn inline as SVG. The only
  glyphs: arrows (→ ← ↗), check, plus. No icon fonts, no emoji.
- **Logos:** monochrome on paper in the brands tile; partner logos at their own visual weight
  (heights tuned by eye, e.g. BrokerConnector 17px, GrowthMotive 22px).
- **Glows:** soft radial gradients in blue/rose/orange, never hard gradients, never on buttons.
  Grain overlay on dark surfaces.

---

## 8. Motion and behaviour

**Easings** (only these two):
- `--ease-out` `cubic-bezier(0.16, 1, 0.3, 1)`: things arriving, hovering, revealing.
- `--ease-io` `cubic-bezier(0.65, 0, 0.35, 1)`: things that go and come back (loops, wipes).

**Durations:** 0.3–0.4s for UI state (colour, hover), 0.5–0.8s for reveals and rolls, 1.2s for
large settles, 2.5s for diagram loops, 6–7s for ambient drifts.

**Behaviours**
- **Reveal on scroll:** blocks rise in slightly with a stagger (`--d` delay), once.
- **Hero:** the canvas fades up (1.2s, from 1.02 scale) as the layers glide in from just above
  their places (quartic ease, 1.7s each, 0.08s stagger; ~2.6s in all), labels appear after 1.3s.
  Until the 3D shows, the hero is plain dark: no glow first. The frame collapses into the
  page as you scroll; the stack assembles as it shrinks.
- **Play only what's visible:** every video and animated tile plays only while on screen
  (`[data-play]`, IntersectionObserver); showcase clips only while their layer is showing.
- **Hover is for mice.** All hover effects sit behind `(hover: hover) and (pointer: fine)`.
  Touch gets a 0.97 press scale and scroll-driven versions instead.
- **Anchor links glide** quickly to sections; they don't jump.
- **Tab title rotates** to a dry line when the visitor switches tabs.
- **Reduced motion:** no intro drop-in, no rolls, no ambient drift, rotation stops, the
  showcase snaps instead of wiping. Nothing essential depends on motion.

---

## 9. Accessibility

- Text contrast ≥4.5:1 for body copy on both grounds; known exceptions are 12px uppercase
  labels (`--ink-3` 3.7:1, paper muted 3.6–4.3:1). Don't use those greys for sentences.
- Every control is a real `<a>` or `<button>` with a name; icon-only ones have `aria-label`.
- Touch targets ≥44px on coarse pointers.
- Decorative layers (3D canvas, glows, mockups, diagrams) are `aria-hidden`.
- One `<h1>` per page. `lang="en"`. Every `<img>` has `alt` (empty when decorative).
- Visible keyboard focus; menu closes on Escape; external links `rel="noopener"`.
- `prefers-reduced-motion` is respected everywhere.

---

## 10. Frameworks, build and performance

**Stack:** hand-written HTML, one `styles.css`, classic scripts on `window.HC`
(`js/ui.js`, `js/textures.js`, `js/scene.js`, `js/annotations.js`, `js/main.js`). No framework,
no bundler, no npm. It works opened straight from disk (`file://`), where three.js comes from
jsDelivr; served, everything is self-hosted.

**3D:** three.js r160, self-hosted in `assets/vendor/three-0.160.0/`, modulepreloaded,
injected through an import map. Shaders and textures warm up before the canvas is shown.
Canvas textures wait up to 400ms for Inter Tight, then redraw when it lands.

**Everyone gets the 3D. It degrades, it doesn't switch off:**
1. `.perf-low` from the start on save-data, 2G, <4GB RAM or <4 cores: blur off, grain still,
   pixel ratio 1.
2. At runtime a governor watches frame times: adds `.perf-low`, then lowers pixel ratio
   (min 0.6), then halves the frame rate.
3. Only without WebGL (or a lost GPU context) does the hero fall back to the CSS glow.

**Budgets (keep them)**
| What | Budget | Now |
|---|---|---|
| First load, before any video | ≤1.5 MB | ~1.2 MB (three.js 670 KB raw) |
| Main-thread long tasks during scroll | 0 | 0 |
| Layout shift | 0 | 0 |
| JS heap | <20 MB | 4–5 MB |
| One reel | ≤3.5 MB HEVC | 0.6–3.3 MB |
| Poster | ≤60 KB WebP | 9–49 KB |

**Media rules**
- Videos: `muted loop playsinline preload="none"`, poster in WebP, HEVC source first
  (`codecs="hvc1"`) then H.264. Encoded with `scripts/reel/reel.swift` (AVFoundation,
  fast-start). Never MediaRecorder output.
- Images WebP; logos SVG or small PNG. Nothing larger than it's shown.
- 1 third-party request at runtime: Google Tag Manager, loaded after the page (`js/analytics.js`). No other
  trackers, embeds, CDNs or web fonts from elsewhere. Yalla calls this site's own `/api/yalla`; the model runs in the Worker.

**Caching and hosting** (`_headers`, Cloudflare Pages): vendor and fonts cached a year
(immutable, versioned paths); reels, posters, logos, devices a day with
`stale-while-revalidate` a week. Security headers on every page. `_redirects` sends the old
portfolio URLs to product.hasannawaz.com.

**Files**
| Path | What |
|---|---|
| `index.html`, `styles.css`, `js/` | The site |
| `thoughts/*.html` | Articles, generated by `scripts/build-articles.py` from the Medium feed |
| `assets/work/`, `assets/building/` | Reels and posters |
| `assets/devices/`, `assets/logos/`, `assets/fonts/`, `assets/vendor/` | Frames, logos, fonts, three.js |
| `scripts/reel/` | Reel pipeline: `journey.js` + per-project pages, `render.py`, `capture.py`, `phone-card.py`, `reel.swift` |
| `404.html`, `robots.txt`, `sitemap.xml`, `_headers`, `_redirects` | Hosting |

---

## 11. Before you ship a change

- [ ] Copy follows section 2: first person, numerals, no exclamation marks, nothing invented.
- [ ] Only tokens from section 3; blue used once per block.
- [ ] Type from the scale in section 4; uppercase labels at +0.08em.
- [ ] Square corners, no UI shadows.
- [ ] Hover effects behind the mouse-only query, with a touch version.
- [ ] Works at 320, 375, 390, 430, 768, 1024, 1440, 1920 with no sideways scroll.
- [ ] Media obeys the budgets; videos `preload="none"` with WebP posters.
- [ ] Reduced motion checked. No console errors.
- [ ] Price, plan, stat or contact change? Update the homepage FAQ, the JSON-LD in `index.html` and `llms.txt` too.
- [ ] Redeploy the clean folder (no `scripts/`) to Cloudflare Pages.
