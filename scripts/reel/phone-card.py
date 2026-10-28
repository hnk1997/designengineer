"""Frame a captured phone recording (capture.py at 390 x 844, 2x) as a 16:10 Currently building card:
the phone large and centred on a dark ground with a soft glow, cut off by the card's bottom edge, with
a status bar, finger taps where the recording tapped, and a dip back to the first frame so it loops.

    python3 scripts/reel/phone-card.py <frames_dir> <out_dir> <taps.json> [--bg #10171c] [--glow #9be15d]
      taps.json: [[seconds, x, y], ...] in the page's CSS pixels (capture.py prints them)
      env: KEEP (seconds of the recording to use), DIP (seconds of the loop's dip, 0.8), K (phone scale, 1.1),
           PAN (JSON [[seconds, dy], ...]: the phone glides up by dy px to keep what's being tapped in view)
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

src, out, taps_file = sys.argv[1], sys.argv[2], sys.argv[3]
args = sys.argv[4:]
opt = lambda name, d: args[args.index(name) + 1] if name in args else d
hexrgb = lambda h: tuple(int(h.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
BG, GLOW = hexrgb(opt('--bg', '#10171c')), hexrgb(opt('--glow', '#9be15d'))
KEEP, DIP, K = float(os.environ.get('KEEP', '9')), float(os.environ.get('DIP', '0.8')), float(os.environ.get('K', '1.1'))
PAN = json.loads(os.environ.get('PAN', '[]'))
FPS, W, H = 30, 1200, 750
SS = 2                                   # supersampling for the phone's curves
os.makedirs(out, exist_ok=True)
taps = json.load(open(taps_file))

# ── the ground: page colour with a glow above the phone ──
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
d = np.sqrt(((xx - W / 2) / (W * 0.55)) ** 2 + ((yy - H * 0.28) / (H * 0.75)) ** 2)
glow = np.clip(1 - d, 0, 1) ** 1.8 * 0.3
ground = np.array(BG, np.float32)[None, None] * (1 - glow[..., None]) + np.array(GLOW, np.float32)[None, None] * glow[..., None]
vign = np.clip(1 - 0.35 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2), 0.55, 1)[..., None]
plate = Image.fromarray(np.clip(ground * vign, 0, 255).astype(np.uint8)).convert('RGBA')

# ── the phone ──
SW, SHGT = round(390 * K), round(844 * K)          # screen, on the card
BZ = round(11 * K)                                  # bezel
R_OUT, R_IN = round(58 * K), round(48 * K)
x0, Y0 = (W - SW) // 2, 46                          # screen's top-left on the card, before any pan
PH = SHGT + 2 * BZ + 200                             # the phone layer: body, shadow and room below
phone = Image.new('RGBA', (W, PH), (0, 0, 0, 0))
y0 = BZ + 20
body = (x0 - BZ, y0 - BZ, x0 + SW + BZ, y0 + SHGT + BZ)
shadow = Image.new('RGBA', (W, PH), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle((body[0] + 10, body[1] + 40, body[2] - 10, body[3] + 40), R_OUT, fill=(0, 0, 0, 170))
phone.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(38)))
big = Image.new('RGBA', (W * SS, PH * SS), (0, 0, 0, 0))
dr = ImageDraw.Draw(big)
dr.rounded_rectangle(tuple(v * SS for v in body), R_OUT * SS, fill=(30, 29, 34, 255))
dr.rounded_rectangle(tuple(v * SS for v in body), R_OUT * SS, outline=(88, 86, 96, 255), width=3 * SS)
dr.rounded_rectangle(tuple(v * SS for v in (body[0] + 3, body[1] + 3, body[2] - 3, body[3] - 3)), (R_OUT - 3) * SS, outline=(12, 12, 14, 255), width=2 * SS)
phone.alpha_composite(big.resize((W, PH), Image.LANCZOS))
LAYER_TOP = y0                                     # where the screen sits inside the phone layer
mask_big = Image.new('L', (SW * SS, SHGT * SS), 0)
ImageDraw.Draw(mask_big).rounded_rectangle((0, 0, SW * SS - 1, SHGT * SS - 1), R_IN * SS, fill=255)
mask = mask_big.resize((SW, SHGT), Image.LANCZOS)

# ── the status bar, in the page's own colour, with the island ──
STATUS = 50                                          # css px
font = ImageFont.truetype('/System/Library/Fonts/SFNS.ttf', 34) if os.path.exists('/System/Library/Fonts/SFNS.ttf') else ImageFont.load_default()
def status_strip(colour):
    st = Image.new('RGB', (780, STATUS * 2), colour)
    g = ImageDraw.Draw(st)
    g.text((96, 30), '9:41', font=font, fill=(255, 255, 255))
    for i, h in enumerate((8, 13, 18, 23)): g.rounded_rectangle((590 + i * 10, 56 - h, 596 + i * 10, 56), 2, fill=(255, 255, 255))
    g.rounded_rectangle((650, 33, 700, 57), 7, outline=(150, 150, 150), width=2); g.rounded_rectangle((654, 37, 692, 53), 4, fill=(255, 255, 255))
    g.rounded_rectangle((304, 22, 476, 74), 26, fill=(0, 0, 0))
    return st

# ── the veil at the card's foot ──
veil = Image.new('RGBA', (W, H), (0, 0, 0, 0))
va = np.zeros((H, W), np.float32); fy = np.arange(H, dtype=np.float32)
va[:] = (np.clip((fy - (H - 150)) / 150, 0, 1) ** 1.5 * 230)[:, None]
veil_arr = np.dstack([np.full((H, W), c, np.uint8) for c in BG] + [va.astype(np.uint8)])
veil = Image.fromarray(veil_arr)

files = sorted(f for f in os.listdir(src) if f.endswith('.png'))
n = min(len(files), int(KEEP * FPS))
first = Image.open(os.path.join(src, files[0])).convert('RGB')
strip = status_strip(first.getpixel((10, 10)))
def screen(im):
    canvas = Image.new('RGB', (780, 1688), im.getpixel((10, 10)))
    canvas.paste(strip, (0, 0)); canvas.paste(im.crop((0, 0, 780, 1688 - STATUS * 2)), (0, STATUS * 2))
    return canvas.resize((SW, SHGT), Image.LANCZOS)
ease = lambda u: u * u * (3 - 2 * u)
def pan(t):
    if not PAN: return 0
    if t <= PAN[0][0]: return PAN[0][1]
    for (ta, a), (tb, b) in zip(PAN, PAN[1:]):
        if t <= tb: return a + (b - a) * ease((t - ta) / (tb - ta)) if tb > ta else b
    return PAN[-1][1]
def screen_top(t): return Y0 - pan(t)
def to_card(x, y, t): return x0 + x * K, screen_top(t) + (y + STATUS) * K

def tap_layer(t):
    lay = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0)); g = ImageDraw.Draw(lay)
    for at, x, y in taps:
        cx, cy = to_card(x, y, at); u = t - at
        if -0.28 <= u < 0.5:   # lands, presses, lifts
            land = min(1, (u + 0.28) / 0.28); lift = 1 - max(0, (u - 0.2) / 0.25)
            a = max(0, min(land, lift)); r = 25 * (1.3 - 0.3 * land) * (0.86 if 0 <= u < 0.14 else 1)
            g.ellipse(((cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS), fill=(255, 255, 255, int(150 * a)))
            g.ellipse(((cx - r * .55) * SS, (cy - r * .55) * SS, (cx + r * .55) * SS, (cy + r * .55) * SS), fill=(255, 255, 255, int(110 * a)))
        if 0.1 <= u < 0.65:     # the ring as it lifts
            v = (u - 0.1) / 0.55; rr = 20 + 34 * (1 - (1 - v) ** 3)
            g.ellipse(((cx - rr) * SS, (cy - rr) * SS, (cx + rr) * SS, (cy + rr) * SS), outline=(255, 255, 255, int(200 * (1 - v))), width=2 * SS)
    return lay.resize((W, H), Image.LANCZOS)

def card(im, t, fade=1.0):
    c = plate.copy()
    top = round(screen_top(max(t, 0)))
    c.alpha_composite(phone, (0, top - LAYER_TOP))
    sc = screen(im)
    if fade < 1: sc = Image.blend(Image.new('RGB', sc.size, im.getpixel((10, 10))), sc, fade)
    c.paste(sc, (x0, top), mask)
    c.alpha_composite(tap_layer(t))
    c.alpha_composite(veil)
    return c.convert('RGB')

k = 0
dip = int(DIP * FPS)
for i in range(n):
    im = Image.open(os.path.join(src, files[i])).convert('RGB')
    fade = 1 - ease((i - (n - dip // 2)) / (dip // 2)) if i >= n - dip // 2 else 1.0
    card(im, i / FPS, fade).save(os.path.join(out, f'f{k:05d}.png')); k += 1
# back in to the first frame, so the loop opens where it began
for j in range(dip - dip // 2):
    card(first, -9, ease((j + 1) / (dip - dip // 2))).save(os.path.join(out, f'f{k:05d}.png')); k += 1
print('card frames', k, f'{k / FPS:.1f}s')
