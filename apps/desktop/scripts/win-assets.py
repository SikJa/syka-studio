#!/usr/bin/env python3
# Regenerates the Windows-only assets:
#
#   python3 scripts/win-assets.py ico       -> assets/icon.ico
#   python3 scripts/win-assets.py spinner   -> assets/install-spinner.gif
#   python3 scripts/win-assets.py           -> both
#
# Source is assets/icon-win.png (1024x1024). Unlike the macOS icon it fills
# the canvas with no margin and no drop shadow, which is what Windows expects.
#
# Needs Pillow (pip install pillow) and, for the spinner, Geist Medium; set
# WIN_ASSETS_FONT to its path if it is not in ~/Library/Fonts.
#
# icon.ico carries every size Windows asks for at 100-200% scaling. 40px and
# up are Lanczos downscales of the source; 32px and below are drawn from
# scratch (flat red rounded square, white hexagon ring) because a downscaled
# glossy icon turns to mush at taskbar size. All entries are 32-bit BGRA with
# an alpha channel; the 256px one is PNG-compressed as Vista+ allows.
#
# install-spinner.gif is Squirrel's whole install UI: shown 1:1 in a
# borderless window until the app launches. White background, icon,
# one label, one indeterminate bar in the app's primary blue.

import io
import math
import os
import struct
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ASSETS = os.path.join(ROOT, 'assets')
SOURCE = os.path.join(ASSETS, 'icon-win.png')

RED = (255, 25, 52)
BLUE = (0, 140, 255)  # --primary in apps/web/src/index.css, hsla(207, 100%, 50%)
WHITE = (255, 255, 255)
BACKGROUND = (255, 255, 255)
TEXT = (22, 22, 24)
TRACK = (224, 224, 224)


def source():
    im = Image.open(SOURCE).convert('RGBA')
    if im.size != (1024, 1024):
        sys.exit(f'{SOURCE} must be 1024x1024, got {im.size}')
    return im


# --- icon.ico ---------------------------------------------------------------

ICO_SIZES = [256, 128, 96, 64, 48, 40, 32, 24, 20, 16]


def drawn_frame(size):
    ss = 16
    w = size * ss
    im = Image.new('RGBA', (w, w), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, w - 1), radius=0.22 * size * ss, fill=RED + (255,))
    stroke = max(2, round(0.10 * size * 2) / 2) * ss
    radius = (0.38 * size - stroke / ss / 2) * ss
    c = w / 2
    pts = [
        (c + radius * math.sin(math.radians(60 * i)), c - radius * math.cos(math.radians(60 * i)))
        for i in range(6)
    ]
    d.line(pts + [pts[0], pts[1]], fill=WHITE + (255,), width=int(stroke), joint='curve')
    for x, y in pts:
        d.ellipse((x - stroke / 2, y - stroke / 2, x + stroke / 2, y + stroke / 2), fill=WHITE + (255,))
    return im.resize((size, size), Image.LANCZOS)


def scaled_frame(src, size):
    im = src.resize((size, size), Image.LANCZOS)
    if size <= 128:
        im = im.filter(ImageFilter.UnsharpMask(radius=0.6, percent=50, threshold=0))
    return im


def dib(im):
    w, h = im.size
    px = im.load()
    rows = b''.join(
        bytes(b for x in range(w) for b in (px[x, y][2], px[x, y][1], px[x, y][0], px[x, y][3]))
        for y in range(h - 1, -1, -1)
    )
    stride = ((w + 31) // 32) * 4
    mask = bytes(stride * h)  # AND mask all-visible; alpha carries transparency
    header = struct.pack('<IiiHHIIiiII', 40, w, h * 2, 1, 32, 0, len(rows) + len(mask), 2835, 2835, 0, 0)
    return header + rows + mask


def make_ico():
    src = source()
    blobs = []
    for size in ICO_SIZES:
        frame = drawn_frame(size) if size <= 32 else scaled_frame(src, size)
        if size == 256:
            buf = io.BytesIO()
            frame.save(buf, 'PNG', optimize=True)
            blobs.append(buf.getvalue())
        else:
            blobs.append(dib(frame))
    out = struct.pack('<HHH', 0, 1, len(ICO_SIZES))
    offset = 6 + 16 * len(ICO_SIZES)
    entries = b''
    for size, blob in zip(ICO_SIZES, blobs):
        entries += struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
    path = os.path.join(ASSETS, 'icon.ico')
    with open(path, 'wb') as f:
        f.write(out + entries + b''.join(blobs))
    print(f'wrote {os.path.relpath(path, ROOT)}')


# --- install-spinner.gif ----------------------------------------------------

W, H = 440, 280
FPS, SECONDS = 20, 2.4
LABEL = 'Installing Diffusion Studio'


def font():
    path = os.environ.get('WIN_ASSETS_FONT') or os.path.expanduser('~/Library/Fonts/Geist-Medium.ttf')
    if not os.path.exists(path):
        sys.exit(f'Geist Medium not found at {path}; set WIN_ASSETS_FONT')
    return ImageFont.truetype(path, 15)


def make_spinner():
    icon = source().resize((88, 88), Image.LANCZOS)
    label_font = font()
    n = int(FPS * SECONDS)
    track_w, track_h, bar_w = 200, 4, 70
    tx, ty = (W - track_w) // 2, 214
    frames = []
    for i in range(n):
        im = Image.new('RGB', (W, H), BACKGROUND)
        d = ImageDraw.Draw(im)
        im.paste(icon, ((W - 88) // 2, 58), icon)
        tw = d.textlength(LABEL, font=label_font)
        d.text((round((W - tw) / 2), 166), LABEL, font=label_font, fill=TEXT)
        d.rounded_rectangle((tx, ty, tx + track_w, ty + track_h), radius=2, fill=TRACK)
        p = 0.5 - 0.5 * math.cos(math.pi * i / n)  # ease in-out, one sweep per loop
        x0 = tx - bar_w + p * (track_w + bar_w)
        a, b = max(tx, x0), min(tx + track_w, x0 + bar_w)
        if b - a >= 6:
            d.rounded_rectangle((a, ty, b, ty + track_h), radius=2, fill=BLUE)
        frames.append(im)
    # One shared palette so nothing flickers between frames, taken from a
    # mid-loop frame where the bar is fully on the track so its colour is kept.
    palette = frames[n // 2].quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    quantized = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
    # Median cut averages the background with the icon's antialiased fringe;
    # pin the slot every background pixel landed in to the exact colour.
    for q in quantized:
        entries = list(q.getpalette())
        slot = q.getpixel((0, 0))
        entries[slot * 3:slot * 3 + 3] = BACKGROUND
        q.putpalette(entries)
    path = os.path.join(ASSETS, 'install-spinner.gif')
    quantized[0].save(
        path,
        save_all=True,
        append_images=quantized[1:],
        duration=int(1000 / FPS),
        loop=0,
        optimize=False,
    )
    print(f'wrote {os.path.relpath(path, ROOT)}')


if __name__ == '__main__':
    what = sys.argv[1:] or ['ico', 'spinner']
    for target in what:
        {'ico': make_ico, 'spinner': make_spinner}[target]()
