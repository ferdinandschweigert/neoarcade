#!/usr/bin/env python3
"""Build a macOS .icns file for the arcade launcher using stdlib only."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

BASE = 512

COLORS = {
    "panel": (248, 245, 238, 255),
    "line": (16, 16, 16, 255),
    "inner": (236, 234, 228, 255),
    "blue": (30, 97, 255, 255),
    "red": (226, 71, 57, 255),
    "yellow": (244, 210, 11, 255),
    "mint": (71, 195, 162, 255),
}


def png_chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack("!I", len(data)) + tag + data + struct.pack("!I", crc)


def encode_png(size: int, pixels: bytearray) -> bytes:
    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)  # filter type 0
        row_start = y * stride
        raw.extend(pixels[row_start : row_start + stride])

    compressed = zlib.compress(bytes(raw), level=9)
    ihdr = struct.pack("!IIBBBBB", size, size, 8, 6, 0, 0, 0)

    return (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", compressed)
        + png_chunk(b"IEND", b"")
    )


def write_png(path: Path, size: int, pixels: bytearray) -> None:
    path.write_bytes(encode_png(size, pixels))


def make_canvas(size: int, color: tuple[int, int, int, int]) -> bytearray:
    return bytearray(bytes(color) * (size * size))


def scale(size: int, value: int) -> int:
    return max(1, round(value * size / BASE))


def fill_rect(
    pixels: bytearray,
    size: int,
    x: int,
    y: int,
    w: int,
    h: int,
    color: tuple[int, int, int, int],
) -> None:
    x0 = max(0, x)
    y0 = max(0, y)
    x1 = min(size, x + w)
    y1 = min(size, y + h)
    if x0 >= x1 or y0 >= y1:
        return

    fill = bytes(color) * (x1 - x0)
    stride = size * 4
    for yy in range(y0, y1):
        start = yy * stride + x0 * 4
        pixels[start : start + (x1 - x0) * 4] = fill


def stroke_rect(
    pixels: bytearray,
    size: int,
    x: int,
    y: int,
    w: int,
    h: int,
    stroke: int,
    color: tuple[int, int, int, int],
) -> None:
    fill_rect(pixels, size, x, y, w, stroke, color)
    fill_rect(pixels, size, x, y + h - stroke, w, stroke, color)
    fill_rect(pixels, size, x, y, stroke, h, color)
    fill_rect(pixels, size, x + w - stroke, y, stroke, h, color)


def fill_circle(
    pixels: bytearray,
    size: int,
    cx: int,
    cy: int,
    radius: int,
    color: tuple[int, int, int, int],
) -> None:
    stride = size * 4
    rr = radius * radius
    color_bytes = bytes(color)
    y_min = max(0, cy - radius)
    y_max = min(size - 1, cy + radius)
    x_min = max(0, cx - radius)
    x_max = min(size - 1, cx + radius)

    for y in range(y_min, y_max + 1):
        dy = y - cy
        for x in range(x_min, x_max + 1):
            dx = x - cx
            if dx * dx + dy * dy <= rr:
                idx = y * stride + x * 4
                pixels[idx : idx + 4] = color_bytes


def stroke_circle(
    pixels: bytearray,
    size: int,
    cx: int,
    cy: int,
    radius: int,
    stroke: int,
    color: tuple[int, int, int, int],
) -> None:
    stride = size * 4
    outer = radius * radius
    inner_r = max(0, radius - stroke)
    inner = inner_r * inner_r
    color_bytes = bytes(color)
    y_min = max(0, cy - radius)
    y_max = min(size - 1, cy + radius)
    x_min = max(0, cx - radius)
    x_max = min(size - 1, cx + radius)

    for y in range(y_min, y_max + 1):
        dy = y - cy
        for x in range(x_min, x_max + 1):
            dx = x - cx
            dist = dx * dx + dy * dy
            if inner <= dist <= outer:
                idx = y * stride + x * 4
                pixels[idx : idx + 4] = color_bytes


def draw_logo(size: int) -> bytearray:
    pixels = make_canvas(size, COLORS["panel"])

    outer = scale(size, 32)
    outer_size = size - 2 * outer
    outer_stroke = scale(size, 20)
    stroke_rect(
        pixels,
        size,
        outer,
        outer,
        outer_size,
        outer_size,
        outer_stroke,
        COLORS["line"],
    )

    inner = scale(size, 86)
    inner_size = size - 2 * inner
    fill_rect(pixels, size, inner, inner, inner_size, inner_size, COLORS["inner"])
    stroke_rect(
        pixels,
        size,
        inner,
        inner,
        inner_size,
        inner_size,
        scale(size, 14),
        COLORS["line"],
    )

    fill_circle(pixels, size, scale(size, 188), scale(size, 170), scale(size, 44), COLORS["blue"])
    stroke_circle(
        pixels,
        size,
        scale(size, 188),
        scale(size, 170),
        scale(size, 44),
        scale(size, 12),
        COLORS["line"],
    )

    fill_circle(pixels, size, scale(size, 324), scale(size, 170), scale(size, 44), COLORS["red"])
    stroke_circle(
        pixels,
        size,
        scale(size, 324),
        scale(size, 170),
        scale(size, 44),
        scale(size, 12),
        COLORS["line"],
    )

    fill_rect(
        pixels,
        size,
        scale(size, 172),
        scale(size, 258),
        scale(size, 168),
        scale(size, 58),
        COLORS["yellow"],
    )
    stroke_rect(
        pixels,
        size,
        scale(size, 172),
        scale(size, 258),
        scale(size, 168),
        scale(size, 58),
        scale(size, 12),
        COLORS["line"],
    )

    fill_circle(pixels, size, scale(size, 256), scale(size, 366), scale(size, 30), COLORS["mint"])
    stroke_circle(
        pixels,
        size,
        scale(size, 256),
        scale(size, 366),
        scale(size, 30),
        scale(size, 12),
        COLORS["line"],
    )

    return pixels


def build_icns(path: Path) -> None:
    icon_types = [
        ("icp4", 16),
        ("icp5", 32),
        ("icp6", 64),
        ("ic07", 128),
        ("ic08", 256),
        ("ic09", 512),
        ("ic10", 1024),
    ]

    blocks = []
    for icon_type, size in icon_types:
        png_data = encode_png(size, draw_logo(size))
        block = icon_type.encode("ascii") + struct.pack("!I", len(png_data) + 8) + png_data
        blocks.append(block)

    total_length = 8 + sum(len(block) for block in blocks)
    header = b"icns" + struct.pack("!I", total_length)
    path.write_bytes(header + b"".join(blocks))


def main() -> None:
    project_root = Path(__file__).resolve().parent.parent
    assets_dir = project_root / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    icon_512_path = assets_dir / "arcade-mark.png"
    write_png(icon_512_path, 512, draw_logo(512))

    icns_path = assets_dir / "arcade-mark.icns"
    build_icns(icns_path)

    print(f"Built {icns_path}")
    print(f"Built {icon_512_path}")


if __name__ == "__main__":
    main()
