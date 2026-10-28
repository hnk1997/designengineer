"""Render a journey page (see journey.js) frame by frame with headless Chrome, for reel.swift to encode.

    python3 scripts/reel/render.py <url> <out_dir> [scale] [times]
      times: comma-separated seconds for a few stills (to review), or omit for every frame at 30 fps.
"""
import base64, json, os, socket, struct, subprocess, sys, tempfile, time, urllib.request

url, out = sys.argv[1], sys.argv[2]
scale = float(sys.argv[3]) if len(sys.argv) > 3 else 1.5
times = [float(x) for x in sys.argv[4].split(',')] if len(sys.argv) > 4 else None
FPS = 30
os.makedirs(out, exist_ok=True)
port = 9336
chrome = subprocess.Popen([
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "--headless=new",
    "--use-angle=metal", "--enable-gpu-rasterization", "--ignore-gpu-blocklist",
    f"--remote-debugging-port={port}", f"--user-data-dir={tempfile.mkdtemp()}",
    "--window-size=440,956", "--hide-scrollbars", "about:blank",
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

    call("Emulation.setDeviceMetricsOverride", {"width": 440, "height": 956, "deviceScaleFactor": scale, "mobile": False})
    call("Page.enable")
    call("Page.navigate", {"url": url})
    for _ in range(300):
        time.sleep(0.2)
        try:
            if js("typeof window.ready") == "object": break
        except Exception:
            pass
    total = js("window.ready")
    W, H = js("[document.getElementById('stage').offsetWidth, document.getElementById('stage').offsetHeight]")
    call("Emulation.setDeviceMetricsOverride", {"width": W, "height": H, "deviceScaleFactor": scale, "mobile": False})
    print("journey", total, "s", flush=True)
    stamps = times if times is not None else [f / FPS for f in range(int(round(total * FPS)))]
    for k, t in enumerate(stamps):
        js(f"seek({t})")
        shot = call("Page.captureScreenshot", {"format": "png", "clip": {"x": 0, "y": 0, "width": W, "height": H, "scale": 1}})
        name = f"t{t:.2f}.png" if times is not None else f"f{k:05d}.png"
        open(os.path.join(out, name), "wb").write(base64.b64decode(shot["data"]))
        if k % 60 == 0: print("frame", k, "/", len(stamps), flush=True)
finally:
    chrome.kill()
