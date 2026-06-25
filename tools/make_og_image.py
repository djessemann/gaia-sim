#!/usr/bin/env python3
"""Generate the social-share / Open Graph card for the GAIA web app.

Produces a 1200x630 PNG (the size link-preview crawlers expect) that is simply
the bookmark app-icon globe (see ``make_icons.py``) centred on the deep-space
backdrop with extra black space around it. Reuses the icon renderer verbatim so
the share card always matches the favicon. No third-party deps.
"""
import os, sys, zlib, struct

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_icons import logical_grid, upscale_rgba, SPACE  # noqa: E402

W, H = 1200, 630      # Open Graph card size
TILE = 460            # rendered globe tile; the rest of the card is black space


def write_png(path, w, h, rgba):
    def chunk(typ, data):
        return (struct.pack(">I", len(data)) + typ + data +
                struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)  # RGBA/8
    stride = w * 4
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw.extend(rgba[y * stride:(y + 1) * stride])
    with open(path, "wb") as f:
        f.write(sig)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
        f.write(chunk(b"IEND", b""))


def main():
    grid = logical_grid()
    tile = upscale_rgba(grid, TILE)              # same globe as the bookmark icon

    # fill the whole card with the icon's space backdrop, then drop the globe
    # tile in the centre so there's a wide ring of black space around it
    canvas = bytearray(bytes(SPACE) * (W * H))
    ox, oy = (W - TILE) // 2, (H - TILE) // 2
    for ty in range(TILE):
        src = ty * TILE * 4
        dst = ((oy + ty) * W + ox) * 4
        canvas[dst:dst + TILE * 4] = tile[src:src + TILE * 4]

    os.makedirs("icons", exist_ok=True)
    write_png("icons/og-image.png", W, H, bytes(canvas))
    print("wrote icons/og-image.png (%dx%d)" % (W, H))


if __name__ == "__main__":
    main()
