#!/usr/bin/env python3
"""Generate the social-share / Open Graph card for the GAIA web app.

Produces a 1200x630 PNG (the size link-preview crawlers expect) in the same
pure-Python, zero-dependency, pixel-art spirit as ``make_icons.py``: a chunky
8-bit Earth floating in deep space next to a pixel wordmark. No third-party deps.
"""
import zlib, struct, random

W, H = 1200, 630

# palette (matches make_icons.py / the app's CSS) --------------------------
SPACE   = (8, 8, 28)       # --void, deep-space backdrop
STAR    = (60, 60, 110)
STAR_BR = (150, 150, 210)  # a few brighter stars
OCEAN   = (58, 107, 212)
OCEAN_L = (104, 158, 240)
LAND    = (78, 191, 90)
LAND_D  = (52, 140, 64)
ICE     = (226, 240, 255)
RIM_D   = (32, 64, 150)
YELLOW  = (255, 225, 77)    # --yellow, wordmark
CYAN    = (84, 255, 255)    # --cyan, tagline

# green landmass blobs in normalised disk coords (x right, y down)
BLOBS = [
    (-0.46, -0.34, 0.34),
    (-0.56,  0.08, 0.18),
    (-0.18,  0.46, 0.30),
    ( 0.16, -0.12, 0.30),
    ( 0.48, -0.22, 0.22),
    ( 0.50,  0.46, 0.15),
]

# 5x7 pixel font (uppercase + a few glyphs) -------------------------------
FONT = {
    'A': ["01110","10001","10001","11111","10001","10001","10001"],
    'B': ["11110","10001","10001","11110","10001","10001","11110"],
    'C': ["01110","10001","10000","10000","10000","10001","01110"],
    'D': ["11110","10001","10001","10001","10001","10001","11110"],
    'E': ["11111","10000","10000","11110","10000","10000","11111"],
    'F': ["11111","10000","10000","11110","10000","10000","10000"],
    'G': ["01110","10001","10000","10111","10001","10001","01110"],
    'H': ["10001","10001","10001","11111","10001","10001","10001"],
    'I': ["11111","00100","00100","00100","00100","00100","11111"],
    'J': ["00111","00010","00010","00010","00010","10010","01100"],
    'K': ["10001","10010","10100","11000","10100","10010","10001"],
    'L': ["10000","10000","10000","10000","10000","10000","11111"],
    'M': ["10001","11011","10101","10101","10001","10001","10001"],
    'N': ["10001","11001","10101","10011","10001","10001","10001"],
    'O': ["01110","10001","10001","10001","10001","10001","01110"],
    'P': ["11110","10001","10001","11110","10000","10000","10000"],
    'Q': ["01110","10001","10001","10001","10101","10010","01101"],
    'R': ["11110","10001","10001","11110","10100","10010","10001"],
    'S': ["01111","10000","10000","01110","00001","00001","11110"],
    'T': ["11111","00100","00100","00100","00100","00100","00100"],
    'U': ["10001","10001","10001","10001","10001","10001","01110"],
    'V': ["10001","10001","10001","10001","10001","01010","00100"],
    'W': ["10001","10001","10001","10101","10101","11011","10001"],
    'X': ["10001","10001","01010","00100","01010","10001","10001"],
    'Y': ["10001","10001","01010","00100","00100","00100","00100"],
    'Z': ["11111","00001","00010","00100","01000","10000","11111"],
    ' ': ["00000","00000","00000","00000","00000","00000","00000"],
    '-': ["00000","00000","00000","11111","00000","00000","00000"],
}
FW, FH = 5, 7


def put(px, x, y, col):
    if 0 <= x < W and 0 <= y < H:
        px[y * W + x] = col


def draw_text(px, text, x0, y0, scale, col):
    """Draw chunky pixel text; returns the x position after the string."""
    x = x0
    for ch in text.upper():
        glyph = FONT.get(ch, FONT[' '])
        for ry, row in enumerate(glyph):
            for rx, bit in enumerate(row):
                if bit == '1':
                    for dy in range(scale):
                        for dx in range(scale):
                            put(px, x + rx * scale + dx, y0 + ry * scale + dy, col)
        x += (FW + 1) * scale
    return x


def text_width(text, scale):
    return len(text) * (FW + 1) * scale - scale


def draw_globe(px, cx, cy, radius):
    """Analytic pixel-art Earth, same look as the icons but higher-res."""
    for y in range(int(cy - radius) - 2, int(cy + radius) + 2):
        for x in range(int(cx - radius) - 2, int(cx + radius) + 2):
            nx = (x + 0.5 - cx) / radius
            ny = (y + 0.5 - cy) / radius
            d2 = nx * nx + ny * ny
            if d2 > 1.0:
                continue
            spec = (nx + 0.38) ** 2 + (ny + 0.38) ** 2
            col = OCEAN_L if spec < 0.10 else OCEAN
            for bx, by, br in BLOBS:
                if (nx - bx) ** 2 + (ny - by) ** 2 <= br * br:
                    col = LAND
                    break
            if ny < -0.86 or ny > 0.86:
                col = ICE
            if d2 > 0.74 and (nx + ny) > 0.25:
                col = LAND_D if col == LAND else RIM_D
            put(px, x, y, col)


def main():
    px = [SPACE] * (W * H)

    # starfield (deterministic so the build is reproducible)
    rng = random.Random(20260625)
    for _ in range(220):
        sx, sy = rng.randrange(W), rng.randrange(H)
        col = STAR_BR if rng.random() < 0.18 else STAR
        put(px, sx, sy, col)
        if col is STAR_BR:                       # a faint twinkle cross
            put(px, sx + 1, sy, col); put(px, sx - 1, sy, col)
            put(px, sx, sy + 1, col); put(px, sx, sy - 1, col)

    # globe on the left, vertically centred
    draw_globe(px, 290, H // 2, 210)

    # wordmark + tagline on the right (sized to stay inside a 60px right margin)
    tx = 560
    draw_text(px, "GAIA", tx, 210, 20, YELLOW)
    draw_text(px, "A LIVING PLANET", tx, 380, 6, CYAN)
    draw_text(px, "PIXEL-ART SIMEARTH IN BROWSER", tx, 437, 3, (154, 154, 218))

    # flatten to RGBA bytes
    out = bytearray(W * H * 4)
    for i, (r, g, b) in enumerate(px):
        j = i * 4
        out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = 255
    write_png("icons/og-image.png", out)
    print("wrote icons/og-image.png (%dx%d)" % (W, H))


def write_png(path, rgba):
    def chunk(typ, data):
        return (struct.pack(">I", len(data)) + typ + data +
                struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0)  # RGBA/8
    stride = W * 4
    raw = bytearray()
    for y in range(H):
        raw.append(0)
        raw.extend(rgba[y * stride:(y + 1) * stride])
    with open(path, "wb") as f:
        f.write(sig)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
        f.write(chunk(b"IEND", b""))


if __name__ == "__main__":
    main()
