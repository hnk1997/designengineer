// Technical callouts tracked to points on the 3D stack: markers, leader
// lines, bounding boxes and labels, re-projected every frame.
(() => {
  const { DIMS, scramble } = window.HC;

  const NS = 'http://www.w3.org/2000/svg';
  const CYCLE = 2.8; // seconds each layer stays "in focus"
  const H_COMPACT = 32;
  const H_ACTIVE = 104;

  class Annotations {
    constructor({ svg, host, stage, reduced = false }) {
      this.svg = svg;
      this.host = host;
      this.stage = stage;
      this.reduced = reduced;
      this.w = 1;
      this.h = 1;
      this.frame = 0;
      this.active = -1;
      this.visible = false;
      this.p = { x: 0, y: 0 };

      // Box corners in layer-local space, for the active layer's bounding box
      const { w, d, t } = DIMS;
      this.corners = [];
      for (const x of [-w / 2, w / 2]) for (const y of [-t / 2, t / 2]) for (const z of [-d / 2, d / 2]) {
        this.corners.push(new THREE.Vector3(x, y, z));
      }
      // Either right-hand corner can be the outermost, depending on the stack's angle
      this.rightCorners = [new THREE.Vector3(w / 2, t / 2, -d / 2), new THREE.Vector3(w / 2, t / 2, d / 2)];

      this.extras = this.makeExtras(18);
      this.items = stage.layers.map((L) => this.makeItem(L));
    }

    node(tag, cls) {
      const el = document.createElementNS(NS, tag);
      el.setAttribute('class', cls);
      this.svg.appendChild(el);
      return el;
    }

    makeItem(L) {
      const box = this.node('rect', 'ann-box');
      const line = this.node('path', 'ann-line');
      const mark = this.node('rect', 'ann-mark');
      mark.setAttribute('width', 7);
      mark.setAttribute('height', 7);

      const label = document.createElement('div');
      label.className = 'ann-label';
      label.innerHTML = `
        <div class="ann-head"><span class="ann-name">${L.name}</span></div>
        <div class="ann-more"><div>
          <p class="ann-meta">${L.meta}</p>
          <p class="ann-coords"></p>
        </div></div>`;
      this.host.appendChild(label);

      return {
        L, box, line, mark, label,
        meta: label.querySelector('.ann-meta'),
        coords: label.querySelector('.ann-coords'),
        ax: 0, ay: 0, lx: null, ly: null,
      };
    }

    makeExtras(n) {
      let s = 11;
      const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const sizes = [6, 8, 10, 14, 22, 30, 40];
      const { w, d, t } = DIMS;
      const pts = [];
      for (let k = 0; k < n; k++) {
        pts.push({
          li: Math.floor(r() * this.stage.layers.length),
          local: new THREE.Vector3((r() - 0.5) * w * 0.92, t / 2, (r() - 0.5) * d * 0.92),
          size: sizes[Math.floor(r() * sizes.length)],
          rect: this.node('rect', 'ann-extra'),
          x: 0, y: 0,
        });
      }
      this.links = [];
      for (let k = 0; k < n - 1; k += 2) {
        this.links.push({ a: pts[k], b: pts[k + 1], el: this.node('line', 'ann-link') });
      }
      return pts;
    }

    resize(w, h) {
      this.w = w;
      this.h = h;
      this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      this.items.forEach((it) => { it.lx = null; });
    }

    reveal() {
      this.visible = true;
      const els = [...this.extras.map((e) => e.rect), ...this.links.map((l) => l.el)];
      els.forEach((el, i) => setTimeout(() => el.classList.add('is-in'), 200 + i * 45));
      this.items.forEach((it, i) => setTimeout(() => {
        it.mark.classList.add('is-in');
        it.line.classList.add('is-in');
        it.box.classList.add('is-in');
        it.label.classList.add('is-in');
      }, i * 140));
      this.t0 = null;
    }

    setActive(index) {
      this.items.forEach((it, i) => {
        const on = i === index;
        it.label.classList.toggle('is-active', on);
        it.line.classList.toggle('is-active', on);
        it.mark.classList.toggle('is-active', on);
        it.box.classList.toggle('is-active', on);
      });
      this.active = index;
      if (!this.reduced) scramble(this.items[index].meta, { duration: 0.5, settle: 0.18 });
    }

    update(time) {
      if (!this.visible) return;
      if (this.t0 == null) this.t0 = time;
      const { w, h, stage, p } = this;
      const mobile = w < 768;
      const n = this.items.length;
      this.frame++;

      // Walk the story bottom to top: idea → launch
      const active = this.reduced ? n - 1 : Math.floor((time - this.t0) / CYCLE) % n;
      if (active !== this.active) this.setActive(active);

      let right = 0;
      for (const it of this.items) {
        stage.project(it.L.group, it.L.anchorLocal, p);
        it.ax = p.x;
        it.ay = p.y;
        for (const c of this.rightCorners) {
          stage.project(it.L.group, c, p);
          right = Math.max(right, p.x);
        }
      }

      // Labels sit in a tidy column to the right of the stack, pushed apart so they never overlap
      const top = mobile ? h * 0.36 : 104;
      const bottom = mobile ? h - 150 : h - 260; // clear of the testimonial card
      const colX = mobile
        ? null
        : Math.min(w - 220, right + 28);
      const sorted = [...this.items].sort((a, b) => a.ay - b.ay);
      let prev = top;
      const targets = new Map();
      for (const it of sorted) {
        const hh = (it === this.items[active] ? H_ACTIVE : H_COMPACT) / 2;
        const y = Math.max(it.ay, prev + 8 + hh);
        targets.set(it, { y, hh });
        prev = y + hh;
      }
      const overflow = prev - bottom;
      if (overflow > 0) targets.forEach((tg) => { tg.y -= overflow; });

      for (const it of this.items) {
        const tg = targets.get(it);
        const isActive = it === this.items[active];
        let tx = colX;
        let ty = tg.y;
        if (mobile) {
          tx = Math.min(w - 192 - 16, Math.max(16, it.ax + 28));
          ty = it.ay - 56;
        }
        if (it.lx == null) { it.lx = tx; it.ly = ty; }
        it.lx += (tx - it.lx) * 0.2;
        it.ly += (ty - it.ly) * 0.2;

        const hideOnMobile = mobile && !isActive;
        it.label.style.visibility = hideOnMobile ? 'hidden' : '';
        it.line.style.visibility = hideOnMobile ? 'hidden' : '';

        it.mark.setAttribute('x', it.ax - 3.5);
        it.mark.setAttribute('y', it.ay - 3.5);
        const ex = it.lx - 24;
        it.line.setAttribute('d', mobile
          ? `M${it.ax},${it.ay} L${it.lx},${it.ly + 16}`
          : `M${it.ax},${it.ay} L${ex},${it.ly} L${it.lx},${it.ly}`);
        it.label.style.transform = `translate3d(${it.lx}px, ${it.ly}px, 0) translateY(${mobile ? 0 : -50}%)`;

        if (isActive) {
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (const c of this.corners) {
            stage.project(it.L.group, c, p);
            x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
            x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
          }
          const pad = 10;
          it.box.setAttribute('x', x0 - pad);
          it.box.setAttribute('y', y0 - pad);
          it.box.setAttribute('width', x1 - x0 + pad * 2);
          it.box.setAttribute('height', y1 - y0 + pad * 2);
          if (this.frame % 4 === 0) {
            it.coords.textContent = `x ${(it.ax / w).toFixed(3)}  ·  y ${(it.ay / h).toFixed(3)}`;
          }
        }
      }

      const extrasShown = mobile ? 8 : this.extras.length;
      this.extras.forEach((e, k) => {
        stage.project(stage.layers[e.li].group, e.local, p);
        e.x = p.x;
        e.y = p.y;
        e.rect.style.visibility = k < extrasShown ? '' : 'hidden';
        e.rect.setAttribute('x', e.x - e.size / 2);
        e.rect.setAttribute('y', e.y - e.size / 2);
        e.rect.setAttribute('width', e.size);
        e.rect.setAttribute('height', e.size);
      });
      for (const l of this.links) {
        l.el.setAttribute('x1', l.a.x);
        l.el.setAttribute('y1', l.a.y);
        l.el.setAttribute('x2', l.b.x);
        l.el.setAttribute('y2', l.b.y);
      }
    }
  }

  Object.assign((window.HC = window.HC || {}), { Annotations });
})();
