/* Yalla, the AI assistant. A sticky button opens a <dialog> from the right.
   - Yalla is a character: it blinks, looks at your pointer, listens as you type, ponders while it
     thinks, nods along as words stream in, waves hello and jumps when a brief is ready.
   - Answers can carry cards built from the real page (plans, work, process), so prices never come
     from the model. The 4 starters are written answers and never touch the model.
   - Scoping: tap quick answers or just chat. A brief builds up and ends in a structured WhatsApp message.
   The model closes a reply with [[tags]] (see yalla-prompt.txt); they're parsed here, never shown.
   /api/yalla (worker.js) enforces the limits; the count here just saves a pointless call. */
(() => {
  const WA = 'https://wa.me/971547945306?text=';
  const DAILY = 50;
  const LIMIT = 'I’m done for today, but Hasan can answer this directly.';
  const FIELDS = [['what', 'Project'], ['who', 'For'], ['when', 'Timing'], ['budget', 'Budget']];
  const TOPICS = {
    pricing: {
      re: /\b(pric\w*|costs?|how much|rates?|aed|plans?)\b/i,
      status: 'Checking the rate card',
    },
    work: {
      re: /portfolio|case stud|examples?|show me|\b(your|his|hasan.?s|recent|past) (work|projects?|clients?)\b/i,
      status: 'Looking through the work',
    },
    process: {
      re: /\b(process|how (do|does|would) .*work|steps?|get started)\b/i,
      status: 'Reading how Hasan works',
    },
  };
  // scoping is guided and written, so it's instant, costs nothing and works even if the model is down
  const SCOPE = [
    { key: 'what', chips: ['A website', 'A landing page', 'A web app', 'A mobile app'] },
    { key: 'who', say: (a) => `${a}, nice. Who’s it for?`, chips: ['My startup', 'My company', 'An agency client'] },
    { key: 'when', say: () => 'Makes sense. When are you hoping to have it live?', chips: ['Within a month', 'In 2–3 months', 'No fixed date'] },
    { key: 'budget', say: () => 'Good to know. Do you have a rough budget in mind?', chips: ['Under AED 15,000', 'AED 15,000–30,000', 'AED 30,000+', 'Not sure yet'] },
  ];
  const STARTERS = {
    scope: { ask: 'Scope my project', say: 'Happy to. What are you building?' },
    pricing: { ask: 'What does it cost?', say: 'Here’s where things start. The final price depends on what you need, so Hasan confirms it once the scope is clear. What are you looking to build?', card: 'pricing' },
    work: { ask: 'Show me the work', say: 'These are a few recent ones. Tap any of them to see it on the page. Is there a type of project you’re thinking about?', card: 'work' },
    process: { ask: 'How does it work?', say: 'It’s pretty simple, and you talk to Hasan the whole way through. What are you working on?', card: 'process' },
  };
  const LAUNCH = { work: 'Ask about the work', pricing: 'Which plan fits?', process: 'How does this work?', faq: 'Still curious?' };
  const HELLO = { work: 'Curious about the work?', pricing: 'Not sure which plan fits?', process: 'Want to know how it runs?' };

  function initYalla() {
    const panel = document.querySelector('[data-yalla]');
    const opener = document.querySelector('[data-yalla-open]');
    if (!panel || !opener) return;
    const $ = (s) => panel.querySelector(s);
    const scroller = $('[data-yalla-scroll]');
    const hello = $('[data-yalla-hello]');
    const log = $('[data-yalla-log]');
    const nextRow = $('[data-yalla-next]');
    const form = $('[data-yalla-form]');
    const input = form.querySelector('textarea');
    const send = form.querySelector('button');
    const fresh = $('[data-yalla-new]');
    const tracker = $('[data-yalla-brief]');
    const toggle = $('[data-yalla-brief-toggle]');
    const fieldsBox = $('[data-yalla-brief-body]');
    const headerWa = $('[data-yalla-wa]');
    const arrow = send.innerHTML;
    const today = new Date().toISOString().slice(0, 10);
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    // what happened, never what was typed (see js/analytics.js)
    const track = (event, data) => (window.dataLayer = window.dataLayer || []).push({ event, ...data });
    const el = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };

    let history = [];
    let chatId = '';
    let brief = {};
    let shown = {};
    let strikes = 0;
    let done = false;
    let busy = null;
    let ready = false;
    let section = '';
    let step = -1; // where we are in SCOPE, -1 when not scoping
    const goLinks = new Set();

    /* ── the character ──
       One-off moves are played with the Web Animations API, using the old rules: anticipate, squash and
       stretch, overshoot, settle, and let the arms follow a beat behind. CSS holds the moods. */
    const hosts = [panel, opener];
    const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
    const parts = (sel) => hosts.flatMap((h) => [...h.querySelectorAll(sel)]);
    const play = (sel, frames, opts) => {
      if (!calm) parts(sel).forEach((n) => n.animate(frames, { easing: 'cubic-bezier(0.4, 0, 0.2, 1)', ...opts }));
    };
    const T = (transform, offset, easing) => ({ transform, ...(offset != null && { offset }), ...(easing && { easing }) });
    const moves = {
      blink() {
        play('.yc-eye', [T('scaleY(1)'), T('scaleY(0.08)', 0.42), T('scaleY(0.08)', 0.55), T('scaleY(1)')], { duration: 170 });
      },
      doubleBlink() {
        moves.blink();
        setTimeout(moves.blink, 240);
      },
      wave() {
        play('.yc-root', [T('none'), T('rotate(-3deg)', 0.12), T('rotate(4deg)', 0.34), T('rotate(3deg)', 0.74), T('none')], { duration: 1350 });
        play('.yc-arm--r', [T('none'), T('rotate(10deg)', 0.1), T('rotate(-24deg)', 0.28, SPRING), T('rotate(-7deg)', 0.44), T('rotate(-22deg)', 0.6), T('rotate(-8deg)', 0.76), T('none')], { duration: 1350 });
        play('.yc-arm--l', [T('none'), T('rotate(-5deg)', 0.34), T('none')], { duration: 1300, delay: 70 });
      },
      jump() {
        play('.yc-root', [
          T('none'), T('scale(1.09, 0.84)', 0.2), T('translateY(-8px) scale(0.93, 1.1)', 0.45), T('translateY(-9px) scale(1, 1)', 0.55),
          T('scale(1.1, 0.85)', 0.76), T('scale(0.97, 1.04)', 0.88), T('none'),
        ], { duration: 820 });
        play('.yc-arm--l', [T('none'), T('rotate(-10deg)', 0.2), T('rotate(16deg)', 0.5), T('rotate(-6deg)', 0.8), T('none')], { duration: 820, delay: 40 });
        play('.yc-arm--r', [T('none'), T('rotate(10deg)', 0.2), T('rotate(-16deg)', 0.5), T('rotate(6deg)', 0.8), T('none')], { duration: 820, delay: 40 });
      },
      hop() {
        play('.yc-root', [T('none'), T('scale(1.05, 0.92)', 0.22), T('translateY(-3.5px) scale(0.97, 1.05)', 0.5), T('scale(1.04, 0.95)', 0.8), T('none')], { duration: 460 });
      },
      nod() {
        play('.yc-root', [T('none'), T('translateY(1.1px) scale(1.02, 0.97)', 0.4), T('none')], { duration: 260 });
      },
      aha() {
        play('.yc-root', [T('none'), T('translateY(-2px) scale(0.98, 1.04)', 0.4), T('none')], { duration: 320, easing: SPRING });
        play('.yc-eye', [T('scale(1)'), T('scale(1.16)', 0.4), T('scale(1)')], { duration: 320 });
      },
      tilt() {
        const way = Math.random() < 0.5 ? -1 : 1;
        look(way * 1.2, -0.5);
        play('.yc-root', [T('none'), T(`rotate(${way * 7}deg)`, 0.2, SPRING), T(`rotate(${way * 6}deg)`, 0.8), T('none')], { duration: 1500 });
        setTimeout(() => look(0, 0), 1300);
      },
      stretch() {
        play('.yc-root', [T('none'), T('scale(1.04, 0.95)', 0.14), T('scale(0.96, 1.07)', 0.42), T('scale(0.96, 1.07)', 0.66), T('none')], { duration: 1300 });
        play('.yc-arm--l', [T('none'), T('rotate(-13deg)', 0.42), T('rotate(-13deg)', 0.66), T('none')], { duration: 1300 });
        play('.yc-arm--r', [T('none'), T('rotate(13deg)', 0.42), T('rotate(13deg)', 0.66), T('none')], { duration: 1300 });
      },
      pop() {
        play('.yc-root', [{ transform: 'translateY(12px) scale(0.5)', opacity: 0 }, { transform: 'translateY(-2px) scale(1.07, 0.95)', opacity: 1, offset: 0.6 }, { transform: 'scale(0.98, 1.03)', offset: 0.82 }, { transform: 'none' }], { duration: 560, delay: 160, fill: 'backwards' });
      },
      glance() {
        look((Math.random() < 0.5 ? -1 : 1) * 1.3, (Math.random() - 0.5) * 1.6);
        setTimeout(() => { if (mood === 'idle') look(0, 0); }, 800 + Math.random() * 500);
      },
    };
    let energy = 0;
    let raf = 0;
    let mood = 'idle';
    let moodTimer = 0;
    const decay = () => {
      energy *= 0.88;
      hosts.forEach((h) => h.style.setProperty('--e', energy.toFixed(3)));
      raf = energy > 0.01 ? requestAnimationFrame(decay) : 0;
    };
    const pulse = (n) => {
      if (calm) return;
      energy = Math.min(1, energy + n);
      if (!raf) raf = requestAnimationFrame(decay);
    };
    function look(x, y) {
      hosts.forEach((h) => {
        h.style.setProperty('--lx', `${x.toFixed(2)}px`);
        h.style.setProperty('--ly', `${y.toFixed(2)}px`);
      });
    }
    const setState = (s) => {
      mood = s;
      clearTimeout(moodTimer);
      hosts.forEach((h) => { h.dataset.mood = s; });
      if (s === 'idle' || s === 'thinking') look(0, 0);
    };
    const flash = (s, ms) => { // a passing feeling, then back to idle
      setState(s);
      moodTimer = setTimeout(() => setState('idle'), ms);
    };
    let lastMove = 0;
    let visits = 0;
    if (!calm) {
      const blinks = () => {
        setTimeout(() => {
          if (!document.hidden && mood !== 'happy') (Math.random() < 0.2 ? moves.doubleBlink : moves.blink)();
          blinks();
        }, 2200 + Math.random() * 3800);
      };
      blinks();
      // left alone, it entertains itself
      const idle = () => {
        setTimeout(() => {
          if (!document.hidden && mood === 'idle' && performance.now() - lastMove > 2500) {
            const r = Math.random();
            if (r < 0.5) moves.glance();
            else if (r < 0.72) moves.tilt();
            else if (r < 0.88) moves.stretch();
            else moves.hop();
          }
          idle();
        }, 3800 + Math.random() * 4800);
      };
      idle();
      // says hi from the corner a few times, until it's been opened
      const greet = (n) => {
        setTimeout(() => {
          if (!visits && !document.hidden && !opener.classList.contains('is-away')) moves.wave();
          if (n > 1) greet(n - 1);
        }, n === 3 ? 7000 : 30000);
      };
      greet(3);
      opener.addEventListener('pointerenter', () => { if (fine) moves.wave(); });
      if (fine) {
        let queued = false;
        window.addEventListener('pointermove', (e) => {
          lastMove = performance.now();
          if (queued || mood !== 'idle') return;
          queued = true;
          requestAnimationFrame(() => {
            queued = false;
            const face = panel.open ? panel.querySelector('.yc-tile--bar') : opener.querySelector('.yc-tile');
            const r = face.getBoundingClientRect();
            const dx = e.clientX - (r.left + r.width / 2);
            const dy = e.clientY - (r.top + r.height / 2);
            const d = Math.hypot(dx, dy) || 1;
            const reach = Math.min(1, d / 140);
            look((dx / d) * 1.3 * reach, (dy / d) * 1.1 * reach);
          });
        }, { passive: true });
      }
    }

    window.HC.yallaMoves = moves; // handy for checking poses

    const setLabel = () => {
      opener.querySelector('.yalla-float-label').textContent = Object.values(brief).some(Boolean) ? 'Back to your brief' : (LAUNCH[section] || 'Ask Yalla');
    };

    /* ── holding the page still while Yalla is open ── */
    let lockedAt = null;
    // no overflow: hidden or position: fixed here: either one breaks the sticky Selected work stage
    const holdPage = (e) => {
      if (!e.target.closest('.yalla-scroll, .yalla-work, .yalla-nexts, .yalla-input')) e.preventDefault();
    };
    function lock() {
      if (lockedAt !== null) return;
      lockedAt = window.scrollY;
      document.addEventListener('touchmove', holdPage, { passive: false });
      document.addEventListener('wheel', holdPage, { passive: false });
    }
    function unlock() {
      if (lockedAt === null) return;
      document.removeEventListener('touchmove', holdPage);
      document.removeEventListener('wheel', holdPage);
      if (Math.abs(window.scrollY - lockedAt) > 1) window.scrollTo({ top: lockedAt, behavior: 'instant' });
      lockedAt = null;
    }
    /* The sheet never moves or resizes for the keyboard: that's what looked jerky, and left gaps. Only the
       message box lifts. It lifts the moment you tap, before Safari decides anything, so the box is
       already clear of the keyboard and Safari has no reason to shove the whole page up. */
    const vv = window.visualViewport;
    let kb = 0;
    const guess = () => {
      try {
        const saved = Number(localStorage.getItem('hn-yalla-kb'));
        if (saved > 100) return saved;
      } catch {}
      return Math.round(window.innerHeight * 0.41);
    };
    const setKb = (n) => {
      if (Math.abs(n - kb) < 2) return;
      kb = n;
      panel.style.setProperty('--kb', `${n}px`);
      const until = performance.now() + 380;
      const follow = () => {
        if (anchorMsg || !hello.hidden) toEnd();
        if (performance.now() < until) requestAnimationFrame(follow);
      };
      follow();
    };
    function sync() {
      if (!vv || fine || !panel.open) return;
      const covered = Math.round(window.innerHeight - vv.height);
      if (document.activeElement === input && covered > 100) {
        setKb(covered);
        try { localStorage.setItem('hn-yalla-kb', String(covered)); } catch {}
      } else if (covered < 60 && document.activeElement !== input) {
        setKb(0);
      }
      if (lockedAt !== null && Math.abs(window.scrollY - lockedAt) > 1) window.scrollTo({ top: lockedAt, behavior: 'instant' });
    }
    if (vv) {
      vv.addEventListener('resize', sync);
      vv.addEventListener('scroll', sync);
    }

    /* ── open, close, moving to the page ── */
    const open = () => {
      document.documentElement.classList.add('yalla-open');
      lock();
      if (!history.length) $('[data-yalla-title]').textContent = HELLO[section] || 'What are you working on?';
      panel.classList.remove('is-settled'); // never carried over from the last time
      visits += 1;
      track('yalla_open', { yalla_section: section || 'top' });
      panel.showModal();
      panel.focus({ preventScroll: true }); // otherwise the first button gets focused and outlined
      setTimeout(() => { if (panel.open) panel.classList.add('is-settled'); }, 620);
      sync();
      setState('idle');
      moves.pop();
      setTimeout(moves.wave, 620);
      if (fine) input.focus();
    };
    opener.addEventListener('click', open);
    // runs straight away, not just on the dialog's close event, which can arrive late
    const tidy = () => {
      document.documentElement.classList.remove('yalla-open');
      panel.classList.remove('is-settled');
      unlock();
      if (fine) opener.focus({ preventScroll: true });
      else opener.blur(); // on touch, the browser would leave it outlined
    };
    const shut = () => {
      panel.close();
      tidy();
    };
    $('[data-yalla-close]').addEventListener('click', shut);
    panel.addEventListener('click', (e) => { if (e.target === panel) shut(); });
    panel.addEventListener('close', tidy);
    const goTo = (target) => {
      shut();
      if (target) target.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    };

    const foot = document.querySelector('#contact');
    if ('IntersectionObserver' in window) {
      if (foot) new IntersectionObserver(([e]) => opener.classList.toggle('is-away', e.isIntersecting), { threshold: 0.15 }).observe(foot);
      const seen = new IntersectionObserver((list) => {
        list.forEach((e) => { if (e.isIntersecting) section = e.target.id; else if (section === e.target.id) section = ''; });
        setLabel();
      }, { rootMargin: '-45% 0px -45% 0px' });
      ['work', 'why', 'services', 'process', 'pricing', 'faq'].forEach((id) => {
        const s = document.getElementById(id);
        if (s) seen.observe(s);
      });
    }

    /* ── thread ── */
    const used = () => {
      try {
        const s = JSON.parse(localStorage.getItem('hn-yalla'));
        return s && s.d === today ? s.n : 0;
      } catch { return 0; }
    };
    const count = () => {
      try { localStorage.setItem('hn-yalla', JSON.stringify({ d: today, n: used() + 1 })); } catch {}
    };
    // like Claude: your message moves to the top and the reply fills in below it
    const spacer = $('[data-yalla-spacer]');
    let anchorMsg = null;
    const bottom = () => log.offsetTop + log.offsetHeight;
    const fit = () => {
      spacer.style.height = anchorMsg ? `${Math.max(0, scroller.clientHeight - kb - (bottom() - anchorMsg.offsetTop) - 40)}px` : '0px';
    };
    const toEnd = () => {
      fit();
      const over = bottom() + 24 + kb - (scroller.scrollTop + scroller.clientHeight);
      if (over > 0) scroller.scrollTop += over;
    };
    const anchor = (msg) => {
      anchorMsg = msg;
      fit();
      scroller.scrollTo({ top: msg.offsetTop - 16, behavior: calm ? 'auto' : 'smooth' });
    };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const started = () => {
      hello.hidden = true;
      fresh.hidden = false;
      panel.classList.add('is-chatting');
    };
    const add = (n) => {
      started();
      input.placeholder = 'Reply to Yalla';
      log.append(n);
      toEnd();
      return n;
    };
    const say = (text, you) => add(el('p', you ? 'yalla-msg yalla-msg--you' : 'yalla-msg', text));
    const aside = add;
    // words arrive in bursts; this lets them out at a steady, readable pace
    const typer = (p) => {
      const node = document.createTextNode('');
      p.prepend(node);
      let target = '';
      let shown = 0;
      let raf = 0;
      let wake = null;
      const tick = () => {
        raf = 0;
        const left = target.length - shown;
        if (left <= 0) {
          if (wake) wake();
          return;
        }
        shown += Math.max(1, Math.min(5, Math.ceil(left / 18)));
        node.data = target.slice(0, shown);
        if (Math.random() < 0.12) pulse(0.14);
        toEnd();
        raf = setTimeout(tick, 16); // a timer, so a reply still finishes in a background tab
      };
      return {
        set(text) {
          target = text;
          if (calm) {
            shown = text.length;
            node.data = text;
            toEnd();
          } else if (!raf) raf = setTimeout(tick, 16);
        },
        done: () => new Promise((r) => {
          if (calm || shown >= target.length) r();
          else wake = r;
        }),
      };
    };
    const waButton = (label, href) => {
      const a = el('a', 'btn btn--wa btn--green yalla-go');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.append(el('span', 'btn-label', label));
      const ico = el('span', 'ico');
      ico.setAttribute('aria-hidden', 'true');
      const glyph = document.querySelector('.btn--green .ico svg');
      if (glyph) ico.append(glyph.cloneNode(true));
      a.append(ico);
      return a;
    };
    const handoff = (question) => aside(waButton('Ask Hasan on WhatsApp', `${WA}${encodeURIComponent(`Hi Hasan, I asked Yalla: “${question}”. Can we talk?`)}`));

    /* ── cards, built from what's really on the page ── */
    const cards = {
      pricing() {
        const card = el('div', 'yalla-card');
        const tabs = el('div', 'yalla-tabs');
        tabs.setAttribute('role', 'tablist');
        card.append(tabs);
        const lists = ['Projects', 'Monthly'].map((name, i) => {
          const list = el('div', 'yalla-plans');
          list.hidden = i > 0;
          const tab = el('button', 'yalla-tab', name);
          tab.type = 'button';
          tab.setAttribute('role', 'tab');
          tab.setAttribute('aria-selected', String(i === 0));
          tab.addEventListener('click', () => {
            lists.forEach((l, n) => { l.hidden = n !== i; });
            tabs.querySelectorAll('.yalla-tab').forEach((t, n) => t.setAttribute('aria-selected', String(n === i)));
          });
          tabs.append(tab);
          const pane = document.querySelectorAll('[data-price-panel]')[i];
          (pane ? pane.querySelectorAll('.plan') : []).forEach((plan) => {
            const row = el('button', 'yalla-plan');
            row.type = 'button';
            row.addEventListener('click', () => planDetail(plan));
            const left = el('b', '', plan.querySelector('.plan-name').textContent);
            const lead = plan.querySelector('.plan-lead');
            const fig = plan.querySelector('.plan-fig').textContent.trim().replace(/^AED/, 'AED ');
            row.append(left, el('span', 'yalla-plan-fig', `${lead && /from/i.test(lead.textContent) ? 'From ' : ''}${fig}`));
            list.append(row);
          });
          card.append(list);
          return list;
        });
        const more = el('button', 'yalla-more', 'See full pricing');
        more.type = 'button';
        more.addEventListener('click', () => goTo(document.getElementById('pricing')));
        card.append(more);
        return card;
      },
      work() {
        const card = el('div', 'yalla-work');
        const posters = [...new Set([...document.querySelectorAll('[data-showcase] video[poster]')].map((v) => v.getAttribute('poster')))];
        document.querySelectorAll('.showcase-step').forEach((step, i) => {
          const b = el('button', 'yalla-work-item');
          b.type = 'button';
          if (posters[i]) {
            const img = el('img');
            img.src = posters[i];
            img.alt = '';
            img.loading = 'lazy';
            b.append(img);
          }
          b.append(el('b', '', step.querySelector('.showcase-name').textContent));
          b.addEventListener('click', () => goTo(step));
          card.append(b);
        });
        return card;
      },
      process() {
        const card = el('ol', 'yalla-steps');
        document.querySelectorAll('.step').forEach((step) => {
          const li = el('li');
          li.append(el('b', '', step.querySelector('.step-title').textContent));
          card.append(li);
        });
        return card;
      },
    };
    const showCard = (name) => {
      if (!cards[name] || shown[name]) return;
      shown[name] = true;
      aside(cards[name]());
    };

    /* ── the live brief ── */
    const briefText = () => {
      const lines = FIELDS.filter(([k]) => brief[k]).map(([k, label]) => `${label}: ${brief[k]}`);
      return `${WA}${encodeURIComponent(`Hi Hasan, here’s my brief.\n\n${lines.join('\n')}\n\nCan we talk?`)}`;
    };
    const inputs = {};
    FIELDS.forEach(([key, label]) => {
      const row = el('label', 'yalla-field');
      row.append(el('span', '', label));
      const f = el('input');
      f.type = 'text';
      f.maxLength = 120;
      f.autocomplete = 'off';
      f.addEventListener('input', () => {
        brief[key] = f.value.trim();
        paintBrief();
        if (readyEl) readyCard();
      });
      inputs[key] = f;
      row.append(f);
      fieldsBox.append(row);
    });
    const setOpen = (on) => {
      fieldsBox.hidden = !on;
      toggle.setAttribute('aria-expanded', String(on));
    };
    toggle.addEventListener('click', () => setOpen(fieldsBox.hidden));
    function paintBrief() {
      const filled = FIELDS.filter(([k]) => brief[k]).length;
      FIELDS.forEach(([k]) => { if (document.activeElement !== inputs[k]) inputs[k].value = brief[k] || ''; });
      const can = Boolean(brief.what) && filled >= 3; // sooner than this interrupts the conversation
      goLinks.forEach((a) => { a.href = briefText(); });
      headerWa.href = can ? briefText() : `${WA}${encodeURIComponent('Hi Hasan, can we talk?')}`;
      if (can) tracker.hidden = false;
      setLabel();
      return can;
    }
    let readyEl = null;
    const readyCard = () => {
      const card = el('div', 'yalla-ready');
      const label = el('p', 'yalla-card-label');
      label.textContent = 'Your brief';
      card.append(label);
      FIELDS.filter(([k]) => brief[k]).forEach(([k, name]) => {
        const p = el('p', 'yalla-ready-line');
        p.append(el('span', '', name), el('b', '', brief[k]));
        card.append(p);
      });
      const go = waButton('Yalla, send it to Hasan', briefText());
      goLinks.add(go);
      card.append(go);
      if (readyEl) { // it updates where it is, so the thread doesn't jump
        goLinks.delete(readyEl.querySelector('a'));
        readyEl.replaceWith(card);
      } else {
        add(card);
      }
      readyEl = card;
    };
    const celebrate = () => {
      track('yalla_brief_ready');
      flash('happy', 1900);
      moves.jump();
      setTimeout(moves.jump, 900);
    };
    const mergeBrief = (raw) => {
      raw.split(';').forEach((part) => {
        const i = part.indexOf('=');
        if (i < 0) return;
        const key = part.slice(0, i).trim().toLowerCase();
        const value = part.slice(i + 1).trim().slice(0, 120);
        if (FIELDS.some(([k]) => k === key) && value && !/^(unknown|n\/?a|none)$/i.test(value)) brief[key] = value;
      });
      const can = paintBrief();
      // the card always shows the latest brief, at the end of the thread where the visitor is
      if (can) {
        if (!ready) celebrate();
        ready = true;
        readyCard();
      }
    };

    /* ── quick answers, only while scoping. Typing always works too ── */
    const renderNext = (items) => {
      nextRow.replaceChildren();
      (items || []).forEach((text) => {
        const b = el('button', 'yalla-next', text);
        b.type = 'button';
        b.addEventListener('click', () => scopeAnswer(text));
        nextRow.append(b);
      });
    };

    /* ── written answers ── */
    const reveal = async (text) => {
      const row = thinking();
      setState('thinking');
      await sleep(calm ? 0 : 450 + Math.random() * 450);
      const p = el('p', 'yalla-msg is-live');
      row.replaceWith(p);
      setState('speaking');
      moves.aha();
      const t = typer(p);
      t.set(text);
      await t.done();
      p.classList.remove('is-live');
      setState('idle');
    };
    const starter = async (name) => {
      const st = STARTERS[name];
      if (busy) return;
      track('yalla_option', { yalla_option: name });
      renderNext([]);
      anchor(say(st.ask, true));
      history.push({ role: 'user', content: st.ask }, { role: 'assistant', content: st.say });
      if (name === 'scope') {
        step = 0;
        scopeNext();
      }
      await reveal(st.say);
      if (st.card) showCard(st.card);
      if (name === 'scope' && step >= 0) renderNext(SCOPE[step].chips);
      toEnd();
      if (fine) input.focus();
    };
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-start]');
      if (b) starter(b.dataset.start);
    });

    // a plan opens up in the chat. WhatsApp is only ever a button that says so
    const planDetail = async (plan) => {
      if (busy) return;
      const name = plan.querySelector('.plan-name').textContent;
      const fig = plan.querySelector('.plan-fig').textContent.trim().replace(/^AED/, 'AED ').replace('/mo', ' a month');
      const lead = plan.querySelector('.plan-lead');
      const [label, value] = [...plan.querySelectorAll('.plan-spec span')].map((n) => n.textContent);
      const items = [...plan.querySelectorAll('.plan-list li')].map((n) => n.textContent.trim().replace(/^[A-Z][a-z]/, (m) => m.toLowerCase())); // SEO and QA stay capitals
      const price = /enquire/i.test(fig) ? 'Pricing is on enquiry' : `It’s ${lead && /from/i.test(lead.textContent) ? 'from ' : ''}${fig}`;
      const line = `${price}, and ${/time/i.test(label) ? `takes ${value.replace('~', 'about ')}` : `gives you ${value.replace('/month', ' hours a month')}`}. It covers ${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}.`;
      renderNext([]);
      anchor(say(`Tell me about ${name}`, true));
      history.push({ role: 'user', content: `Tell me about ${name}` }, { role: 'assistant', content: line });
      await reveal(line);
      const go = waButton('Enquire on WhatsApp', plan.querySelector('.plan-cta').href);
      add(go);
      toEnd();
    };

    /* ── guided scoping ── */
    const scopeNext = () => {
      while (step >= 0 && step < SCOPE.length && brief[SCOPE[step].key]) step += 1;
      if (step >= SCOPE.length) step = -1;
    };
    // a tapped answer, or the fallback when the model can't be reached
    async function scopeAnswer(text, echoed) {
      if (step < 0) return;
      const { key } = SCOPE[step];
      renderNext([]);
      if (!echoed) anchor(say(text, true));
      moves.nod();
      brief[key] = text.slice(0, 120);
      paintBrief();
      step += 1;
      scopeNext();
      const q = SCOPE[step];
      const line = q ? q.say(text) : 'Thanks, that’s plenty for Hasan to go on. Here’s your brief.';
      history.push({ role: 'user', content: text }, { role: 'assistant', content: line });
      await reveal(line);
      if (q) {
        renderNext(q.chips);
      } else if (paintBrief()) {
        ready = true;
        readyCard();
        celebrate();
      }
      toEnd();
      if (fine) input.focus();
    }

    /* ── asking the model ── */
    const size = () => {
      input.style.height = 'auto';
      input.style.height = `${Math.max(40, input.scrollHeight)}px`;
      send.disabled = !input.value.trim() && !busy;
    };
    const working = (on) => {
      send.classList.toggle('is-stop', on);
      send.setAttribute('aria-label', on ? 'Stop' : 'Send');
      send.innerHTML = on ? '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8"/></svg>' : arrow;
      send.disabled = !on && !input.value.trim();
    };
    function thinking(label) {
      const row = el('div', 'yalla-think');
      const face = el('span', 'yc-tile yc-tile--think');
      face.append(opener.querySelector('.yc').cloneNode(true));
      row.append(face);
      if (label) row.append(el('span', 'yalla-shimmer', label));
      return add(row);
    }
    const topicOf = (q) => Object.keys(TOPICS).find((k) => TOPICS[k].re.test(q));

    async function ask(question) {
      if (busy) return;
      renderNext([]);
      anchor(say(question, true));
      if (done || used() >= DAILY) {
        done = true;
        say(LIMIT);
        handoff(question);
        return;
      }
      if (!chatId) chatId = `${Date.now()}-${Math.random().toString(36).slice(2, 10).padEnd(6, '0')}`;
      history.push({ role: 'user', content: question });
      track('yalla_message');
      const topic = topicOf(question);
      moves.nod();
      const request = new AbortController();
      busy = request;
      working(true);
      setState('thinking');
      const row = thinking(topic ? TOPICS[topic].status : '');
      if (!topic) { // never leave someone looking at nothing
        setTimeout(() => { if (row.isConnected && !row.querySelector('.yalla-shimmer')) row.append(el('span', 'yalla-shimmer', 'Thinking')); }, 900);
      }
      let raw = '';
      let live = null;
      let limit = false;
      let failed = false;
      let mock = false;
      let said = 0;
      let t = null;

      try {
        const res = await fetch('/api/yalla', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history.slice(-12), context: section, chat: chatId }),
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
        });
        if (!res.ok) throw new Error(res.status);
        mock = res.headers.has('X-Yalla-Mock');
        if ((res.headers.get('Content-Type') || '').includes('json')) {
          limit = true;
        } else {
          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
          for (;;) {
            const { value, done: end } = await reader.read();
            if (end) break;
            raw += value;
            const visible = raw.split('[[')[0].replace(/\[$/, '').trimStart();
            if (!visible) continue;
            if (!live) {
              setState('speaking');
              moves.aha();
              live = el('p', 'yalla-msg is-live');
              row.replaceWith(live);
              t = typer(live);
            }
            if (visible.length - said > 42) {
              said = visible.length;
              moves.nod();
            }
            t.set(visible);
          }
        }
      } catch {
        failed = !request.signal.aborted;
      }
      if (!live) row.remove();
      if (t && !request.signal.aborted) await t.done();
      busy = null;
      working(false);
      setState('idle');
      if (live && !log.contains(live)) return; // New chat cleared it
      if (live) {
        live.classList.remove('is-live');
        if (!request.signal.aborted) live.textContent = raw.split('[[')[0].trim();
      }

      const reply = raw.split('[[')[0].trim();
      if (!reply) {
        if (request.signal.aborted) return;
        history.pop();
        if (step >= 0 && !question.includes('?')) { // scoping still works without the model
          scopeAnswer(question, true);
          return;
        }
        if (limit) done = true;
        say(limit ? LIMIT : 'I can’t reach my notes right now. Try again, or ask Hasan directly.');
        handoff(question);
        if (!limit) {
          const again = el('button', 'yalla-next', 'Try again');
          again.type = 'button';
          again.addEventListener('click', () => ask(question));
          nextRow.replaceChildren(again);
        }
        return;
      }
      if (mock && live) live.append(el('span', 'yalla-mock', 'Test reply, not the real model'));
      count();
      history.push({ role: 'assistant', content: reply });

      const tags = {};
      raw.replace(/\[\[\s*(fields|show|handoff|offtopic)\s*:?\s*([^\]]*)\]\]/gi, (m, k, v) => { tags[k.toLowerCase()] = v.trim(); return m; });
      strikes = 'offtopic' in tags ? strikes + 1 : 0;
      if (tags.fields) mergeBrief(tags.fields);
      if (!('offtopic' in tags) && question.split(/\s+/).length > 2) showCard((tags.show || topic || '').toLowerCase());
      if ('handoff' in tags) handoff(question);
      scopeNext();
      if ('offtopic' in tags) flash('puzzled', 1500);
      if (strikes >= 2) {
        form.hidden = true;
        form.style.display = 'none';
      }
      toEnd();
    }

    fresh.addEventListener('click', () => {
      if (busy) busy.abort();
      history = [];
      chatId = '';
      brief = {};
      shown = {};
      strikes = 0;
      ready = false;
      step = -1;
      readyEl = null;
      goLinks.clear();
        log.replaceChildren();
      nextRow.replaceChildren();
      anchorMsg = null;
      fit();
      input.placeholder = 'Message Yalla';
      hello.hidden = false;
      fresh.hidden = true;
      tracker.hidden = true;
      setOpen(false);
      form.hidden = false;
      form.style.display = '';
      panel.classList.remove('is-chatting');
      paintBrief();
      tracker.hidden = true;
      if (fine) input.focus();
    });

    if (!fine) {
      input.addEventListener('pointerdown', () => {
        if (document.activeElement === input) return;
        setKb(guess());
        setTimeout(() => { if (document.activeElement !== input) setKb(0); }, 700); // a scroll, not a tap
      });
      input.addEventListener('focus', () => { if (!kb) setKb(guess()); });
      input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) setKb(0); }, 80));
    }
    input.addEventListener('input', () => {
      size();
      pulse(0.2);
      if (busy) return;
      setState(input.value ? 'listening' : 'idle');
      // its eyes follow what you type, along the line
      if (input.value) look(-1.3 + 2.6 * Math.min(1, input.selectionStart / 42), 1.1);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (busy) {
        busy.abort();
        return;
      }
      const question = input.value.trim();
      if (!question) return;
      input.value = '';
      size();
      ask(question);
    });

    size();
  }

  Object.assign((window.HC = window.HC || {}), { initYalla });
})();
