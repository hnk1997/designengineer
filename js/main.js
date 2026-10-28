// Entry point. Plain script (not a module) so the page also works opened
// straight from disk. Everything here works without the 3D scene; the scene is
// loaded later by index.html, and only on devices marked `full` (see <head>).
(() => {
  const { createStage, Annotations, initRolls, initMenu, initQuotes, initReveal, initShowcase, initBento, initProcess, initCopy, initAnchors, initTitle, initCtaFloat, initServices, initWhatsApp } = window.HC;

  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hero = document.querySelector('.hero');
  const frame = document.querySelector('[data-frame]');
  const canvas = document.querySelector('[data-canvas]');
  const labelsHost = document.querySelector('[data-ann-labels]');
  const annSvg = document.querySelector('[data-ann-svg]');
  const nav = document.querySelector('[data-nav]');
  // Wrappers, not the animated children, so scroll fading never fights the CSS intro
  const copy = [...document.querySelectorAll('.hero-content, .hero-foot')];
  // Phones stack the headline block on the intro: keep its offset matched to the intro's real height
  const heroFoot = document.querySelector('.hero-foot');
  const heroContent = document.querySelector('.hero-content');
  if (heroFoot && 'ResizeObserver' in window) {
    const ro = new ResizeObserver(() => { hero.style.setProperty('--hero-foot-h', `${heroFoot.offsetHeight}px`); requestAnimationFrame(measure); });
    ro.observe(heroFoot); ro.observe(heroContent);
  }

  initRolls();
  initMenu();
  initQuotes();
  initReveal();
  initShowcase();
  initBento();
  initServices();
  initWhatsApp();
  initProcess();
  initCopy();
  initAnchors();
  initTitle();
  const ctaFloat = initCtaFloat();

  /* ── Scroll: the hero shrinks into a framed figure on the light grid ──
     The page always scrolls at native speed: no pinning, no easing. While the
     frame shrinks, its stage is only held back part of the way (--drift in
     styles.css), so it drifts up slower than the page and lands as a centred
     figure; after that it scrolls away with everything else. */
  const size = { w: 1, h: 1 };
  const NAV_H = 76;
  const stageEl = document.querySelector('[data-stage]');
  const caption = document.querySelector('[data-caption]');
  const layout = { range: 1, drift: 0.7, top: 0, bottom: 0, sides: 0 };
  let progress = 0;

  function measure() {
    size.w = frame.clientWidth;
    size.h = frame.clientHeight;
    const css = getComputedStyle(hero);
    const collapse = parseFloat(css.getPropertyValue('--collapse')) || 0.65;
    layout.drift = parseFloat(css.getPropertyValue('--drift')) || 0.7;
    layout.range = Math.max(1, collapse * size.h);
    // Where the figure should sit on screen once collapsed, converted to frame insets
    const shift = (1 - layout.drift) * layout.range; // how far the stage has risen by then
    const mobile = size.w < 768;
    const figTop = size.h * (mobile ? 0.13 : 0.11) + shift;
    const figBottom = Math.min(size.h, size.h * (mobile ? 0.82 : 0.8) + shift);
    layout.top = figTop;
    layout.bottom = size.h - figBottom;
    layout.sides = mobile ? 14 : size.w * 0.29;
    stageEl.style.setProperty('--fig-mid', `${(figTop + figBottom) / 2}px`);
    stage?.setFocus((figTop + figBottom) / 2);
    // phones: the stack gets the space between the nav and the headline block
    if (mobile && heroContent) stage?.setBand(NAV_H + 4, heroContent.getBoundingClientRect().top - frame.getBoundingClientRect().top - 20);
    stageEl.style.setProperty('--fig-bottom', `${figBottom}px`);
  }

  function applyScroll() {
    const y = Math.max(0, window.scrollY);
    const c = Math.min(y, layout.range);
    const k = c / layout.range;
    progress = k;
    const held = layout.drift * c;
    stageEl.style.transform = held ? `translate3d(0, ${held}px, 0)` : '';
    const { top, bottom, sides } = layout;
    frame.style.clipPath = k > 0
      ? `inset(${top * k}px ${sides * k}px ${bottom * k}px ${sides * k}px round ${4 * k}px)`
      : '';
    stage?.setAssemble(k);
    const fade = String(Math.max(0, 1 - k * 2));
    labelsHost.style.opacity = fade;
    annSvg.style.setProperty('--lead', fade);
    copy.forEach((el) => { el.style.opacity = fade; });
    caption.style.opacity = String(Math.max(0, (k - 0.6) / 0.4));
    // The nav scrolls with the page: its logo turns dark once the shrinking frame no
    // longer sits behind it (both measured from the top of the page)
    nav.classList.toggle('on-light', held + top * k > NAV_H / 2);
    // Is the dark frame behind the sticky button (top right, in view)?
    const frameTop = held + top * k - y;
    const frameBottom = held + size.h - bottom * k - y;
    ctaFloat.setHeroDark(frameTop < NAV_H / 2 && frameBottom > NAV_H / 2 && sides * k < 160);
  }

  /* ── Frame loop: runs only while there's something to draw ── */
  let stage = null;
  let notes = null;
  let live = false;
  let heroVisible = true;
  let rafId = 0;
  let last = 0;
  let clock = 0;
  let introUntil = 0;

  function kick() {
    if (rafId) return;
    last = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function tick(now) {
    rafId = 0;
    const elapsed = (now - last) / 1000;
    last = now;
    if (!live || !heroVisible) return;
    // Resolution changes are applied before drawing, never after, so no frame is shown blank
    if (perf.pending) {
      stage.setPixelRatio(perf.pending);
      perf.pending = 0;
    }
    // The scene clock follows real time (so slow devices aren't slowed down),
    // capped only to skip gaps like a backgrounded tab; easing uses a smaller cap.
    // During the drop-in a slow frame stretches the animation a touch instead of making it
    // jump; afterwards only long gaps (a backgrounded tab) are capped
    clock += Math.min(elapsed, clock < introUntil ? 1 / 30 : 0.25);
    govern(elapsed);
    // Last resort on very weak devices: draw every other frame. The clock keeps real
    // time, so motion stays at the right speed, just with fewer frames.
    perf.carry += elapsed;
    if (perf.halve && (perf.odd = !perf.odd)) { rafId = requestAnimationFrame(tick); return; }
    stage.update(clock, Math.min(perf.carry, 0.05));
    notes.update(clock);
    perf.carry = 0;
    rafId = requestAnimationFrame(tick);
  }

  function onResize() {
    measure();
    stage?.resize(size.w, size.h);
    notes?.resize(size.w, size.h);
    applyScroll();
    // Resizing clears the canvas, so redraw straight away rather than on the next frame
    if (live && heroVisible) {
      stage.update(clock, 0);
      notes.update(clock);
    }
    kick();
  }

  measure();
  applyScroll();
  window.addEventListener('scroll', applyScroll, { passive: true });
  window.addEventListener('resize', onResize);
  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    if (heroVisible) kick();
  }).observe(hero);

  /* ── Performance guard ───────────────────────────────────────
     Only for devices that genuinely can't keep up: under 24fps for three seconds in a
     row. (Browsers that cap animation at 30fps to save power, or preview panes, stay
     above that and are left alone.) It never turns the 3D off; each step makes it
     cheaper: first the page's blurs and grain go, then render resolution steps down to
     0.6, then it draws every other frame. */
  const perf = { wait: 3, sum: 0, n: 0, slow: 0, pending: 0, halve: false, odd: false, carry: 0 };
  function govern(dt) {
    if (document.hidden) return;
    if ((perf.wait -= dt) > 0) return; // ignore start-up hitches (shader compiles, texture uploads)
    perf.sum += dt;
    perf.n += 1;
    if (perf.sum < 1) return;
    const avg = perf.sum / perf.n;
    perf.sum = perf.n = 0;
    if (avg <= 1 / 24) { perf.slow = 0; return; }
    if (++perf.slow < 3) return;
    perf.slow = 0;
    perf.wait = 1;
    if (!root.classList.contains('perf-low')) { root.classList.add('perf-low'); return; }
    const pr = stage.pixelRatio;
    if (pr > 0.6) perf.pending = Math.max(0.6, pr - 0.25);
    else perf.halve = true;
  }

  // Only when the 3D can't run at all (lost GPU context): the glow carries the hero
  function stop3D() {
    live = false;
    root.classList.add('three-off');
    root.classList.remove('is-live');
    stage?.dispose();
  }

  /* ── 3D: called by index.html once Three.js has loaded ─────── */
  window.HC.start3D = async () => {
    if (!root.classList.contains('full') || stage) return;

    // The layer screens draw text. Inter Tight is preloaded, so it's normally in by now;
    // give it a moment if not, rather than redrawing the screens mid-animation.
    const fonts = document.fonts;
    const hasFont = () => !fonts || [...fonts].some((f) => /Inter Tight/.test(f.family) && f.status === 'loaded');
    if (!hasFont()) {
      await Promise.race([fonts.load('600 64px "Inter Tight"'), new Promise((r) => setTimeout(r, 400))]).catch(() => {});
    }

    try {
      const lowPower = root.classList.contains('perf-low');
      stage = createStage(canvas, { reduced, lowPower, maxPixelRatio: lowPower ? 1 : 1.5 });
      notes = new Annotations({ svg: annSvg, host: labelsHost, stage, reduced });
    } catch (err) {
      console.warn('3D unavailable, keeping the glow.', err);
      stage = null;
      return;
    }
    stage.onContextLost(stop3D);
    // Still no font after that: redraw the screens in it the moment it arrives
    if (!hasFont()) {
      const onFont = () => {
        if (!hasFont()) return;
        fonts.removeEventListener('loadingdone', onFont);
        stage?.refreshTextures();
      };
      fonts.addEventListener('loadingdone', onFont);
    }
    window.addEventListener('pointermove', (e) => {
      stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });

    measure();
    stage.resize(size.w, size.h);
    notes.resize(size.w, size.h);
    applyScroll();

    // Shader compiles and texture uploads happen here, while the canvas is still hidden,
    // so the first frames anyone sees are cheap ones and the drop-in runs smoothly
    try { await stage.warm(); } catch (err) { /* compiling on first draw instead is fine */ }
    stage.update(clock, 0);

    if (progress > 0.05) {
      stage.settle(); // arrived mid-scroll: no drop-in
    } else {
      stage.intro(clock + 0.1);
      introUntil = clock + 3.2;
    }

    live = true;
    kick();
    // Reveal once a frame has been drawn, so there's never a flash of empty canvas.
    // The labels wait until the layers have mostly landed, so they don't compete.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.add('is-live');
      setTimeout(() => notes.reveal(), reduced ? 0 : 1700);
    }));
  };
})();
