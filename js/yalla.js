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
  const LIMIT = 'Khalas, I’m done for today. Hasan can answer this directly.';
  const FIELDS = [['problem', 'Problem'], ['detail', 'Details'], ['what', 'Project'], ['who', 'For'], ['when', 'Timing'], ['budget', 'Budget']];
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
  // the flavour goes at the start and the end. In between it reacts to the answer, in plain words
  // it starts from the problem, not the deliverable: people know what's wrong before they know what to buy.
  // the second question is what makes the suggestion genuine: it's the one that changes the plan
  const PROBLEMS = {
    'I need to launch something fast': {
      say: 'Fast is good. What are you launching?',
      options: [{ text: 'A campaign or offer', plan: 'landing' }, { text: 'A new business', plan: 'website' }],
    },
    'My site isn’t bringing in clients': {
      say: 'A site should earn its keep. What should it sell?',
      options: [{ text: 'One offer', plan: 'landing' }, { text: 'The whole business', plan: 'website' }],
    },
    'I have a product idea to build': {
      say: 'The fun part. Where will people use it?',
      options: [{ text: 'In a browser', plan: 'webapp' }, { text: 'On their phone', plan: 'app' }, { text: 'Not sure yet', plan: 'webapp', unsure: true }],
    },
    'My app is hard to use': {
      say: 'That’s costing you users. Do you have developers?',
      options: [{ text: 'Yes, we do', plan: 'app', note: 'Has developers' }, { text: 'Not yet', plan: 'app', note: 'No developers yet', noDev: true }],
    },
    'My team needs extra hands': {
      say: 'Happy to help. Is it one project, or ongoing?',
      options: [{ text: 'Ongoing', plan: 'whitelabel' }, { text: 'One project', plan: 'agency' }],
    },
    'I need ongoing help': {
      say: 'Good to keep things moving. Is it a live site, or an app in development?',
      options: [{ text: 'A live site', plan: 'maintain' }, { text: 'An app in development', plan: 'appcare' }],
    },
  };
  const KNOWN = 'I already know what I need';
  // who's asking: founders want speed, agencies want extra hands, product leads want quality.
  // it changes the question, the order of the problems and which work comes first
  const ROLES = {
    'A founder': {
      label: 'a founder',
      hello: 'Ahlan. What’s slowing you down?',
      first: 'Yalla, grab a karak. What’s slowing you down?',
      problems: ['I have a product idea to build', 'I need to launch something fast', 'My site isn’t bringing in clients'],
      work: ['GrowthMotive', 'The Birdwatcher'],
    },
    'An agency': {
      label: 'an agency',
      hello: 'Ahlan. What does your team need?',
      first: 'Yalla, grab a karak. What does your team need?',
      problems: ['My team needs extra hands', 'I need to launch something fast'],
      work: ['Cadillac IQ', 'The Birdwatcher'],
    },
    'A product lead': {
      label: 'a product lead',
      hello: 'Ahlan. What needs to be better?',
      first: 'Yalla, grab a karak. What needs to be better?',
      problems: ['My app is hard to use', 'I need ongoing help', 'My team needs extra hands'],
      work: ['McNomNoms', 'Cadillac IQ'],
    },
  };
  // keep in step with the rate card in index.html and llms.txt. card is the plan's name there
  const PLANS = {
    landing: { what: 'A landing page', name: 'a landing page', card: 'Landing page', from: 7500, time: 'about 2 weeks' },
    website: { what: 'A website', name: 'a website', card: 'Website', from: 15000, time: 'about 4–6 weeks', slow: true },
    webapp: { what: 'A web app', name: 'a web app', card: 'Platform', from: 20000, time: 'about 6–10 weeks', slow: true },
    app: { what: 'App design', name: 'app design', card: 'App UI/UX', from: 20000, time: 'about 4–8 weeks', slow: true, note: ' Hasan designs it and your developers build it.' },
    maintain: { what: 'Monthly site support', name: 'the Maintain plan', card: 'Maintain', monthly: 'AED 3,500 a month for 16 hours' },
    appcare: { what: 'Monthly app design support', name: 'the App UI/UX support plan', card: 'App UI/UX support', monthly: 'AED 5,000 a month for 25 hours' },
    whitelabel: { what: 'White-label', card: 'White-label', custom: 'Sounds like White-label: 80 hours a month, under your name. Hasan shares the pricing directly.' },
    agency: { what: 'An agency project', custom: 'Sounds like a one-off project under your name. Hasan shares the pricing directly.' },
  };
  const PROJECTS = { 'A landing page': 'landing', 'A website': 'website', 'A web app': 'webapp', 'A mobile app': 'app' };
  const FIT = { 'Sounds good': 'Sounds good', 'I’d like to talk it through': 'I’d like to talk it through' };
  const SCOPE = [
    { key: 'problem', chips: (brief) => [...new Set([...(ROLES[brief.who]?.problems || []), ...Object.keys(PROBLEMS)]), KNOWN], say: () => 'What’s getting in the way right now?' },
    {
      key: 'detail',
      say: (a) => PROBLEMS[a]?.say || 'Got it. Which of these is closest?',
      chips: (brief) => (PROBLEMS[brief.problem]?.options || []).map((o) => o.text),
    },
    {
      key: 'what',
      say: (a) => (a === KNOWN ? 'Good. What are we building?' : 'Got it. Which of these is closest?'),
      chips: () => Object.keys(PROJECTS),
    },
    {
      key: 'when',
      say: (a, brief = {}) => ({ 'My app is hard to use': 'Got it. When do you want it sorted?', 'My team needs extra hands': 'Got it. When do you need someone?' }[brief.problem] || 'Got it. When do you want it live?'),
      chips: () => ['Within a month', 'In 2–3 months', 'No fixed date'],
    },
    { key: 'fit', say: () => 'Does that work for you?', chips: () => Object.keys(FIT) },
  ];
  // the payoff: they get a plan, a price and a timeline before being asked to message anyone
  const verdict = (brief, pick) => {
    const plan = PLANS[pick?.plan];
    if (!plan) return '';
    if (plan.custom) return plan.custom;
    if (plan.monthly) return `Sounds like ${plan.name}: ${plan.monthly}. Hasan confirms what fits.`;
    const from = `AED ${plan.from.toLocaleString('en-US')}`;
    if (pick.unsure) return `Sounds like a web app or app design. Both start from ${from}, and Hasan can help you decide.`;
    const note = pick.noDev ? ' Hasan designs it, and you’d need developers to build it.' : (plan.note || '');
    const who = note ? 'He' : 'Hasan';
    const base = `Sounds like ${plan.name}. It starts from ${from} and usually takes ${plan.time}`;
    if (plan.slow && brief.when === 'Within a month') return `${base}, so a month is tight.${note} ${who} can tell you what’s possible.`;
    return `${base}.${note} ${who} confirms the final price.`;
  };
  const closing = (answer) => {
    const done = 'Khalas, your brief is ready.';
    return answer === 'I’d like to talk it through' ? `Good idea. Hasan can walk you through it. ${done}` : done;
  };
  const STARTERS = {
    scope: { ask: 'Solve my problem', say: 'Yalla, grab a karak. What’s getting in the way right now?' },
    pricing: { ask: 'What does it cost?', say: 'Yalla, here’s where things start. Hasan confirms the final price once the scope is clear. So, what are we building?', card: 'pricing' },
    work: { ask: 'Show me the work', say: 'Here’s the good stuff. Tap any of them to see it on the page. What are you thinking of building?', card: 'work' },
    process: { ask: 'How does it work?', say: 'Simple, and faster than Sheikh Zayed Road at 6pm. You talk to Hasan the whole way. What are you working on?', card: 'process' },
  };
  const LAUNCH = { work: 'Ask about the work', pricing: 'Which plan fits?', process: 'How does this work?', faq: 'Still curious?' };
  const HELLO = { work: 'Ahlan. Seen the work?', pricing: 'Ahlan. Which plan fits you?', process: 'Ahlan. Want the process?' };

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
    let offered = false;
    let brief = {};
    let shown = {};
    let done = false;
    let busy = null;
    let ready = false;
    let section = '';
    let step = -1; // where we are in SCOPE, -1 when not scoping
    let pick = null; // the plan the answers point to
    let nudging = false; // Yalla's label is offering help on Pricing
    let endNudge = () => {};
    let held = []; // videos paused while the sheet is open
    let run = 0; // New chat moves this on, so a flow still typing knows to stop
    const goLinks = new Set();

    /* ── the character ──
       One-off moves are played with the Web Animations API, using the old rules: anticipate, squash and
       stretch, overshoot, settle, and let the arms follow a beat behind. CSS holds the moods. */
    const heroCta = document.querySelector('[data-yalla-scope]');
    const hosts = [panel, opener, heroCta].filter(Boolean); // every Yalla on the page moves together
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
      shake() {
        play('.yc-root', [T('none'), T('rotate(-4deg)', 0.2), T('rotate(4deg)', 0.4), T('rotate(-3deg)', 0.6), T('rotate(2deg)', 0.8), T('none')], { duration: 620 });
      },
      droop() {
        play('.yc-root', [T('none'), T('translateY(1.5px) scale(1.03, 0.95)', 0.5, SPRING), T('none')], { duration: 1500 });
      },
      gasp() {
        play('.yc-root', [T('none'), T('scale(1.06, 0.9)', 0.15), T('translateY(-4px) scale(0.95, 1.08)', 0.42), T('none')], { duration: 560, easing: SPRING });
      },
      glance() {
        look((Math.random() < 0.5 ? -1 : 1) * 1.3, (Math.random() - 0.5) * 1.6);
        setTimeout(() => { if (mood === 'idle') look(0, 0); }, 800 + Math.random() * 500);
      },
    };
    // how it reacts to each feeling: how long it holds, and what it does
    const FEELINGS = {
      excited: [1700, () => { moves.jump(); setTimeout(moves.wave, 500); }],
      happy: [1600, () => { moves.hop(); }],
      proud: [1800, () => { moves.stretch(); }],
      curious: [2000, () => { moves.tilt(); }],
      sad: [2200, () => { moves.droop(); }],
      surprised: [1200, () => { moves.gasp(); }],
      embarrassed: [1800, () => { moves.droop(); moves.blink(); }],
      playful: [1500, () => { moves.shake(); }],
    };
    const feel = (name) => {
      const f = FEELINGS[name];
      if (!f || calm) return;
      flash(name, f[0]);
      f[1]();
    };
    let energy = 0;
    let raf = 0;
    let mood = 'idle';
    let moodTimer = 0;
    const decay = () => {
      energy *= 0.88;
      parts('.yc-root').forEach((n) => n.style.setProperty('--e', energy.toFixed(3))); // on the logo only, so the panel never repaints
      raf = energy > 0.01 ? requestAnimationFrame(decay) : 0;
    };
    const pulse = (n) => {
      if (calm) return;
      energy = Math.min(1, energy + n);
      if (!raf) raf = requestAnimationFrame(decay);
    };
    function look(x, y) {
      parts('.yc-eyes').forEach((n) => {
        n.style.setProperty('--lx', `${x.toFixed(2)}px`);
        n.style.setProperty('--ly', `${y.toFixed(2)}px`);
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
    let lastActive = 0;
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
      // left alone in an open chat, it dozes off
      setInterval(() => {
        if (panel.open && mood === 'idle' && performance.now() - lastActive > 12000) setState('sleepy');
      }, 1500);
      const wake = () => {
        lastActive = performance.now();
        if (mood === 'sleepy') {
          setState('idle');
          moves.gasp();
        }
      };
      panel.addEventListener('pointerdown', wake);
      panel.addEventListener('keydown', wake);
      // tap it and it reacts
      panel.querySelectorAll('.yc-tile').forEach((t) => t.addEventListener('click', () => feel(['playful', 'happy', 'surprised', 'excited'][Math.floor(Math.random() * 4)])));
      // says hi from the corner a few times, until it's been opened
      const greet = (n) => {
        setTimeout(() => {
          if (!visits && !document.hidden) moves.wave();
          if (n > 1) greet(n - 1);
        }, n === 3 ? 7000 : 30000);
      };
      greet(3);
      [opener, heroCta].forEach((n) => n?.addEventListener('pointerenter', () => { if (fine) moves.wave(); }));
      if (fine) {
        let queued = false;
        window.addEventListener('pointermove', (e) => {
          lastMove = performance.now();
          if (queued || mood !== 'idle') return;
          queued = true;
          requestAnimationFrame(() => {
            queued = false;
            const inHero = heroCta && opener.classList.contains('is-away');
            const face = panel.open ? panel.querySelector('.yc-tile--bar') : (inHero ? heroCta : opener).querySelector('.yc-tile');
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
      if (nudging) return;
      opener.querySelector('.yalla-float-label').textContent = (brief.what || brief.problem) ? 'Back to your brief' : (LAUNCH[section] || 'Ask Yalla');
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
       message box lifts. It lifts as the tap ends, before Safari decides anything, so the box is
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
      panel.classList.toggle('has-kb', n > 0); // the box needs a solid back once it's over the chat
      const until = performance.now() + 380;
      const follow = () => {
        toEnd();
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
      held = [...document.querySelectorAll('main video')].filter((v) => !v.paused);
      held.forEach((v) => v.pause()); // nothing moves behind the sheet
      lock();
      if (!history.length) $('[data-yalla-title]').textContent = ROLES[brief.who]?.hello || HELLO[section] || 'Ahlan. What’s getting in the way?';
      panel.classList.remove('is-settled'); // never carried over from the last time
      visits += 1;
      lastActive = performance.now();
      track('yalla_open', { yalla_section: section || 'top' });
      panel.showModal();
      panel.focus({ preventScroll: true }); // otherwise the first button gets focused and outlined
      setTimeout(() => {
        if (!panel.open) return;
        panel.classList.add('is-settled');
        document.documentElement.classList.add('yalla-covered');
      }, 620);
      sync();
      setState('idle');
      moves.pop();
      setTimeout(moves.wave, 620);
      if (fine) input.focus();
    };
    opener.addEventListener('click', () => {
      if (!nudging) {
        open();
        return;
      }
      endNudge();
      track('yalla_option', { yalla_option: 'pricing nudge' });
      startScope();
    });
    // runs straight away, not just on the dialog's close event, which can arrive late
    const tidy = () => {
      document.documentElement.classList.remove('yalla-open');
      held.forEach((v) => v.play().catch(() => {}));
      held = [];
      panel.classList.remove('is-settled');
      document.documentElement.classList.remove('yalla-covered');
      unlock();
      if (fine) opener.focus({ preventScroll: true });
      else opener.blur(); // on touch, the browser would leave it outlined
    };
    const shut = () => {
      panel.close();
      tidy();
    };
    $('[data-yalla-close]').addEventListener('click', shut);
    // only a press that began on the backdrop closes it. When the keyboard moves things mid-tap, the
    // browser sends the click to the panel itself, so the click's target alone can't be trusted
    let pressedOutside = false;
    panel.addEventListener('pointerdown', (e) => {
      const r = panel.getBoundingClientRect();
      pressedOutside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    });
    panel.addEventListener('click', (e) => { if (e.target === panel && pressedOutside) shut(); });
    panel.addEventListener('close', tidy);
    const goTo = (target) => {
      shut();
      if (target) target.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    };

    const foot = document.querySelector('#contact');
    if (!('IntersectionObserver' in window)) opener.classList.remove('is-away');
    else {
      // out of the way while the hero's own Scope button or the footer is on screen
      const away = { hero: false, foot: false };
      const watch = (target, key, threshold) => {
        if (target) new IntersectionObserver(([e]) => {
          away[key] = e.isIntersecting;
          opener.classList.toggle('is-away', away.hero || away.foot);
        }, { threshold }).observe(target);
      };
      watch(document.querySelector('.hero-ctas'), 'hero', 0);
      watch(foot, 'foot', 0.15);
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
    // the conversation stays anchored to the bottom, with everything earlier right above it. It follows
    // new words unless the visitor has scrolled up to read, and sending a message brings them back down
    let sticky = true;
    const bottom = () => {
      const last = nextRow.childElementCount ? nextRow : log;
      return last.offsetTop + last.offsetHeight;
    };
    const gap = () => bottom() + 24 + kb - (scroller.scrollTop + scroller.clientHeight);
    scroller.addEventListener('scroll', () => { sticky = gap() < 120; }, { passive: true });
    const toEnd = () => {
      if (!sticky) return;
      const over = gap();
      if (over > 0) scroller.scrollTop += over;
    };
    const anchor = () => {
      sticky = true;
      toEnd();
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
        const first = ROLES[brief.who]?.work || [];
        const rank = (step) => {
          const at = first.indexOf(step.querySelector('.showcase-name').textContent);
          return at < 0 ? first.length : at;
        };
        const steps = [...document.querySelectorAll('.showcase-step')];
        [...steps].sort((a, b) => rank(a) - rank(b)).forEach((step) => {
          const i = steps.indexOf(step); // posters follow the page's order
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
      card.append(go, el('p', 'yalla-ready-note', 'Hasan usually replies within a few hours.'));
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
    const bar = $('[data-yalla-progress]');
    let barTimer = 0;
    const setProgress = (share) => {
      clearTimeout(barTimer);
      bar.hidden = share == null;
      if (share == null) return;
      bar.firstElementChild.style.transform = `scaleX(${share})`;
      if (share === 1) barTimer = setTimeout(() => setProgress(null), 1100);
    };
    const renderNext = (items) => {
      nextRow.replaceChildren();
      (items || []).forEach((text) => {
        const b = el('button', 'yalla-next', text);
        b.type = 'button';
        b.addEventListener('click', () => scopeAnswer(text));
        nextRow.append(b);
      });
    };

    /* ── there's always something to do next ── */
    const OPTIONS = [['Solve my problem', 'scope'], ['What does it cost?', 'pricing'], ['Show me the work', 'work'], ['How does it work?', 'process']];
    let usedOptions = new Set();
    const keepGoing = () => {
      if (step >= 0 && SCOPE[step]) {
        const { key, chips } = SCOPE[step];
        renderNext(chips(brief));
        // seeing the end makes people finish
        const plan = PLANS[pick?.plan];
        const short = plan?.monthly || plan?.custom;
        setProgress(({ problem: 1, detail: 2, what: 2, when: 3, fit: short ? 3 : 4 }[key]) / (short ? 4 : 5));
        toEnd();
        return;
      }
      if (!bar.hidden) setProgress(1);
      nextRow.replaceChildren();
      const card = ready && !usedOptions.has('included') && [...document.querySelectorAll('.plan')].find((n) => n.querySelector('.plan-name').textContent === PLANS[pick?.plan]?.card);
      if (card) {
        const b = el('button', 'yalla-next', 'What’s included?');
        b.type = 'button';
        b.addEventListener('click', () => {
          usedOptions.add('included');
          planDetail(card);
        });
        nextRow.append(b);
      }
      OPTIONS.filter(([, name]) => !usedOptions.has(name) && !(name === 'scope' && ready)).slice(0, card ? 1 : 2).forEach(([text, name]) => {
        const b = el('button', 'yalla-next', text);
        b.type = 'button';
        b.addEventListener('click', () => starter(name));
        nextRow.append(b);
      });
      const a = el('a', 'yalla-next', 'Talk to Hasan on WhatsApp');
      a.href = headerWa.href;
      a.target = '_blank';
      a.rel = 'noopener';
      nextRow.append(a);
      toEnd();
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
      usedOptions.add(name);
      renderNext([]);
      anchor(say(st.ask, true));
      const opening = (name === 'scope' && ROLES[brief.who]?.first) || st.say;
      history.push({ role: 'user', content: st.ask }, { role: 'assistant', content: opening });
      if (name === 'scope') {
        step = 0;
        scopeNext();
      }
      const mine = run;
      await reveal(opening);
      if (mine !== run) return;
      if (st.card) showCard(st.card);
      keepGoing();
      toEnd();
      if (fine) input.focus();
    };
    let titleTimer = 0;
    const swapTitle = (text) => {
      const title = $('[data-yalla-title]');
      if (calm || !panel.open || title.textContent === text) {
        title.textContent = text;
        return;
      }
      clearTimeout(titleTimer);
      title.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 130, easing: 'ease-out', fill: 'forwards' });
      titleTimer = setTimeout(() => { // a timer, so the words still change if animations are held back
        title.getAnimations().forEach((n) => n.cancel());
        title.textContent = text;
        title.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      }, 130);
    };
    const roleButtons = [...panel.querySelectorAll('[data-role]')];
    const setRole = (who) => {
      if (who) brief.who = who;
      else delete brief.who;
      roleButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.role === who)));
      swapTitle(ROLES[who]?.hello || HELLO[section] || 'Ahlan. What’s getting in the way?');
    };
    roleButtons.forEach((b) => b.addEventListener('click', () => {
      const on = brief.who === b.dataset.role;
      setRole(on ? '' : b.dataset.role);
      if (!on) {
        track('yalla_option', { yalla_option: b.dataset.role });
        moves.nod();
      }
    }));
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-start]');
      if (b) starter(b.dataset.start);
    });
    // the hero button skips the opening screen and goes straight into scoping
    const startScope = () => {
      const fresh = !history.length;
      open();
      if (fresh) setTimeout(() => starter('scope'), 350); // once the panel is mostly in
    };
    heroCta?.addEventListener('click', startScope);

    // lingering on Pricing usually means comparing or unsure, so Yalla offers help once, in its own label.
    // It types, so the change gets noticed. Yalla never opens itself
    const prices = document.getElementById('pricing');
    if (prices && 'IntersectionObserver' in window) {
      const label = opener.querySelector('.yalla-float-label');
      const line = 'Not sure which plan fits?';
      let wait = 0;
      let fade = 0;
      let typing = 0;
      let offered = false;
      let spent = 0; // time on Pricing adds up, so scrolling around and tapping the tabs doesn't restart it
      let since = 0;
      endNudge = () => {
        clearTimeout(fade);
        clearTimeout(typing);
        if (!nudging) return;
        nudging = false;
        opener.classList.remove('is-nudging');
        setLabel();
      };
      const offer = () => {
        if (offered || history.length) return;
        if (panel.open || document.hidden) { // another browser tab, say: it waits and shows on their return
          wait = setTimeout(offer, 1000);
          return;
        }
        offered = true;
        nudging = true;
        opener.classList.add('is-nudging');
        moves.wave();
        fade = setTimeout(endNudge, 9000);
        if (calm) {
          label.textContent = line;
          return;
        }
        let shown = 0;
        const type = () => {
          shown += 1;
          label.textContent = line.slice(0, shown);
          if (shown < line.length) typing = setTimeout(type, 38);
        };
        label.textContent = '';
        type();
      };
      new IntersectionObserver(([e]) => {
        clearTimeout(wait);
        if (e.isIntersecting) {
          since = performance.now();
          wait = setTimeout(offer, Math.max(0, 15000 - spent));
        } else {
          if (since) spent += performance.now() - since;
          since = 0;
          endNudge();
        }
      }, { rootMargin: '-80% 0px -20% 0px' }).observe(prices);
    }

    // a plan opens up in the chat. WhatsApp is only ever a button that says so
    const planDetail = async (plan) => {
      if (busy) return;
      const name = plan.querySelector('.plan-name').textContent;
      const fig = plan.querySelector('.plan-fig').textContent.trim().replace(/^AED/, 'AED ').replace('/mo', ' a month');
      const lead = plan.querySelector('.plan-lead');
      const [label, value] = [...plan.querySelectorAll('.plan-spec span')].map((n) => n.textContent);
      const items = [...plan.querySelectorAll('.plan-list li')].map((n) => n.textContent.trim().replace(/^[A-Z][a-z]/, (m) => m.toLowerCase())); // SEO and QA stay capitals
      const price = /enquire/i.test(fig) ? 'Pricing is on enquiry' : `It’s ${lead && /from/i.test(lead.textContent) ? 'from ' : ''}${fig}`;
      const line = `${price}, and ${/time/i.test(label) ? `takes ${value.replace('~', 'about ')}` : `gives you ${value.replace('/month', ' hours a month')}`}. It covers ${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}. Want to talk it through with Hasan?`;
      renderNext([]);
      anchor(say(`Tell me about ${name}`, true));
      history.push({ role: 'user', content: `Tell me about ${name}` }, { role: 'assistant', content: line });
      await reveal(line);
      const go = waButton('Enquire on WhatsApp', plan.querySelector('.plan-cta').href);
      add(go);
      keepGoing();
      toEnd();
    };

    /* ── guided scoping ── */
    const scopeNext = () => {
      const plan = PLANS[pick?.plan];
      const settled = {
        problem: () => brief.problem || brief.what,
        detail: () => pick || brief.detail || !PROBLEMS[brief.problem],
        what: () => pick || brief.what,
        when: () => brief.when || plan?.monthly,
        fit: () => brief.budget || !plan || plan.custom,
      };
      while (step >= 0 && step < SCOPE.length && settled[SCOPE[step].key]()) step += 1;
      if (step >= SCOPE.length) step = -1;
    };
    const record = (key, text) => {
      if (key === 'problem') {
        if (text !== KNOWN) brief.problem = text.slice(0, 120);
        if (PROBLEMS[text]) track('yalla_option', { yalla_option: text });
      } else if (key === 'detail') {
        const option = PROBLEMS[brief.problem]?.options.find((o) => o.text === text);
        brief.detail = (option?.note || text).slice(0, 120);
        if (option) {
          pick = option;
          brief.what = PLANS[option.plan].what;
        }
      } else if (key === 'what') {
        brief.what = text.slice(0, 120);
        if (PROJECTS[text]) {
          pick = { plan: PROJECTS[text] };
          brief.what = PLANS[pick.plan].what;
        }
      } else if (key === 'fit') {
        brief.budget = (FIT[text] || text).slice(0, 120);
      } else {
        brief[key] = text.slice(0, 120);
      }
    };
    // a tapped answer, or the fallback when the model can't be reached
    async function scopeAnswer(text, echoed) {
      if (step < 0) return;
      const { key } = SCOPE[step];
      renderNext([]);
      if (!echoed) anchor(say(text, true));
      moves.nod();
      record(key, text);
      paintBrief();
      step += 1;
      scopeNext();
      const q = SCOPE[step];
      const suggestion = verdict(brief, pick);
      if (suggestion) usedOptions.add('pricing'); // they've just been told
      let line;
      if (q && q.key !== 'fit') line = q.say(text, brief);
      else if (q) line = `${suggestion} ${q.say()}`;
      else if (key === 'fit') line = closing(text);
      else line = `${suggestion} Khalas, your brief is ready.`.trim();
      history.push({ role: 'user', content: text }, { role: 'assistant', content: line });
      const mine = run;
      await reveal(line);
      if (mine !== run) return;
      if (!q && paintBrief()) {
        ready = true;
        readyCard();
        celebrate();
        await sleep(900);
        if (mine !== run) return;
        await reveal('Anything you want to ask before you send it?');
        if (mine !== run) return;
      }
      keepGoing();
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

    async function ask(question, again) {
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
      // typed instead of tapped: their own words are the problem, and scoping moves on
      if (step >= 0 && SCOPE[step]?.key === 'problem' && !question.includes('?')) brief.problem = question.slice(0, 120);
      track('yalla_message');
      const topic = topicOf(question);
      moves.nod();
      let failed = false;
      const request = new AbortController();
      const giveUp = setTimeout(() => { failed = true; request.abort(); }, 45000);
      busy = request;
      working(true);
      setState('thinking');
      const row = thinking(topic ? TOPICS[topic].status : '');
      if (!topic) { // never leave someone looking at nothing
        setTimeout(() => { if (row.isConnected && !row.querySelector('.yalla-shimmer')) row.append(el('span', 'yalla-shimmer', ['Yalla, 1 second', 'Shway shway', 'Checking with my karak'][Math.floor(Math.random() * 3)])); }, 900);
      }
      let raw = '';
      let live = null;
      let limit = false;
      let mock = false;
      let said = 0;
      let t = null;

      try {
        const res = await fetch('/api/yalla', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: brief.who ? [{ role: 'user', content: `For context: I’m ${ROLES[brief.who]?.label || brief.who}.` }, { role: 'assistant', content: 'Noted.' }, ...history.slice(-10)] : history.slice(-12), context: section, chat: chatId }),
          signal: request.signal,
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
        failed = failed || !request.signal.aborted;
      }
      clearTimeout(giveUp);
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

      let reply = raw.split('[[')[0].trim();
      // only tags came back: keep the conversation going rather than failing
      if (!reply && raw.includes('[[')) {
        reply = step >= 0 && SCOPE[step + 1] ? SCOPE[step + 1].say('Got it') : 'Tell me a bit more about what you have in mind.';
        say(reply);
      }
      if (!reply) {
        if (request.signal.aborted && !failed) return;
        history.pop();
        if (!limit && !again) { // a hiccup shouldn't end the chat: try once more, quietly
          log.lastChild.remove();
          ask(question, true);
          return;
        }
        if (step >= 0 && !question.includes('?')) { // scoping still works without the model
          scopeAnswer(question, true);
          return;
        }
        if (limit) done = true;
        say(limit ? LIMIT : 'Wallah, I lost my train of thought. Want to try that again, or ask Hasan directly?');
        handoff(question);
        if (!limit) {
          const again = el('button', 'yalla-next', 'Try again');
          again.type = 'button';
          again.addEventListener('click', () => ask(question));
          nextRow.replaceChildren(again);
          toEnd();
        }
        return;
      }
      if (mock && live) live.append(el('span', 'yalla-mock', 'Test reply, not the real model'));
      count();
      history.push({ role: 'assistant', content: reply });

      const tags = {};
      raw.replace(/\[\[\s*(fields|show|handoff|offtopic|mood)\s*:?\s*([^\]]*)\]\]/gi, (m, k, v) => { tags[k.toLowerCase()] = v.trim(); return m; });
      if (tags.fields) mergeBrief(tags.fields);
      if (!('offtopic' in tags) && question.split(/\s+/).length > 2) showCard((tags.show || topic || '').toLowerCase());
      if ('handoff' in tags && !offered) {
        offered = true; // once per chat, so it doesn't feel like being shown the door
        handoff(question);
      }
      scopeNext();
      if ('offtopic' in tags) flash('puzzled', 1500);
      else feel((tags.mood || '').toLowerCase());
      keepGoing();
      toEnd();
    }

    fresh.addEventListener('click', () => {
      if (busy) busy.abort();
      history = [];
      chatId = '';
      offered = false;
      usedOptions = new Set();
      pick = null;
      run += 1;
      setProgress(null);
      brief = {};
      shown = {};
      ready = false;
      step = -1;
      readyEl = null;
      goLinks.clear();
        log.replaceChildren();
      nextRow.replaceChildren();
      sticky = true;
      input.placeholder = 'Message Yalla';
      hello.hidden = false;
      setRole('');
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
      // lift as the finger comes up: any earlier pulls the box out from under the tap and the keyboard never
      // opens; any later and Safari has already shoved the whole page up to make room
      let downY = 0;
      input.addEventListener('pointerdown', (e) => { downY = e.clientY; });
      input.addEventListener('pointerup', (e) => {
        if (document.activeElement === input || Math.abs(e.clientY - downY) > 10) return;
        setKb(guess());
        setTimeout(() => { if (document.activeElement !== input) setKb(0); }, 700);
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
