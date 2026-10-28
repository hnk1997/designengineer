// The journey engine behind the phone and laptop reels: inline the Figma screens (exported SVGs),
// wrap every layer so it can move, and pose all of it on one timeline. A page sets window.STAGE
// ({ w, h, short }), loads this, then calls run(build) with its own choreography. seek(t) poses the
// timeline at t seconds, so scripts/reel/render.py can capture it frame by frame for reel.swift;
// play() watches it live in a browser.
const W = (window.STAGE || {}).w || 440, H = (window.STAGE || {}).h || 956;
const stage = document.getElementById('stage');
// the stage, its layers and the touch markers; sized from STAGE
document.head.insertAdjacentHTML('beforeend', `<style>
  html, body { margin: 0; background: #111; }
  #stage { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: #fff; }
  .screen { position: absolute; inset: 0; visibility: hidden; }
  .screen > .exit { position: absolute; inset: 0; }
  .screen svg { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; display: block; }
  .a { transform-box: fill-box; transform-origin: 50% 50%; }
  #taps { position: absolute; inset: 0; z-index: 40; pointer-events: none; }
  .tap { position: absolute; width: 54px; height: 54px; margin: -27px 0 0 -27px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,.75) 0 45%, rgba(255,255,255,.35) 70%, rgba(255,255,255,0) 72%);
    box-shadow: 0 0 0 1px rgba(0,0,0,.06), 0 6px 18px rgba(0,0,0,.18); opacity: 0; }
  .ring { position: absolute; width: 54px; height: 54px; margin: -27px 0 0 -27px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,.9); opacity: 0; }
  #flash { position: absolute; inset: 0; background: #fff; opacity: 0; z-index: 30; }
</style>`);
if (!document.getElementById('flash')) stage.insertAdjacentHTML('afterbegin', '<div id="flash"></div><div id="taps"></div>');

const anims = [];          // every animation on the timeline, paused and seeked together
const spans = [];          // [element, from, to]: shown only between these times
const fps = 30;

// easings: iOS sheet/push, a soft ease-out, and springs written out as linear()
const IOS = 'cubic-bezier(.32,.72,0,1)', OUT = 'cubic-bezier(.22,1,.36,1)', INOUT = 'cubic-bezier(.65,0,.35,1)';
function spring(z = 0.55, w = 9) {
  const pts = [], n = 48, T = 1;  // normalised: settle within the duration
  const wd = w * Math.sqrt(1 - z * z);
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * T, e = Math.exp(-z * w * t);
    pts.push((1 - e * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t))).toFixed(4));
  }
  pts[n] = '1';
  return `linear(${pts.join(',')})`;
}
const POP = spring(0.5, 11), SOFT = spring(0.75, 9), BOUNCE = spring(0.38, 13);

// The first animation of a property on an element holds its first pose before it starts (fill both);
// later ones on the same property only take over once they begin, so they never mask the earlier ones.
const seen = new WeakMap();
function A(el, frames, at, dur, easing = OUT, opts = {}) {
  let fill = opts.fill;
  if (!fill) {
    const props = Object.keys(frames[0]).filter((k) => k !== 'offset' && k !== 'easing');
    const had = seen.get(el) || new Set(); seen.set(el, had);
    fill = (opts.composite || 'replace') === 'replace' && props.some((k) => had.has(k)) ? 'forwards' : 'both';
    if ((opts.composite || 'replace') === 'replace') props.forEach((k) => had.add(k));
  }
  const a = el.animate(frames, { duration: dur * 1000, delay: at * 1000, easing, fill, composite: opts.composite || 'replace', iterations: opts.iterations || 1 });
  a.pause(); anims.push(a); return a;
}
// motion layered on top of an element's entrance: only active in its window, added to the base pose
const ADD = (el, frames, at, dur, easing = INOUT, iterations = 1) => A(el, frames, at, dur, easing, { fill: 'none', composite: 'add', iterations });

// ── screens ────────────────────────────────────────────────────────────────
// fit: false keeps an artboard at its own size (a screen inside a phone, not the whole stage)
async function load(name, { fit = true } = {}) {
  const txt = await (await fetch(name + '.svg')).text();
  const wrap = document.createElement('div'); wrap.className = 'screen';
  const exit = document.createElement('div'); exit.className = 'exit';
  exit.innerHTML = txt; wrap.appendChild(exit); stage.insertBefore(wrap, document.getElementById('flash'));
  const svg = exit.querySelector('svg');
  const root = svg.querySelector(':scope > g[clip-path]') || svg;
  const sw = +svg.getAttribute('width'), sh = +svg.getAttribute('height');
  const tall = fit && sh < H - 40;     // a shorter artboard, re-laid out to the stage's height
  if (fit && sh > H + 40) svg.style.height = (sh * W / sw) + 'px';   // a long page, scrolled by the journey
  // wrap each top-level layer: an outer <g> for the re-layout (an SVG transform), an inner one to animate (CSS)
  const layers = [];
  [...root.children].forEach((el) => {
    if (!el.getBBox || ['defs', 'mask', 'clipPath', 'pattern', 'filter'].includes(el.tagName)) { layers.push(null); return; }
    const b = el.getBBox();
    const outer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    inner.setAttribute('class', 'a');
    const blend = el.style.mixBlendMode; if (blend) { el.style.mixBlendMode = ''; outer.style.mixBlendMode = blend; }
    el.replaceWith(outer); outer.appendChild(inner); inner.appendChild(el);
    layers.push({ outer, inner, b, bt: outer.getBBox() });   // bt: the bounds with the layer's own transform applied
  });
  if (tall) {
    svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const cp = root.getAttribute('clip-path'); const id = cp && cp.match(/#([^)]+)/)[1];
    if (id) svg.querySelector(`#${CSS.escape(id)} rect`).setAttribute('height', H);
  }
  return { name, wrap, exit, svg, layers, tall };
}
function shift(s, i, dy) { const l = s.layers[i]; if (l) l.outer.setAttribute('transform', `translate(0 ${dy})`); }
function stretch(s, i) {   // a full-bleed background: grow it to the taller screen
  const l = s.layers[i]; if (!l) return;
  const k = H / Math.max(l.b.y + l.b.height, (window.STAGE || {}).short || 782.222);
  l.outer.setAttribute('transform', `scale(1 ${k})`);
}
// the 440 x 783 artboards to the phone's 440 x 956: background stretched, rows of content spaced out
function relayout(s, map) {
  if (map.none) return;
  s.layers.forEach((l, i) => {
    if (!l) return;
    if (map.bg && map.bg.includes(i)) return stretch(s, i);
    // any full-screen backing layer grows with the screen, or the screen behind would show through
    if (l.b.x <= 0 && l.b.y <= 1 && l.b.width >= W - 1 && l.b.height >= 700) return stretch(s, i);
    if (map.dy && i in map.dy) return shift(s, i, map.dy[i]);
    const y = l.b.y;
    shift(s, i, y < 120 ? 40 : y < 640 ? 100 : 141);
  });
}
const L = (s, ...idx) => idx.flat().map((i) => s.layers[i].inner);
const box = (s, i) => { const l = s.layers[i]; const m = l.outer.getAttribute('transform') || ''; const t = m.match(/translate\(0 ([\d.-]+)\)/); return { x: l.b.x, y: l.b.y + (t ? +t[1] : 0), w: l.b.width, h: l.b.height }; };
const centre = (s, i) => { const b = box(s, i); return [b.x + b.w / 2, b.y + b.h / 2]; };

// ── building blocks ───────────────────────────────────────────────────────
const show = (s, from, to) => spans.push([s.wrap, from, to]);
function fadeUp(els, at, { dy = 16, dur = 0.7, stagger = 0.07 } = {}) {
  els.forEach((e, k) => A(e, [{ opacity: 0, transform: `translateY(${dy}px)` }, { opacity: 1, transform: 'none' }], at + k * stagger, dur, OUT));
}
function pop(els, at, { from = 0.5, dur = 0.8, stagger = 0.06, origin = '50% 50%', ease = POP } = {}) {
  els.forEach((e, k) => {
    e.style.transformOrigin = origin;
    A(e, [{ transform: `scale(${from})` }, { transform: 'none' }], at + k * stagger, dur, ease);
    A(e, [{ opacity: 0 }, { opacity: 1 }], at + k * stagger, dur * 0.3, 'linear');
  });
}
function bob(els, from, to, { amp = 5, period = 2.4 } = {}) {
  els.forEach((e) => ADD(e, [{ transform: 'translateY(0)' }, { transform: `translateY(${-amp}px)` }, { transform: 'translateY(0)' }], from, period, INOUT, Math.max(1, Math.floor((to - from) / period))));
}
function twinkle(els, from, { period = 1.6 } = {}) {
  els.forEach((e, k) => ADD(e, [{ transform: 'scale(1) rotate(0deg)', opacity: 0 }, { transform: 'scale(.82) rotate(-10deg)', opacity: -0.35 }, { transform: 'scale(1) rotate(0deg)', opacity: 0 }], from + k * 0.23, period, INOUT, 8));
}
const taps = document.getElementById('taps');
// a finger: lands, presses the control, lifts with a ring
function tap(x, y, at, press = []) {
  const d = document.createElement('div'); d.className = 'tap'; d.style.left = x + 'px'; d.style.top = y + 'px';
  const r = document.createElement('div'); r.className = 'ring'; r.style.left = x + 'px'; r.style.top = y + 'px';
  taps.append(d, r);
  A(d, [{ opacity: 0, transform: 'scale(1.5)' }, { opacity: 1, transform: 'scale(1)' }], at - 0.28, 0.28, OUT);
  A(d, [{ transform: 'scale(1)' }, { transform: 'scale(.8)' }, { transform: 'scale(1)' }], at, 0.26, INOUT, { composite: 'add', fill: 'none' });
  A(d, [{ opacity: 1 }, { opacity: 0 }], at + 0.22, 0.25, 'linear');
  A(r, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 0.9, transform: 'scale(.8)', offset: 0.08 }, { opacity: 0, transform: 'scale(1.9)' }], at + 0.12, 0.55, OUT);
  press.forEach((e) => ADD(e, [{ transform: 'scale(1)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }], at, 0.3, INOUT));
}
// a finger that lands, drags from one point to another (a sheet pulled up), and lifts
function drag(x1, y1, x2, y2, at, dur = 0.55) {
  const d = document.createElement('div'); d.className = 'tap'; d.style.left = x1 + 'px'; d.style.top = y1 + 'px';
  taps.append(d);
  A(d, [{ opacity: 0, transform: 'scale(1.4)' }, { opacity: 1, transform: 'scale(.9)' }], at - 0.25, 0.25, OUT);
  ADD(d, [{ transform: 'translate(0, 0)' }, { transform: `translate(${x2 - x1}px, ${y2 - y1}px)` }], at, dur, IOS);
  A(d, [{ opacity: 1 }, { opacity: 0 }], at + dur, 0.25, 'linear');
  A(d, [{ translate: '0 0' }, { translate: `${x2 - x1}px ${y2 - y1}px` }], at + dur, 0.3, 'linear');
}
// a desktop pointer: glides between points, presses with a soft ring at its tip
function cursor(x, y) {
  const c = document.createElement('div');
  c.style.cssText = `position:absolute;left:0;top:0;width:28px;height:28px;z-index:45;pointer-events:none;transform-origin:3px 3px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.28))`;
  c.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M4 2.5v19.2l4.9-4.6 3.1 7.1 3.4-1.5-3.1-7h6.8L4 2.5Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const pos = document.createElement('div'); pos.style.cssText = 'position:absolute;left:0;top:0;z-index:45;pointer-events:none';
  pos.appendChild(c); taps.appendChild(pos);
  let at = [x, y];
  const api = {
    show(t0) { A(c, [{ opacity: 0 }, { opacity: 1 }], t0, 0.3, 'linear'); return api; },
    hide(t0) { A(c, [{ opacity: 1 }, { opacity: 0 }], t0, 0.3, 'linear'); return api; },
    move(x2, y2, t0, dur = 0.7) { A(pos, [{ transform: `translate(${at[0]}px, ${at[1]}px)` }, { transform: `translate(${x2}px, ${y2}px)` }], t0, dur, 'cubic-bezier(.45,0,.2,1)'); at = [x2, y2]; return api; },
    click(t0, press = []) {
      ADD(c, [{ transform: 'scale(1)' }, { transform: 'scale(.82)' }, { transform: 'scale(1)' }], t0, 0.22, INOUT);
      const r = document.createElement('div'); r.className = 'ring'; r.style.cssText += `left:${at[0] + 3}px;top:${at[1] + 3}px;border-color:rgba(37,99,235,.55)`;
      taps.appendChild(r);
      A(r, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(.4)', offset: 0.1 }, { opacity: 0, transform: 'scale(1.1)' }], t0 + 0.05, 0.5, OUT);
      press.forEach((e) => ADD(e, [{ transform: 'scale(1)' }, { transform: 'scale(.96)' }, { transform: 'scale(1)' }], t0, 0.25, INOUT));
      return api;
    },
  };
  A(pos, [{ transform: `translate(${x}px, ${y}px)` }, { transform: `translate(${x}px, ${y}px)` }], 0, 0.01, 'linear');
  return api;
}
// screen changes, all on the screen wrappers
function pushIn(next, prev, at, dur = 0.62) {
  A(next.wrap, [{ transform: `translateX(${W}px)` }, { transform: 'none' }], at, dur, IOS);
  A(prev.exit, [{ transform: 'none', filter: 'brightness(1)' }, { transform: `translateX(${-W * 0.3}px)`, filter: 'brightness(.82)' }], at, dur, IOS);
  next.wrap.style.boxShadow = '-12px 0 40px rgba(0,0,0,.18)';
  show(next, at, 1e9); return at + dur;
}
// out, then in: the old screen clears before the new one arrives, so two layouts never overlap.
// shared: a true crossfade, for two screens that hold the same character in the same place
function fadeIn(next, prev, at, dur = 0.6, { shared = false } = {}) {
  if (shared) { A(next.wrap, [{ opacity: 0 }, { opacity: 1 }], at, dur, INOUT); show(next, at, 1e9); return at + dur; }
  A(prev.exit, [{ opacity: 1 }, { opacity: 0 }], at, dur * 0.5, 'cubic-bezier(.4,0,1,1)');
  A(next.wrap, [{ opacity: 0 }, { opacity: 1 }], at + dur * 0.45, dur * 0.55, OUT);
  show(next, at + dur * 0.45, 1e9); return at + dur;
}
function riseIn(next, prev, at, dur = 0.75) {
  A(next.wrap, [{ transform: `translateY(${H}px)` }, { transform: 'none' }], at, dur, IOS);
  A(prev.exit, [{ filter: 'brightness(1)' }, { filter: 'brightness(.7)' }], at, dur, IOS);
  show(next, at, 1e9); return at + dur;
}
function flashTo(next, prev, at) {
  const f = document.getElementById('flash');
  A(f, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], at, 0.6, INOUT, { fill: 'none' });
  A(next.wrap, [{ opacity: 0 }, { opacity: 1 }], at + 0.29, 0.02, 'linear'); show(next, at + 0.29, 1e9); return at + 0.3;
}
// closes the screen's latest open span (a screen can be shown more than once)
function endSpan(s, at) { const sp = [...spans].reverse().find((x) => x[0] === s.wrap && x[2] >= 1e9); if (sp) sp[2] = at; }


let TOTAL = 0;
window.seek = (t) => {
  const on = new Map();
  for (const [el, a, b] of spans) on.set(el, on.get(el) || (t >= a && t < b));
  for (const [el, v] of on) el.style.visibility = v ? 'visible' : 'hidden';
  for (const a of anims) a.currentTime = t * 1000;
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
};
window.play = () => { const t0 = performance.now(); const f = () => { const t = ((performance.now() - t0) / 1000) % TOTAL; seek(t); requestAnimationFrame(f); }; f(); };
window.run = (build) => (window.ready = build().then((T) => { TOTAL = T; seek(0); return T; }));
