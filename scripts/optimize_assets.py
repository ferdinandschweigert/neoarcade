#!/usr/bin/env python3
"""Downscale and recompress LCD sprite atlases for faster loads.

Keeps nearest-neighbor scaling so pixel art stays crisp on the 480px canvas.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
TARGET_SIZE = 640
ATLASES = (
    "granny-rooftop-animation-v2.png",
    "granny-rooftop-sprites-v2.png",
    "lcd-labyrinth-sprites.png",
)


def optimize_atlas(path: Path, size: int = TARGET_SIZE) -> None:
    before = path.stat().st_size
    image = Image.open(path).convert("RGBA")
    if image.size != (size, size):
        image = image.resize((size, size), Image.Resampling.NEAREST)
    image.save(path, format="PNG", optimize=True, compress_level=9)
    after = path.stat().st_size
    print(f"{path.name}: {before} -> {after} bytes ({image.size[0]}x{image.size[1]})")


def main() -> None:
    for name in ATLASES:
        path = ASSETS / name
        if not path.exists():
            print(f"skip missing {name}")
            continue
        optimize_atlas(path)


if __name__ == "__main__":
    main()
