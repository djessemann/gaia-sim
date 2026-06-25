#!/usr/bin/env python3
"""Generate an 8-bit pixel-art Earth icon set for the GAIA web app.

Renders a 16x16 logical globe (flat retro palette, ice caps, a specular
highlight and a shaded rim) and upscales it with nearest-neighbour so the
chunky pixels stay crisp at every output size. No third-party deps.
"""
import zlib, struct, math

G = 16            # logical grid (the "8-bit" resolution)
R = 6.2           # globe radius in grid units (leaves a ring of space around it)
CX = CY = 8.0     # globe centre

# palette ---------------------------------------------------------------
SPACE   = (11, 16, 38, 255)     # deep-space navy backdrop
STAR    = (60, 60, 110, 255)    # faint star
OCEAN   = (58, 107, 212, 255)
OCEAN_L = (104, 158, 240, 255)  # sunlit ocean / specular
LAND    = (78, 191, 90, 255)
LAND_D  = (52, 140, 64, 255)    # shaded land on the rim
ICE     = (226, 240, 255, 255)
RIM_D   = (32, 64, 150, 255)    # dark ocean rim for depth

# green landmass blobs in normalised disk coords (x right, y down)
BLOBS = [
    (-0.46, -0.34, 0.34),   # north-west continent
    (-0.56,  0.08, 0.18),
    (-0.18,  0.46, 0.30),   # southern continent
    ( 0.16, -0.12, 0.30),   # central landmass
    ( 0.48, -0.22, 0.22),   # eastern landmass
    ( 0.50,  0.46, 0.15),   # south-east island
]
# a few background stars (grid coords)
STARS = [(1, 2), (2, 13), (13, 3), (14, 11), (4, 0), (15, 6)]


def logical_grid():
    grid = [[SPACE] * G for _ in range(G)]
    for gx, gy in STARS:
        grid[gy][gx] = STAR
    for y in range(G):
        for x in range(G):
            nx = (x + 0.5 - CX) / R
            ny = (y + 0.5 - CY) / R
            d2 = nx * nx + ny * ny
            if d2 > 1.0:
                continue                      # outside the globe
            # base ocean, lighter on the sunlit (upper-left) side
            spec = (nx + 0.38) ** 2 + (ny + 0.38) ** 2
            col = OCEAN_L if spec < 0.10 else OCEAN
            # land?
            for bx, by, br in BLOBS:
                if (nx - bx) ** 2 + (ny - by) ** 2 <= br * br:
                    col = LAND
                    break
            # ice caps (small, near the poles)
            if ny < -0.86 or ny > 0.86:
                col = ICE
            # shaded rim on the lower-right for a 3D feel
            if d2 > 0.74 and (nx + ny) > 0.25:
                col = LAND_D if col in (LAND,) else RIM_D
            grid[y][x] = col
    return grid


def upscale_rgba(grid, size):
    out = bytearray(size * size * 4)
    i = 0
    for oy in range(size):
        gy = oy * G // size
        row = grid[gy]
        for ox in range(size):
            gx = ox * G // size
            r, g, b, a = row[gx]
            out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = a
            i += 4
    return bytes(out)


def write_png(path, size, rgba):
    def chunk(typ, data):
        return (struct.pack(">I", len(data)) + typ + data +
                struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # RGBA/8
    stride = size * 4
    raw = bytearray()
    for y in range(size):
        raw.append(0)                         # no per-line filter
        raw.extend(rgba[y * stride:(y + 1) * stride])
    idat = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as f:
        f.write(sig)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", idat))
        f.write(chunk(b"IEND", b""))


def main():
    grid = logical_grid()
    targets = {
        "icons/icon-512.png": 512,
        "icons/icon-192.png": 192,
        "icons/apple-touch-icon.png": 180,
        "icons/favicon-32.png": 32,
        "icons/favicon-16.png": 16,
    }
    import os
    os.makedirs("icons", exist_ok=True)
    for path, size in targets.items():
        write_png(path, size, upscale_rgba(grid, size))
        print("wrote", path, f"({size}x{size})")


if __name__ == "__main__":
    main()
