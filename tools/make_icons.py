#!/usr/bin/env python3
"""Draws the app icon (3x3 tile grid, bottom row solved) as PNGs. No dependencies."""
import struct, zlib, math
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "icons"
BG = (18, 20, 23)
TEAL, AMBER, SLATE = (42, 157, 143), (233, 162, 59), (74, 80, 90)
GRID = [
    [SLATE, AMBER, SLATE],
    [TEAL, SLATE, AMBER],
    [TEAL, TEAL, TEAL],
]

def rounded_rect_cov(px, py, x0, y0, x1, y1, r):
    # Signed distance to a rounded rectangle -> anti-aliased coverage.
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    hx, hy = (x1 - x0) / 2 - r, (y1 - y0) / 2 - r
    dx, dy = abs(px - cx) - hx, abs(py - cy) - hy
    outside = math.hypot(max(dx, 0), max(dy, 0)) + min(max(dx, dy), 0) - r
    return min(1.0, max(0.0, 0.5 - outside))

def draw(size):
    margin = size * 0.17
    gap = size * 0.045
    cell = (size - 2 * margin - 2 * gap) / 3
    radius = cell * 0.18
    rows = []
    for y in range(size):
        row = bytearray([0])
        py = y + 0.5
        for x in range(size):
            px = x + 0.5
            col = BG
            gx = int((px - margin) // (cell + gap)) if px >= margin else -1
            gy = int((py - margin) // (cell + gap)) if py >= margin else -1
            if 0 <= gx < 3 and 0 <= gy < 3:
                x0 = margin + gx * (cell + gap)
                y0 = margin + gy * (cell + gap)
                a = rounded_rect_cov(px, py, x0, y0, x0 + cell, y0 + cell, radius)
                if a > 0:
                    c = GRID[gy][gx]
                    col = tuple(round(BG[i] * (1 - a) + c[i] * a) for i in range(3))
            row += bytes(col)
        rows.append(bytes(row))
    raw = b"".join(rows)
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))

for name, size in [("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)]:
    (OUT / name).write_bytes(draw(size))
    print("wrote", name)
