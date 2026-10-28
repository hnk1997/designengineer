"""Record a page as a short looping MP4, for the Currently building clips.

Headless Chrome screencasts the page, then re-encodes the frames in-browser with
MediaRecorder (no ffmpeg needed). Saves <out> plus <out>.first.jpg for a poster.

    python3 scripts/record-clip.py <url> assets/building/name.mp4
    env: SECS (length), PRE (wait before recording), WHEEL (scroll plan, see below), SETUP (JS run first, awaited if it
    returns a promise, e.g. hide the nav or click through an intro), ACTION + ACTION_AT (JS run mid-recording, e.g. click a button),
    CROP ("[x,y,w,h]" of the page), VW/VH (page size, default 1280x800),
    OW/OH (output size), BITRATE, TAIL (seconds to hold the last frame: a still page
    sends no frames, so a final pause would otherwise be cut).
"""
import base64, json, os, socket, struct, subprocess, sys, tempfile, time, urllib.request

url, out = sys.argv[1], sys.argv[2]
secs = float(os.environ.get("SECS", "6"))
pre = float(os.environ.get("PRE", "3"))
setup_js = os.environ.get("SETUP", "")      # run after load (hide things, etc.)
action_js = os.environ.get("ACTION", "")    # run when recording starts
action_at = float(os.environ.get("ACTION_AT", "1"))
VW, VH = int(os.environ.get("VW", "1280")), int(os.environ.get("VH", "800"))
port = 9334
chrome = subprocess.Popen([
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "--headless=new",
    # real GPU: heavy WebGL sites stall on the software renderer
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
    events = []
    def recv():
        b1, b2 = rx(2); n = b2 & 0x7F
        if n == 126: n = struct.unpack(">H", rx(2))[0]
        elif n == 127: n = struct.unpack(">Q", rx(8))[0]
        return json.loads(rx(n))
    ids = [100]
    def call(method, params=None, timeout=None):
        ids[0] += 1; i = ids[0]
        send({"id": i, "method": method, "params": params or {}})
        while True:
            m = recv()
            if m.get("id") == i: return m
            events.append(m)
    call("Emulation.setDeviceMetricsOverride", {"width": VW, "height": VH, "deviceScaleFactor": 1, "mobile": False})
    call("Page.enable")
    call("Page.navigate", {"url": url})
    time.sleep(pre)
    if setup_js:
        res = call("Runtime.evaluate", {"expression": setup_js, "awaitPromise": True, "returnByValue": True})
        print("setup:", res.get("result", {}).get("result", {}).get("value"))
        time.sleep(0.6)
    frames = []
    call("Page.startScreencast", {"format": "jpeg", "quality": 88, "maxWidth": VW, "maxHeight": VH, "everyNthFrame": 1})
    t0 = time.time(); acted = False
    # WHEEL: real mouse-wheel scrolling, as [[pixels, ms, hold_ms], ...] from ACTION_AT.
    # Scroll-driven sites often ignore scrollTo, so this drives them the way a person would.
    wheel = json.loads(os.environ.get("WHEEL", "[]"))
    plan = []
    at = action_at
    for px, ms, hold in wheel:
        steps = max(1, int(ms / 33))
        for k in range(steps):
            plan.append((at + (k + 1) * ms / 1000 / steps, px / steps))
        at += ms / 1000 + hold / 1000
    s.settimeout(0.05)
    while time.time() - t0 < secs:
        if action_js and not acted and time.time() - t0 > action_at:
            acted = True; s.settimeout(None); call("Runtime.evaluate", {"expression": action_js}); s.settimeout(0.05)
        while plan and time.time() - t0 >= plan[0][0]:
            _, dy = plan.pop(0)
            s.settimeout(None)
            send({"id": 99998, "method": "Input.dispatchMouseEvent", "params": {"type": "mouseWheel", "x": VW // 2, "y": VH // 2, "deltaX": 0, "deltaY": dy}})
            s.settimeout(0.05)
        try:
            m = events.pop(0) if events else recv()
        except socket.timeout:
            continue
        if m.get("method") == "Page.screencastFrame":
            p = m["params"]
            frames.append((time.time(), p["data"]))  # arrival time: steadier than the frame's own stamp
            s.settimeout(None); send({"id": 99999, "method": "Page.screencastFrameAck", "params": {"sessionId": p["sessionId"]}}); s.settimeout(0.05)
    s.settimeout(None)
    call("Page.stopScreencast")
    print("frames", len(frames), "over", round(frames[-1][0] - frames[0][0], 1) if frames else 0, "s")
    if os.environ.get("DUMP"):
        for k in range(0, len(frames), max(1, len(frames) // 8)):
            open(f"{out}.f{k}.jpg", "wb").write(base64.b64decode(frames[k][1]))
    open(out + ".first.jpg", "wb").write(base64.b64decode(frames[min(len(frames) - 1, int(os.environ.get("POSTER_AT", "0")))][1]))
    # re-encode: draw the frames onto a canvas at their own timing and record it
    call("Page.navigate", {"url": "about:blank"}); time.sleep(0.5)
    call("Runtime.evaluate", {"expression": "window.F=[];1"})
    base = frames[0][0]
    for k in range(0, len(frames), 20):
        chunk = [[round((t - base) * 1000), d] for t, d in frames[k:k + 20]]
        call("Runtime.evaluate", {"expression": f"window.F.push(...{json.dumps(chunk)});1"})
    W, H = int(os.environ.get("OW", "960")), int(os.environ.get("OH", "600"))
    js = """new Promise(async (done) => {
      const W=%d, H=%d, c=document.createElement('canvas'); c.width=W; c.height=H; document.body.appendChild(c);
      const g=c.getContext('2d');
      const imgs = await Promise.all(F.map(([t,d]) => new Promise(r => { const i=new Image(); i.onload=()=>r([t,i]); i.src='data:image/jpeg;base64,'+d; })));
      const types=['video/mp4;codecs=avc1.42E01F','video/mp4','video/webm;codecs=vp9'];
      const type=types.find(t=>MediaRecorder.isTypeSupported(t));
      const rec=new MediaRecorder(c.captureStream(30), {mimeType:type, videoBitsPerSecond:%d});
      const parts=[]; rec.ondataavailable=e=>parts.push(e.data);
      rec.onstop=async()=>{ const b=new Blob(parts,{type}); const buf=new Uint8Array(await b.arrayBuffer()); let s=''; for(let i=0;i<buf.length;i+=32768) s+=String.fromCharCode.apply(null, buf.subarray(i,i+32768)); done(JSON.stringify({type, data:btoa(s)})); };
      const C=%s; const dr=(i)=>C?g.drawImage(i,C[0],C[1],C[2],C[3],0,0,W,H):g.drawImage(i,0,0,W,H); dr(imgs[0][1]); rec.start();
      const t0=performance.now(); let k=0;
      const tick=()=>{ const t=performance.now()-t0; while(k<imgs.length-1 && imgs[k+1][0]<=t) k++; dr(imgs[k][1]);
        if(t < imgs[imgs.length-1][0]+%d) requestAnimationFrame(tick); else rec.stop(); };
      requestAnimationFrame(tick);
    })""" % (W, H, int(os.environ.get("BITRATE", "900000")), os.environ.get("CROP", "null"), int(float(os.environ.get("TAIL", "0.1")) * 1000))
    r = call("Runtime.evaluate", {"expression": js, "awaitPromise": True, "returnByValue": True})
    v = json.loads(r["result"]["result"]["value"])
    open(out, "wb").write(base64.b64decode(v["data"]))
    print("saved", out, v["type"], os.path.getsize(out) // 1024, "KB")
finally:
    chrome.terminate()
