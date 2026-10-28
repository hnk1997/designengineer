// Canvas-drawn "screens" for each layer of the product stack.
// Bottom to top: Idea → Structure → Design → Build → Launch.
(() => {

  const W = 1024;
  const H = 624;
  const FONT = '"Inter Tight", system-ui, sans-serif';
  const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  const C = {
    blue: '#2563EB',
    rose: '#E11D48',
    orange: '#F97316',
    ink: '#0B0C0F',
    paper: '#EEF0F3',
    grey: '#5B6270',
  };

  function draw(fn, c = document.createElement('canvas')) {
    c.width = W; // also clears it, for a redraw
    c.height = H;
    const g = c.getContext('2d');
    g.lineCap = 'round';
    g.lineJoin = 'round';
    fn(g);
    return c;
  }

  // Deterministic randomness so the sketch looks the same every load.
  function rng(seed) {
    return () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  }

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  }

  function tracking(g, px) {
    if ('letterSpacing' in g) g.letterSpacing = `${px}px`;
  }

  function sketchLine(g, r, x1, y1, x2, y2, wob = 4) {
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      g.moveTo(x1 + (r() - 0.5) * wob, y1 + (r() - 0.5) * wob);
      g.quadraticCurveTo(
        (x1 + x2) / 2 + (r() - 0.5) * wob * 2,
        (y1 + y2) / 2 + (r() - 0.5) * wob * 2,
        x2 + (r() - 0.5) * wob,
        y2 + (r() - 0.5) * wob,
      );
      g.stroke();
    }
  }

  function sketchRect(g, r, x, y, w, h) {
    sketchLine(g, r, x, y, x + w, y);
    sketchLine(g, r, x + w, y, x + w, y + h);
    sketchLine(g, r, x + w, y + h, x, y + h);
    sketchLine(g, r, x, y + h, x, y);
  }

  function dimension(g, x1, y1, x2, y2, text) {
    const vertical = x1 === x2;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    const t = 7;
    if (vertical) {
      g.moveTo(x1 - t, y1); g.lineTo(x1 + t, y1);
      g.moveTo(x2 - t, y2); g.lineTo(x2 + t, y2);
    } else {
      g.moveTo(x1, y1 - t); g.lineTo(x1, y1 + t);
      g.moveTo(x2, y2 - t); g.lineTo(x2, y2 + t);
    }
    g.stroke();
    g.fillText(text, vertical ? x1 + 12 : (x1 + x2) / 2 - g.measureText(text).width / 2, vertical ? (y1 + y2) / 2 + 6 : y1 - 12);
  }

  /* 01 — Idea: a napkin sketch on glass (transparent background) */
  function idea(g) {
    const r = rng(7);
    g.clearRect(0, 0, W, H);

    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = 32; x < W; x += 32) for (let y = 32; y < H; y += 32) g.fillRect(x - 1, y - 1, 2, 2);

    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 3;
    sketchRect(g, r, 96, 90, 600, 430);
    sketchLine(g, r, 96, 146, 696, 146);
    g.lineWidth = 7;
    sketchLine(g, r, 136, 214, 500, 208, 6);
    sketchLine(g, r, 136, 258, 420, 262, 6);
    g.lineWidth = 3;
    sketchLine(g, r, 136, 312, 450, 312);
    sketchLine(g, r, 136, 338, 380, 340);
    sketchRect(g, r, 136, 386, 150, 48);
    sketchRect(g, r, 516, 196, 150, 196);
    sketchLine(g, r, 516, 196, 666, 392);
    sketchLine(g, r, 666, 196, 516, 392);

    // the important bit, circled
    g.strokeStyle = C.orange;
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(212, 410, 112, 46, -0.05, 0.4, Math.PI * 2 + 0.15);
    g.stroke();
    g.beginPath();
    g.moveTo(330, 440);
    g.bezierCurveTo(470, 540, 650, 540, 770, 420);
    g.stroke();
    g.beginPath();
    g.moveTo(770, 420); g.lineTo(748, 424);
    g.moveTo(770, 420); g.lineTo(764, 442);
    g.stroke();

    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.font = `300 38px ${FONT}`;
    g.fillText('make this', 740, 340);
    g.fillText('actually work', 740, 384);

    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.font = `500 17px ${FONT}`;
    tracking(g, 2);
    g.fillText('V0.0 — NAPKIN', 40, H - 34);
  }

  /* 02 — Structure: wireframe with spec marks */
  function structure(g) {
    g.fillStyle = '#0E1014';
    g.fillRect(0, 0, W, H);

    g.strokeStyle = '#4B5263';
    g.lineWidth = 2;
    const box = (x, y, w, h) => g.strokeRect(x + 0.5, y + 0.5, w, h);
    const xbox = (x, y, w, h) => {
      box(x, y, w, h);
      g.beginPath();
      g.moveTo(x, y); g.lineTo(x + w, y + h);
      g.moveTo(x + w, y); g.lineTo(x, y + h);
      g.stroke();
    };
    const bar = (x, y, w, h = 12) => { g.fillStyle = '#262B36'; g.fillRect(x, y, w, h); };

    box(48, 40, 928, 56);
    bar(68, 62, 90);
    [590, 670, 750].forEach((x) => bar(x, 62, 56));
    box(856, 52, 104, 32);

    bar(48, 136, 420, 36);
    bar(48, 182, 330, 36);
    bar(48, 238, 380, 12);
    bar(48, 260, 300, 12);
    box(48, 296, 140, 44);
    box(200, 296, 120, 44);
    xbox(520, 136, 456, 210);

    [48, 368, 688].forEach((x) => {
      xbox(x, 392, 288, 118);
      bar(x, 524, 200);
      bar(x, 544, 140);
    });

    g.strokeStyle = C.blue;
    g.fillStyle = C.blue;
    g.lineWidth = 2;
    g.font = `600 16px ${FONT}`;
    dimension(g, 500, 346, 500, 392, '48');
    dimension(g, 336, 372, 368, 372, '32');
    dimension(g, 48, 118, 468, 118, '6 COL');

    g.fillStyle = 'rgba(255,255,255,0.42)';
    g.font = `500 17px ${FONT}`;
    tracking(g, 2);
    g.fillText('WIREFRAME — FLOW 1 OF 4', 48, H - 30);
  }

  /* 03 — Design: polished UI + tokens */
  function design(g) {
    g.fillStyle = C.paper;
    g.fillRect(0, 0, W, H);

    const logo = g.createLinearGradient(50, 54, 78, 82);
    logo.addColorStop(0, C.blue);
    logo.addColorStop(1, C.rose);
    g.fillStyle = logo;
    g.beginPath(); g.arc(64, 68, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.ink;
    g.font = `600 22px ${FONT}`;
    tracking(g, -0.5);
    g.fillText('Product', 88, 76);
    g.fillStyle = C.grey;
    g.font = `500 17px ${FONT}`;
    ['Features', 'Pricing', 'Docs'].forEach((t, i) => g.fillText(t, 590 + i * 92, 74));
    rr(g, 870, 48, 106, 38, 19); g.fillStyle = C.ink; g.fill();
    g.fillStyle = '#fff'; g.fillText('Sign up', 893, 74);

    g.fillStyle = C.ink;
    g.font = `600 70px ${FONT}`;
    tracking(g, -3);
    g.fillText('Ship the', 46, 196);
    g.fillText('thing.', 46, 264);
    g.fillStyle = C.grey;
    g.font = `400 21px ${FONT}`;
    tracking(g, 0);
    g.fillText('A product your team will actually use.', 48, 308);

    rr(g, 48, 334, 152, 50, 25); g.fillStyle = C.blue; g.fill();
    g.fillStyle = '#fff'; g.font = `600 18px ${FONT}`; g.fillText('Get started', 76, 366);
    rr(g, 212, 334, 140, 50, 25); g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke();
    g.fillStyle = C.ink; g.fillText('Book a demo', 230, 366);

    // gradient card
    g.save();
    rr(g, 520, 120, 456, 264, 22);
    g.clip();
    g.fillStyle = C.blue; g.fillRect(520, 120, 456, 264);
    const blob = (x, y, rad, col) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(520, 120, 456, 264);
    };
    blob(560, 400, 300, 'rgba(225,29,72,0.95)');
    blob(960, 120, 260, 'rgba(249,115,22,0.9)');
    blob(760, 250, 160, 'rgba(37,99,235,0.6)');
    g.fillStyle = 'rgba(255,255,255,0.92)';
    [70, 110, 90, 150, 130, 190].forEach((h, i) => { rr(g, 560 + i * 62, 344 - h, 36, h, 6); g.fill(); });
    g.font = `600 18px ${FONT}`;
    g.fillText('Weekly active', 556, 160);
    g.restore();

    // tokens
    g.fillStyle = C.grey;
    g.font = `600 14px ${FONT}`;
    tracking(g, 2);
    g.fillText('TOKENS', 48, 440);
    g.fillText('TYPE', 420, 440);
    g.fillText('SPACING', 690, 440);
    tracking(g, 0);
    [C.blue, C.rose, C.orange, C.ink, '#FFFFFF'].forEach((col, i) => {
      g.beginPath(); g.arc(72 + i * 62, 500, 24, 0, Math.PI * 2);
      g.fillStyle = col; g.fill();
      if (col === '#FFFFFF') { g.strokeStyle = '#C9CDD5'; g.lineWidth = 2; g.stroke(); }
    });
    g.fillStyle = C.ink;
    g.font = `600 76px ${FONT}`;
    tracking(g, -3);
    g.fillText('Aa', 416, 530);
    tracking(g, 0);
    g.fillStyle = C.grey;
    g.font = `500 16px ${FONT}`;
    g.fillText('Inter Tight', 524, 492);
    g.fillText('600 / -3%', 524, 516);
    [8, 16, 24, 32, 48].forEach((s, i, arr) => {
      const x = 690 + arr.slice(0, i).reduce((a, b) => a + b + 14, 0);
      g.fillStyle = i % 2 ? C.rose : C.blue;
      g.globalAlpha = 0.85;
      g.fillRect(x, 520 - s, s, s);
      g.globalAlpha = 1;
    });

    g.fillStyle = 'rgba(11,12,15,0.42)';
    g.font = `500 17px ${FONT}`;
    tracking(g, 2);
    g.fillText('DESIGN SYSTEM — V2', 48, H - 28);
  }

  /* 04 — Build: the same thing, in code */
  function build(g) {
    g.fillStyle = '#0A0C10';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#12151B';
    g.fillRect(0, 0, W, 48);
    g.fillStyle = '#0A0C10';
    g.fillRect(24, 8, 168, 40);
    g.fillStyle = C.blue;
    g.fillRect(24, 46, 168, 2);
    g.font = `500 17px ${MONO}`;
    g.fillStyle = '#E6E8EE'; g.fillText('Launch.tsx', 44, 34);
    g.fillStyle = '#596071'; g.fillText('tokens.css', 222, 34);

    const K = C.rose, F = '#7AA2FF', S = C.orange, P = '#C9CED8', M = '#596071';
    const lines = [
      [['// designed and built by the same person', M]],
      [['import ', K], ['{ Hero, Button } ', P], ['from ', K], ["'./ui'", S], [';', P]],
      [],
      [['export default function ', K], ['Launch', F], ['() {', P]],
      [['  const ', K], ['[live, setLive] = ', P], ['useState', F], ['(false);', P]],
      [],
      [['  return ', K], ['(', P]],
      [['    <', P], ['Hero ', F], ['title=', P], ['"Ship the thing."', S], ['>', P]],
      [['      <', P], ['Button ', F], ['onClick=', P], ['{() => ', P], ['setLive', F], ['(true)}>', P]],
      [['        Go live', P]],
      [['      </', P], ['Button', F], ['>', P]],
      [['    </', P], ['Hero', F], ['>', P]],
      [['  );', P]],
      [['}', P]],
    ];
    g.font = `400 19px ${MONO}`;
    lines.forEach((tokens, i) => {
      const y = 86 + i * 27;
      g.fillStyle = '#343A48';
      g.fillText(String(i + 1).padStart(2, ' '), 26, y);
      let x = 76;
      tokens.forEach(([text, col]) => {
        g.fillStyle = col;
        g.fillText(text, x, y);
        x += g.measureText(text).width;
      });
    });
    g.fillStyle = '#E6E8EE';
    g.fillRect(196, 86 + 9 * 27 - 18, 2, 22); // caret

    g.fillStyle = '#0E1117';
    g.fillRect(0, 470, W, H - 470);
    g.fillStyle = '#1C212B';
    g.fillRect(0, 470, W, 1);
    g.font = `500 18px ${MONO}`;
    g.fillStyle = '#596071'; g.fillText('$', 26, 510);
    g.fillStyle = '#E6E8EE'; g.fillText('npm run deploy', 50, 510);
    g.fillStyle = C.orange; g.fillText('✓', 26, 546);
    g.fillStyle = '#C9CED8'; g.fillText('Built in 41s · 0 errors · 0 surprises', 50, 546);
    g.fillStyle = F; g.fillText('→ Live at yourproduct.com', 26, 582);
  }

  /* 05 — Launch: shipped product in a browser */
  function launch(g) {
    g.fillStyle = '#08090C';
    g.fillRect(0, 0, W, H);

    const blob = (x, y, rad, col) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 52, W, H - 52);
    };
    g.globalCompositeOperation = 'lighter';
    blob(640, 560, 460, 'rgba(37,99,235,0.85)');
    blob(260, 620, 320, 'rgba(225,29,72,0.7)');
    blob(940, 300, 300, 'rgba(249,115,22,0.55)');
    g.globalCompositeOperation = 'source-over';

    g.fillStyle = '#15171D';
    g.fillRect(0, 0, W, 52);
    [C.rose, C.orange, C.blue].forEach((col, i) => {
      g.beginPath(); g.arc(30 + i * 24, 26, 7, 0, Math.PI * 2); g.fillStyle = col; g.fill();
    });
    rr(g, 300, 12, 424, 28, 14); g.fillStyle = '#0B0C10'; g.fill();
    g.fillStyle = '#9097A6';
    g.font = `500 16px ${FONT}`;
    const url = 'yourproduct.com';
    g.fillText(url, 512 - g.measureText(url).width / 2, 32);

    rr(g, 60, 104, 150, 34, 17);
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1.5; g.stroke();
    g.beginPath(); g.arc(80, 121, 5, 0, Math.PI * 2); g.fillStyle = C.orange; g.fill();
    g.fillStyle = '#fff';
    g.font = `600 14px ${FONT}`;
    tracking(g, 2);
    g.fillText('V1.0 — LIVE', 94, 126);

    tracking(g, -6);
    g.font = `600 150px ${FONT}`;
    g.fillText('Live.', 52, 292);
    tracking(g, 0);
    g.fillStyle = 'rgba(255,255,255,0.72)';
    g.font = `400 26px ${FONT}`;
    g.fillText('Shipped on the date we agreed.', 60, 344);

    [60, 372, 684].forEach((x, i) => {
      rr(g, x, 412, 280, 150, 14);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(x + 22, 440, 120 - i * 20, 12);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x + 22, 466, 200, 8);
      g.fillRect(x + 22, 484, 160, 8);
    });

    // cursor, mid-click
    g.save();
    g.translate(690, 250);
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(0, 40); g.lineTo(11, 30); g.lineTo(19, 47); g.lineTo(26, 44); g.lineTo(18, 27); g.lineTo(32, 27);
    g.closePath();
    g.fillStyle = '#fff'; g.fill();
    g.strokeStyle = '#08090C'; g.lineWidth = 2; g.stroke();
    g.restore();
  }

  function makeTextures(anisotropy = 4) {
    const out = {};
    for (const [key, fn] of Object.entries({ idea, structure, design, build, launch })) {
      const tex = new THREE.CanvasTexture(draw(fn));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = anisotropy;
      // The scene doesn't wait for the web font: if it arrives later, the screens are
      // drawn again in it (the first draw uses the fallback font)
      tex.userData.redraw = () => { draw(fn, tex.image); tex.needsUpdate = true; };
      out[key] = tex;
    }
    return out;
  }

  Object.assign((window.HC = window.HC || {}), { makeTextures });
})();
