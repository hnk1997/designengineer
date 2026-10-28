// Small UI behaviours: text roll, scramble reveal, menu, testimonials.
(() => {

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*+=/<>';

  /* Clips. All start as preload="none" so the first load stays light; warm() starts the
     download a little before a clip is needed, so it's ready when it comes into view.
     Reels that fade in from black carry data-from (the end of the fade, where the poster
     was taken): the first play starts there, so the poster hands over to the clip with no
     dip to black. The loop's own dip stays. */
  const warm = (v) => {
    if (!v || v.dataset.warm) return;
    v.dataset.warm = '1';
    if (v.dataset.from) {
      const from = parseFloat(v.dataset.from);
      const seek = () => { if (v.currentTime < from) v.currentTime = from; };
      if (v.readyState > 0) seek(); else v.addEventListener('loadedmetadata', seek, { once: true });
    }
    v.preload = 'auto';
    if (v.readyState === 0) v.load();
  };
  const playClip = (v) => { warm(v); return v.play().catch(() => {}); };

  /* Hover text roll: each [data-roll] gets two stacked copies, split per character */
  function initRolls(els = document.querySelectorAll('[data-roll]')) {
    els.forEach((el) => {
      const text = el.textContent;
      const chars = [...text]
        .map((ch, i) => `<span class="c" style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`)
        .join('');
      el.innerHTML = `<span class="roll"><span>${chars}</span><span aria-hidden="true">${chars}</span></span>`;
      el.closest('[data-roll-host]')?.setAttribute('aria-label', text);
    });
  }

  /* Characters land in random order, each flickering through glyphs first */
  function scramble(el, { duration = 1.1, settle = 0.3 } = {}) {
    const text = el.dataset.text ?? el.textContent.trim();
    el.dataset.text = text;
    if (reduced) {
      el.textContent = text;
      return Promise.resolve();
    }
    el._scrambleId = (el._scrambleId || 0) + 1;
    const id = el._scrambleId;

    el.textContent = '';
    const chars = [...text].map((ch) => {
      const s = document.createElement('span');
      s.className = 'sc';
      s.textContent = ch;
      el.appendChild(s);
      return { s, ch, at: ch.trim() ? Math.random() * duration : 0, done: false };
    });
    // Lock widths so swapping glyphs doesn't make the line jitter
    const widths = chars.map((c) => c.s.getBoundingClientRect().width);
    chars.forEach((c, i) => {
      c.s.style.width = `${widths[i]}px`;
      if (c.ch.trim()) c.s.style.opacity = '0';
    });

    return new Promise((resolve) => {
      const t0 = performance.now();
      const tick = (now) => {
        if (id !== el._scrambleId) return resolve();
        const t = (now - t0) / 1000;
        let pending = false;
        for (const c of chars) {
          if (c.done) continue;
          if (t < c.at) { pending = true; continue; }
          if (c.ch.trim() && t < c.at + settle) {
            pending = true;
            c.s.style.opacity = '0.5';
            c.s.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
          } else {
            c.done = true;
            c.s.style.opacity = '1';
            c.s.textContent = c.ch;
          }
        }
        if (pending) requestAnimationFrame(tick);
        else {
          el.textContent = text; // restore real text (and kerning)
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  function initMenu() {
    const btn = document.querySelector('[data-menu-btn]');
    const menu = document.querySelector('[data-menu]');
    const label = document.querySelector('[data-menu-label]');
    if (!btn || !menu) return;
    const set = (open) => {
      btn.setAttribute('aria-expanded', String(open));
      menu.hidden = !open;
      label.textContent = open ? 'Close' : 'Menu';
      document.documentElement.classList.toggle('menu-open', open); // locks page scroll
    };
    btn.addEventListener('click', () => set(menu.hidden));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) set(false); });
  }

  /* Testimonials: rotate when the progress bar finishes filling; pause on hover/focus.
     With reduced motion there's no auto-rotation, only the next button. */
  function initQuotes() {
    document.querySelectorAll('[data-quotes]').forEach(initQuoteRotator);
  }

  function initQuoteRotator(root) {
    const items = [...root.querySelectorAll('.quote')];
    const count = root.querySelector('[data-quotes-count]');
    const bar = root.querySelector('[data-quotes-bar]');
    const next = root.querySelector('[data-quotes-next]');
    const list = root.querySelector('.quotes-list');
    const pad = (n) => String(n).padStart(2, '0');
    let index = Math.max(0, items.findIndex((el) => el.classList.contains('is-active')));

    if (items.length < 2) {
      root.querySelector('.quotes-nav').hidden = true;
      root.querySelector('.quotes-progress').hidden = true;
      return;
    }

    const restartTimer = () => {
      bar.style.animation = 'none';
      void bar.offsetWidth; // reflow so the animation starts again from zero
      bar.style.animation = '';
    };

    const show = (i) => {
      items[index].classList.remove('is-active');
      index = (i + items.length) % items.length;
      items[index].classList.add('is-active');
      if (count) count.textContent = `${pad(index + 1)} / ${pad(items.length)}`;
      restartTimer();
    };

    if (count) count.textContent = `${pad(index + 1)} / ${pad(items.length)}`;
    bar.addEventListener('animationend', () => show(index + 1));
    next.addEventListener('click', () => {
      list.setAttribute('aria-live', 'polite'); // announce only changes the visitor asked for
      show(index + 1);
    });

    if (reduced) return;
    root.classList.add('is-playing');
    const pause = (on) => root.classList.toggle('is-paused', on);
    root.addEventListener('pointerenter', () => pause(true));
    root.addEventListener('pointerleave', () => pause(root.contains(document.activeElement)));
    root.addEventListener('focusin', () => pause(true));
    root.addEventListener('focusout', (e) => pause(root.contains(e.relatedTarget) || root.matches(':hover')));
  }

  /* Section reveal: each [data-reveal] section gets .is-in once, as it comes into
     view (styles.css does the motion). Any [data-count] numbers inside count up.
     Final values are already in the HTML for no-JS / reduced motion. */
  function initReveal() {
    const sections = [...document.querySelectorAll('[data-reveal]')];
    if (!sections.length || !('IntersectionObserver' in window)) return;
    document.documentElement.classList.add('reveal-ready');
    const expoOut = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

    const countUp = (el, delay) => {
      const target = Number(el.dataset.count);
      // Lock the box to the final number's width (in em, so it holds across breakpoints)
      // with the digits right-aligned, and keep it: the suffix never moves, not while
      // counting and not when the count ends. Measured once the web font is in, since
      // the fallback font sets a different width.
      const size = parseFloat(getComputedStyle(el).fontSize) || 1;
      el.style.width = `${el.getBoundingClientRect().width / size}em`;
      el.style.textAlign = 'right';
      el.textContent = '0';
      const start = performance.now() + delay;
      const tick = (now) => {
        const t = Math.min(1, Math.max(0, (now - start) / 1600));
        el.textContent = String(Math.round(target * expoOut(t)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const fontsReady = (document.fonts && document.fonts.ready) || Promise.resolve();

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const section = entry.target;
        io.unobserve(section);
        section.classList.add('is-in');
        if (reduced) return;
        const counts = [...section.querySelectorAll('[data-count]')];
        if (counts.length) fontsReady.then(() => counts.forEach((el) => {
          const host = el.closest('[style*="--d"]') || el;
          const d = parseFloat(getComputedStyle(host).getPropertyValue('--d')) || 0;
          countUp(el, d * 1000 + 150);
        }));
      });
    }, { threshold: 0.15 });
    sections.forEach((el) => io.observe(el));
  }

  /* Selected work showcase (desktop): the text blocks scroll at normal speed; the stage
     beside them stays in view. Scroll position drives everything directly: the upward wipe
     that reveals each next device, which project is active, and how far its screen has
     scrolled through its page. */
  function initShowcase() {
    const root = document.querySelector('[data-showcase]');
    if (!root) return;
    const list = root.querySelector('.showcase-steps');
    const steps = [...root.querySelectorAll('[data-step]')];
    const layers = [...root.querySelectorAll('[data-layer]')];
    const capIdx = root.querySelector('[data-caption-idx]');
    const capName = root.querySelector('[data-caption-name]');
    const names = steps.map((s) => s.querySelector('.showcase-name').textContent);
    const n = steps.length;
    const wide = matchMedia('(min-width: 900px)');
    const WIPE = 0.3; // the wipe runs across this many blocks, centred on each boundary
    const pad = (v) => String(v).padStart(2, '0');
    const smooth = (t) => t * t * (3 - 2 * t);
    let active = -1;

    const setActive = (a) => {
      if (a === active) return;
      active = a;
      steps.forEach((s, i) => s.classList.toggle('is-active', i === a));
      if (capIdx) capIdx.textContent = `${pad(a + 1)} / ${pad(n)}`;
      capName.textContent = names[a];
    };

    const aside = root.querySelector('.showcase-aside');
    const update = () => {
      const r = list.getBoundingClientRect();
      const block = r.height / n;
      // The reading line: the viewport's centre beside the stage, or on phones and tablets
      // (stage pinned to the top) the centre of the space left below it. In "blocks":
      // 0.5 = middle of the first block
      const stageH = wide.matches ? 0 : aside.offsetHeight;
      const line = stageH + (window.innerHeight - stageH) / 2;
      const pos = (line - r.top) / block;
      setActive(Math.min(n - 1, Math.max(0, Math.floor(pos))));

      layers.forEach((layer, i) => {
        if (i === 0) return;
        const t = Math.min(1, Math.max(0, (pos - (i - WIPE / 2)) / WIPE));
        const reveal = reduced ? (t >= 0.5 ? 1 : 0) : smooth(t);
        layer.style.setProperty('--reveal', reveal.toFixed(4));
        layer.classList.toggle('is-wiping', reveal > 0 && reveal < 1);
      });

      // Each screen scrolls top to bottom while its block passes the viewport centre
      pages.forEach((entry, i) => {
        if (!entry) return; // a clip, not a page
        const p = reduced ? 0 : Math.min(1, Math.max(0, pos - i));
        entry.page.style.transform = `translate3d(0, ${-p * entry.travel}px, 0)`;
      });

      // Clips (a recorded reel instead of a page) play only while their layer is the one
      // showing: the stage is on screen and the next layer hasn't wiped over it yet
      const onScreen = r.top < window.innerHeight && r.bottom > stageH;
      layers.forEach((layer, i) => {
        const clip = layer.querySelector('video');
        if (!clip) return;
        const next = layers[i + 1];
        const covered = next && parseFloat(next.style.getPropertyValue('--reveal') || 0) >= 0.999;
        const shown = i === 0 || parseFloat(layer.style.getPropertyValue('--reveal') || 0) > 0;
        const play = onScreen && shown && !covered && !reduced;
        if (play && clip.paused) playClip(clip);
        else if (!play && !clip.paused) clip.pause();
        // the next project's clip loads while this one plays, so it's ready before its wipe
        if (play) warm(layers[i + 1]?.querySelector('video'));
      });
    };

    // The first clip starts loading about a screen before the section arrives
    if ('IntersectionObserver' in window) {
      const near = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        near.disconnect();
        warm(layers[0]?.querySelector('video'));
      }, { rootMargin: '100% 0px 100% 0px' });
      near.observe(root);
    }

    // How far each page can scroll inside its screen; measured up front, not on every scroll
    let pages = [];
    const measure = () => {
      pages = layers.map((layer) => {
        const page = layer.querySelector('[data-page]');
        return page && { page, travel: Math.max(0, page.offsetHeight - page.parentElement.offsetHeight) };
      });
      update();
    };

    measure();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure); // real screen images change the page heights
  }

  /* Why me bento: each tile's animation plays only while it's on screen. CSS handles
     the route and badge; the activity log and brand names are driven here. */
  function initBento() {
    const tiles = [...document.querySelectorAll('[data-play]')]; // bento tiles and the ways cards
    if (!tiles.length) return;
    const loops = new Map(); // tile -> { start, stop }

    // 02: activity log, one entry at a time, always by the same person
    const logTile = document.querySelector('.tile--log');
    const logList = logTile?.querySelector('[data-log]');
    if (logList) {
      const entries = [
        ['Mapped the user flows', '09:12'],
        ['Designed the checkout', '11:40'],
        ['Built it, pixel for pixel', '14:05'],
        ['QA’d it on every breakpoint', '16:22'],
        ['Shipped v1.0', '17:58'],
        ['Replied to your email', '18:03'],
      ];
      const MAX = 4;
      let i = 0;
      let timer = 0;
      const add = () => {
        const [text, time] = entries[i % entries.length];
        i += 1;
        const li = document.createElement('li');
        li.className = 'log-item';
        li.innerHTML = `<span class="log-avatar">HN</span><span>${text}</span><span class="log-time">${time}</span>`;
        logList.appendChild(li);
        while (logList.children.length > MAX) logList.firstElementChild.remove();
      };
      for (let k = 0; k < MAX; k++) add(); // start full, so the tile is never empty
      loops.set(logTile, {
        start: () => { if (!reduced && !timer) timer = setInterval(add, 1900); },
        stop: () => { clearInterval(timer); timer = 0; },
      });
    }

    // 03: logo wall; one cell at a time rolls to the next logo waiting in line
    const brandTile = document.querySelector('.tile--brands');
    const wall = brandTile?.querySelector('[data-logos]');
    if (wall) {
      const cells = [...wall.querySelectorAll('.logo-cell')];
      const extra = wall.querySelector('[data-logos-extra]');
      const waiting = extra ? [...extra.content.querySelectorAll('img')] : [];
      const order = [0, 4, 2, 3, 1, 5]; // spread the swaps around the grid
      let step = 0;
      let timer = 0;
      const swap = () => {
        if (!waiting.length) return;
        const cell = cells[order[step % order.length] % cells.length];
        step += 1;
        const current = cell.querySelector('img:not(.logo-out)');
        const next = waiting.shift();
        next.classList.remove('logo-out');
        next.classList.add('logo-in');
        cell.appendChild(next);
        if (current) {
          current.classList.remove('logo-in');
          current.classList.add('logo-out');
          setTimeout(() => {
            current.remove();
            current.classList.remove('logo-out');
            waiting.push(current); // back of the queue
          }, 700);
        }
        cell.classList.remove('is-swapping');
        void cell.offsetWidth;
        cell.classList.add('is-swapping');
      };
      loops.set(brandTile, {
        start: () => { if (!reduced && !timer) timer = setInterval(swap, 1800); },
        stop: () => { clearInterval(timer); timer = 0; },
      });
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        target.classList.toggle('is-playing', isIntersecting);
        // clips (Currently building) load and play only while on screen
        target.querySelectorAll('video').forEach((v) => {
          if (isIntersecting && !reduced) playClip(v);
          else v.pause();
        });
        const loop = loops.get(target);
        if (loop) (isIntersecting ? loop.start : loop.stop)();
      });
    }, { threshold: 0.35 });
    tiles.forEach((t) => io.observe(t));
    // ...and start loading about a screen before they get there
    const near = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        near.unobserve(target);
        target.querySelectorAll('video').forEach(warm);
      });
    }, { rootMargin: '100% 0px 100% 0px' });
    tiles.forEach((t) => { if (t.querySelector('video') && t.offsetParent !== null) near.observe(t); });
  }

  /* How I work: the blue rule across the steps fills in step with scroll position (1:1,
     no easing), and each step lights up as the rule reaches it. Only listens while the
     steps are on screen. Across on desktop, down the left on smaller screens. */
  function initProcess() {
    const root = document.querySelector('[data-steps]');
    if (!root) return;
    const steps = [...root.querySelectorAll('[data-proc-step]')];
    const line = root.querySelector('.steps-line');
    root.classList.add('is-live');
    if (reduced || !('IntersectionObserver' in window)) {
      root.style.setProperty('--p', '1');
      steps.forEach((s) => s.classList.add('is-on'));
      return;
    }

    let at = [];   // where each step sits along the rule, 0..1
    let raf = 0;
    const measure = () => {
      const vertical = line.offsetHeight > line.offsetWidth;
      const len = vertical ? line.offsetHeight : line.offsetWidth;
      at = steps.map((s) => (vertical ? s.offsetTop - line.offsetTop : s.offsetLeft) / Math.max(1, len));
    };
    const update = () => {
      raf = 0;
      const r = root.getBoundingClientRect();
      const vh = window.innerHeight;
      // Starts as the steps come up past 85% of the screen; done over the steps'
      // own height, or half the screen when they're laid out across
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / Math.max(r.height, vh * 0.5)));
      root.style.setProperty('--p', p.toFixed(4));
      steps.forEach((s, i) => s.classList.toggle('is-on', p > 0 && p >= at[i] - 0.001));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };

    measure();
    update();
    window.addEventListener('resize', () => { measure(); onScroll(); });
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      } else {
        window.removeEventListener('scroll', onScroll);
        update(); // settle at 0 or 1 on the way out
      }
    }).observe(root);
  }

  /* Sticky Get in touch: shows once the nav has scrolled out of view, in the nav's own
     spot. It turns dark on light backgrounds and stays light on dark ones ([data-dark]
     sections, and the hero frame, which main.js reports through setHeroDark). */
  function initCtaFloat() {
    const cta = document.querySelector('[data-cta-float]');
    const nav = document.querySelector('[data-nav]');
    if (!cta || !nav || !('IntersectionObserver' in window)) return { setHeroDark() {} };
    let shown = false;
    let heroDark = false;
    const under = new Set();
    const update = () => {
      cta.classList.toggle('is-shown', shown);
      cta.classList.toggle('on-dark', heroDark || under.size > 0);
      cta.setAttribute('aria-hidden', String(!shown));
      cta.tabIndex = shown ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { shown = !e.isIntersecting; update(); }).observe(nav);
    // only the top strip of the screen counts, where the button sits
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? under.add(e.target) : under.delete(e.target)));
      update();
    }, { rootMargin: '0px 0px -93% 0px' });
    document.querySelectorAll('[data-dark]').forEach((el) => io.observe(el));
    update();
    return { setHeroDark(v) { if (v !== heroDark) { heroDark = v; update(); } } };
  }

  /* Clicking the email copies it. The clipboard API where it's allowed; otherwise a hidden
     field and the old copy command. The hint under it confirms, for screen readers too. */
  function initCopy() {
    document.querySelectorAll('[data-copy]').forEach((btn) => {
      const text = btn.dataset.copy;
      const hint = btn.parentElement.querySelector('[data-copy-status]');
      const msg = hint?.querySelector('[data-copy-msg]');
      if (msg && matchMedia('(hover: none), (pointer: coarse)').matches) msg.textContent = msg.textContent.replace(/^Click/, 'Tap');
      const idle = msg ? msg.textContent : '';
      let timer = 0;
      const fallback = () => {
        const field = Object.assign(document.createElement('textarea'), { value: text });
        field.setAttribute('readonly', '');
        field.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(field);
        field.select();
        const ok = document.execCommand('copy');
        field.remove();
        return ok ? Promise.resolve() : Promise.reject();
      };
      const show = (text, done) => {
        if (msg) msg.textContent = text;
        btn.classList.toggle('is-done', done);
        hint?.classList.toggle('is-done', done);
      };
      btn.addEventListener('click', () => {
        const copy = navigator.clipboard?.writeText ? navigator.clipboard.writeText(text).catch(fallback) : fallback();
        copy.then(() => show('Copied to clipboard', true)).catch(() => show('Select it and press ⌘C', false));
        clearTimeout(timer);
        timer = setTimeout(() => show(idle, false), 2400);
      });
    });
  }

  /* In-page links glide to their section instead of jumping: quick (well under a second,
     however far), and the reader can take over at any moment by scrolling or touching.
     Reduced motion keeps the instant jump. */
  function initAnchors() {
    if (reduced) return;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let raf = 0;
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    ['wheel', 'touchstart', 'keydown'].forEach((type) => window.addEventListener(type, stop, { passive: true }));

    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const id = link.getAttribute('href').slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      stop();
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const from = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const to = Math.min(max, Math.max(0, target.getBoundingClientRect().top + from - margin));
      const duration = Math.min(800, 420 + Math.abs(to - from) * 0.04);
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        window.scrollTo(0, from + (to - from) * ease(t));
        if (t < 1) raf = requestAnimationFrame(step);
        else {
          raf = 0;
          history.pushState(null, '', `#${id}`);
          target.focus({ preventScroll: true }); // keyboard and screen readers continue from here
        }
      };
      raf = requestAnimationFrame(step);
    });
  }

  /* The browser tab title takes turns with a few lines in the same voice as the page,
     and says something else when you leave the tab. The real title (in the HTML) is
     what search engines and bookmarks get. */
  function initTitle() {
    const base = document.title;
    const lines = [
      base,
      'Designed it. Built it. | Hasan Nawaz',
      'No handoffs were harmed | Hasan Nawaz',
      'Figma, meet production | Hasan Nawaz',
      'Pixel-perfect, on purpose | Hasan Nawaz',
      'QA’d on every breakpoint | Hasan Nawaz',
    ];
    const away = [
      'Your idea is still here',
      'Still shipping in the background',
      'The prototype misses you',
    ];
    let i = 0;
    let timer = 0;
    const rotate = () => {
      i = (i + 1) % lines.length;
      document.title = lines[i];
    };
    const start = () => { clearInterval(timer); timer = setInterval(rotate, 4000); };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearInterval(timer);
        document.title = away[(Math.random() * away.length) | 0];
      } else {
        i = 0;
        document.title = base;
        start();
      }
    });
    start();
  }

  /* What I do: one row plays its diagram at a time. On desktop it's the row under the pointer;
     on phones and touch screens, the row crossing the middle of the screen. */
  function initServices() {
    const rows = [...document.querySelectorAll('.svc-row')];
    if (!rows.length) return;
    let current = null, queued = false;
    const select = (next) => { if (next === current) return; current?.classList.remove('is-on'); next?.classList.add('is-on'); current = next; };
    // Desktop with a mouse: the row under the pointer plays, as a hover
    if (matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)').matches) {
      rows.forEach((r) => {
        r.addEventListener('mouseenter', () => select(r));
        r.addEventListener('mouseleave', () => { if (current === r) select(null); });
      });
      return;
    }
    // Phones and touch screens: the row crossing the middle of the screen plays, as you scroll
    const pick = () => {
      queued = false;
      const mid = window.innerHeight / 2;
      const next = rows.find((r) => { const b = r.getBoundingClientRect(); return b.top <= mid && b.bottom > mid; }) || null;
      select(next);
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(pick); } };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    pick();
  }

  /* The sticky WhatsApp button steps aside over the footer, which has its own WhatsApp line */
  function initWhatsApp() {
    const btn = document.querySelector('.wa-float');
    const foot = document.querySelector('#contact');
    if (!btn || !foot || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(([e]) => btn.classList.toggle('is-away', e.isIntersecting), { threshold: 0.15 }).observe(foot);
  }

  Object.assign((window.HC = window.HC || {}), { initRolls, scramble, initMenu, initQuotes, initReveal, initShowcase, initBento, initProcess, initCopy, initAnchors, initTitle, initCtaFloat, initServices, initWhatsApp });
})();
