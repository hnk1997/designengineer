"""Capture a live page (a WebGL hero, an animated app) as an evenly-timed frame sequence that loops.

The page's clock is taken over before it loads: performance.now, Date.now and requestAnimationFrame
only move when this script steps them, 1/30 s per frame, so every frame is exactly spaced however
long the GPU takes. It records LOOP + XFADE seconds and dissolves the first XFADE seconds in from
the overflow, so the last frame runs straight on into the first. Encode with reel.swift frames.

    python3 scripts/reel/capture.py <url> <out_dir>
    env: VW/VH (page size, 1280x800), SCALE (pixel ratio, sets the output size), MOBILE (1: touch phone),
         WARM (seconds run before recording, 4), LOOP (8), XFADE (1.5, 0 for none), SETUP (JS run after warm-up),
         ACTION + ACTION_AT (JS run that many seconds into the recording, e.g. tap an answer),
         ACTIONS (a JSON list of [seconds, JS] for several; each result is printed as `action <t> <json>`),
         SCROLL (a JSON list of [seconds, scrollY] keys: the page scrolls between them, eased, frame by frame;
                 a key's y may be a CSS selector, or [selector, offset px], read once the page has loaded)
"""
import base64, io, json, os, socket, struct, subprocess, sys, tempfile, time, urllib.request
from PIL import Image

url, out = sys.argv[1], sys.argv[2]
VW, VH = int(os.environ.get("VW", "1280")), int(os.environ.get("VH", "800"))
SCALE = float(os.environ.get("SCALE", "1"))
WARM, LOOP, XFADE = float(os.environ.get("WARM", "4")), float(os.environ.get("LOOP", "8")), float(os.environ.get("XFADE", "1.5"))
SETUP = os.environ.get("SETUP", "")
ACTION, ACTION_AT = os.environ.get("ACTION", ""), float(os.environ.get("ACTION_AT", "1"))
ACTIONS = json.loads(os.environ.get("ACTIONS", "[]"))
SCROLL = json.loads(os.environ.get("SCROLL", "[]"))
if ACTION: ACTIONS.append([ACTION_AT, ACTION])
MOBILE = os.environ.get("MOBILE") == "1"
FPS = 30
os.makedirs(out, exist_ok=True)

CLOCK = """(() => {
  let now = 0; const cbs = []; const realRAF = window.requestAnimationFrame.bind(window);
  const t0 = Date.now();
  performance.now = () => now; Date.now = () => t0 + now;
  window.requestAnimationFrame = (cb) => { cbs.push(cb); return cbs.length; };
  window.cancelAnimationFrame = () => {};
  window.__step = (ms, settle) => {
    now += ms; const list = cbs.splice(0); for (const cb of list) { try { cb(now); } catch (e) { console.error(e); } }
    return settle ? new Promise((r) => realRAF(() => realRAF(r))) : 0;
  };
})();"""

# VIRTUAL=1: timers and Web Animations / CSS animations run on the same virtual clock too, so page transitions
# (setTimeout + element.animate) and scroll-scrubbed GSAP keep their real timing however slow each frame is
VIRTUAL = os.environ.get("VIRTUAL") == "1"
CLOCK_ALL = """(() => {
  let now = 0; const cbs = []; const realRAF = window.requestAnimationFrame.bind(window);
  const t0 = Date.now(); let timers = []; let tid = 1;
  performance.now = () => now; Date.now = () => t0 + now;
  window.requestAnimationFrame = (cb) => { cbs.push(cb); return cbs.length; };
  window.cancelAnimationFrame = () => {};
  window.setTimeout = (fn, ms, ...a) => { const id = tid++; timers.push({ id, at: now + (+ms || 0), fn, a }); return id; };
  window.clearTimeout = (id) => { timers = timers.filter((t) => t.id !== id); };
  window.setInterval = (fn, ms, ...a) => { const id = tid++; const run = () => { fn(...a); timers.push({ id, at: now + Math.max(4, +ms || 0), fn: run, a: [] }); }; timers.push({ id, at: now + Math.max(4, +ms || 0), fn: run, a: [] }); return id; };
  window.clearInterval = window.clearTimeout;
  const tracked = new WeakMap();
  window.__step = (ms, settle) => {
    now += ms;
    const due = timers.filter((t) => t.at <= now).sort((x, y) => x.at - y.at); timers = timers.filter((t) => t.at > now);
    for (const t of due) { try { typeof t.fn === 'function' ? t.fn(...t.a) : 0; } catch (e) { console.error(e); } }
    const list = cbs.splice(0); for (const cb of list) { try { cb(now); } catch (e) { console.error(e); } }
    for (const an of document.getAnimations()) {
      if (!tracked.has(an)) { tracked.set(an, now - (an.currentTime || 0)); try { an.pause(); } catch (e) {} }
      try { an.currentTime = (now - tracked.get(an)) * (an.playbackRate || 1); } catch (e) {}
    }
    return settle ? new Promise((r) => realRAF(() => realRAF(r))) : 0;
  };
})();"""

port = 9338
chrome = subprocess.Popen([
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "--headless=new",
    "--use-angle=metal", "--enable-gpu-rasterization", "--ignore-gpu-blocklist",
    f"--remote-debugging-port={port}", f"--user-data-dir={tempfile.mkdtemp()}",
    f"--window-size={VW},{VH}", "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required", "about:blank",
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(60):
        try:
            pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json"))
            page = next(p for p in pages if p["type"] == "page"); break
        except Exception:
            time.sleep(0.2)
    path = page["webSocketDebuggerUrl"].split(str(port), 1)[1]
    s = socket.create_connection(("127.0.0.1", port))
    key = base64.b64encode(os.urandom(16)).decode()
    s.send(f"GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n".encode())
    s.recv(4096)

    def send(obj):
        data = json.dumps(obj).encode(); n = len(data)
        head = bytearray([0x81]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536 else bytes([0x80 | 127]) + struct.pack(">Q", n))
        mask = os.urandom(4)
        s.send(bytes(head) + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def rx(n):
        b = b""
        while len(b) < n: b += s.recv(n - len(b))
        return b

    def recv():
        b1, b2 = rx(2); n = b2 & 0x7F
        if n == 126: n = struct.unpack(">H", rx(2))[0]
        elif n == 127: n = struct.unpack(">Q", rx(8))[0]
        return json.loads(rx(n))

    ids = [0]
    def call(method, params=None):
        ids[0] += 1; i = ids[0]
        send({"id": i, "method": method, "params": params or {}})
        while True:
            m = recv()
            if m.get("id") == i:
                if "error" in m: raise RuntimeError(m["error"])
                return m.get("result", {})

    def js(expr):
        r = call("Runtime.evaluate", {"expression": expr, "awaitPromise": True, "returnByValue": True})
        if "exceptionDetails" in r: raise RuntimeError(r["exceptionDetails"])
        return r["result"].get("value")

    call("Emulation.setDeviceMetricsOverride", {"width": VW, "height": VH, "deviceScaleFactor": SCALE, "mobile": MOBILE})
    if MOBILE: call("Emulation.setTouchEmulationEnabled", {"enabled": True, "maxTouchPoints": 5})
    call("Page.enable")
    call("Page.addScriptToEvaluateOnNewDocument", {"source": CLOCK_ALL if VIRTUAL else CLOCK})
    call("Page.navigate", {"url": url})
    time.sleep(3)  # load: fonts, textures, shaders
    # warm up on the virtual clock, so intros have finished before the loop starts
    for k in range(int(WARM * FPS)):
        js(f"window.__step({1000 / FPS}, {'true' if k % 10 == 0 else 'false'})")
    if SETUP: js(SETUP)
    js(f"window.__step({1000 / FPS}, true)")
    keys = []
    for at, y in SCROLL:
        if isinstance(y, list): sel, off = y; y = js(f"Math.round(document.querySelector({json.dumps(sel)}).getBoundingClientRect().top + scrollY)") + off
        elif isinstance(y, str): y = js(f"Math.round(document.querySelector({json.dumps(y)}).getBoundingClientRect().top + scrollY)")
        keys.append((at, y))
    def scroll_at(t):
        if not keys: return None
        if t <= keys[0][0]: return keys[0][1]
        for (ta, a), (tb, b) in zip(keys, keys[1:]):
            if t <= tb:
                u = (t - ta) / (tb - ta) if tb > ta else 1
                return a + (b - a) * (u * u * (3 - 2 * u))
        return keys[-1][1]
    frames = []
    n, x = int(round(LOOP * FPS)), int(round(XFADE * FPS))
    def safe(expr):
        for _ in range(40):
            try: return js(expr)
            except Exception: time.sleep(0.1)
    for k in range(n + x):
        y = scroll_at(k / FPS)
        if y is not None: safe(f"window.scrollTo(0, {y:.1f})")
        for at, code in ACTIONS:
            if k == int(round(at * FPS)): print('action', at, json.dumps(safe(code)), flush=True)
        safe(f"window.__step ? window.__step({1000 / FPS}, true) : 0")
        shot = call("Page.captureScreenshot", {"format": "png"})
        frames.append(Image.open(io.BytesIO(base64.b64decode(shot["data"]))).convert("RGB"))
        if k % 60 == 0: print("frame", k, "/", n + x, flush=True)
    # the seam: the head dissolves in from the overflow, so frame n-1 leads straight into frame 0
    for i in range(n):
        im = frames[i]
        if i < x:
            u = i / x; w = u * u * (3 - 2 * u)
            im = Image.blend(frames[n + i], frames[i], w)
        im.save(os.path.join(out, f"f{i:05d}.png"))
    print("loop", n, "frames", frames[0].size, flush=True)
finally:
    chrome.kill()
