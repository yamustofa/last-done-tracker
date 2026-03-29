#!/usr/bin/env python3
"""Generate PWA PNG icons (stdlib only). Run: python3 scripts/generate_icons.py"""
import struct
import zlib
from pathlib import Path

BG = (15, 20, 25, 255)
ACCENT = (61, 156, 240, 255)


def write_rgba_png(path: Path, width: int, height: int, pixel_fn) -> None:
    def row(y: int) -> bytes:
        raw = bytearray()
        for x in range(width):
            raw.append(0)
            r, g, b, a = pixel_fn(x, y)
            raw.extend((r, g, b, a))
        return bytes(raw)

    rows = [row(y) for y in range(height)]
    raw_data = b"".join(rows)
    compressed = zlib.compress(raw_data, 9)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", compressed)
        + chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def icon_pixels(size: int):
    cx = cy = (size - 1) / 2
    r = size * 0.36

    def fn(x: int, y: int):
        dx = x - cx
        dy = y - cy
        d = (dx * dx + dy * dy) ** 0.5
        if d <= r:
            return ACCENT
        return BG

    return fn


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    icons = root / "icons"
    for size in (192, 512):
        write_rgba_png(icons / f"icon-{size}.png", size, size, icon_pixels(size))
    write_rgba_png(icons / "apple-touch-icon.png", 180, 180, icon_pixels(180))
    print("Wrote icons to", icons)


if __name__ == "__main__":
    main()
