"""The Birdwatcher reel in the laptop mockup (assets/work/birdwatcher.mp4), as an edit list.

Source: Hasan's cursor-free screen recording of thebirdwatcher.ai (3434 x 1774). To re-cut:
serve a folder holding that recording as src.mp4 plus edit.html on http://127.0.0.1:5199,
then run this with a headless-Chrome CDP helper (scratch tool cdp_gpu.py: Chrome with
--use-angle=metal) that evaluates edit(cfg) in the page and prints the JSON it returns.
edit.html renders every frame by seeking (exact speed, zoom and transitions), then plays
the frames back into MediaRecorder for an H.264 MP4.
"""
import subprocess, json, base64, os, sys, time
# The clean recording is 3434 x 1774. Every shot shows its full width (edit.html fills the
# space above and below with the frame's own edge colours); no zooms, no crops.
SW, SH = 3434, 1774
CH = SH; CW = round(CH * 967 / 628); CX = (SW - CW) // 2
def shot(a, b, speed=1.0, zoom=(1, 1.04), **kw):
    return dict(**{"from": a, "to": b}, speed=speed, zoom=list(zoom), **kw)
shots = [
  shot(0.0, 3.6, zoom=(1.08, 1)),                    # The Gull: the particle bird, pulling back
  shot(3.9, 6.2, zoom=(1, 1.05)),                    # the gull in flight
  shot(6.5, 8.8, zoom=(1, 1.06), focus=[0.35, 0.5]), # standing on its rock
  shot(9.1, 11.0, zoom=(1.04, 1)),                   # wings spread over the water
  shot(13.0, 15.8, zoom=(1, 1.06)),                  # The Wind Farm
  shot(16.9, 21.0, speed=1.4, zoom=(1, 1.05)),       # the gull flies through the turbines
  shot(24.5, 26.6, zoom=(1, 1.03), fit="width", bg="#fcf5eb"),  # Zero confirmed collisions, uncut
  shot(28.6, 30.6, zoom=(1, 1.05)),                  # The Tech
  shot(31.6, 33.2, zoom=(1, 1.08)),                  # a real turbine, at sea
  shot(36.2, 38.4, zoom=(1.05, 1)),                  # infrared turbines
  shot(38.8, 40.0, zoom=(1, 1.04)),                  # the flock, outlined
  shot(46.8, 50.8, speed=1.6, zoom=(1, 1.05)),       # The Flock
  shot(52.0, 57.6, speed=2.2, zoom=(1, 1.03)),       # species
  shot(58.3, 60.2, zoom=(1, 1.08)),                  # The Scale: the globe
]
T = lambda kind, d: dict(type=kind, dur=d)
transitions = [T("wipe", .6), T("fade", .45), T("fade", .45), T("black", .6), T("wipe", .6), T("fade", .45),
               T("black", .6), T("fade", .45), T("black", .5), T("fade", .4), T("fade", .45), T("wipe", .6), T("black", .7)]
assert len(transitions) == len(shots) - 1
cfg = dict(shots=shots, transitions=transitions, crop=[CX, 0, CW, CH], W=int(os.environ.get("OW", "960")), H=int(os.environ.get("OH", "624")),
           fps=30, bitrate=int(os.environ.get("BITRATE", "700000")), fadeIn=0.4, fadeOut=0.6)
t0 = time.time()
r = subprocess.run(["python3", "cdp_gpu.py", "http://127.0.0.1:5199/edit.html", "2", f"edit({json.dumps(cfg)})"], capture_output=True, text=True, timeout=1500)
raw = r.stdout.strip()
if not raw: sys.exit("no output: " + r.stderr[-1500:])
v = json.loads(json.loads(raw))
out = sys.argv[1]
open(out, "wb").write(base64.b64decode(v["data"]))
print(v["type"], "length", round(v["total"], 1), "s", v["frames"], "frames", os.path.getsize(out) // 1024, "KB", "took", round(time.time() - t0), "s")
