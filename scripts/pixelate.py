#!/usr/bin/env python3
"""Converts the painted source art in ``art/`` into the pixel art served from ``public/``.

Every source image is shrunk onto a small pixel grid, reduced to a limited
palette and written back enlarged with hard pixel edges, so the browser can
scale it smoothly without blurring the pixels.

Usage::

    python3 scripts/pixelate.py            # convert everything
    python3 scripts/pixelate.py sprites/   # only sources whose path contains "sprites/"

Requires Pillow and NumPy. To change the look of a group of images, edit ``JOBS``.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / 'art'
OUTPUT_DIR = ROOT / 'public'

INK_LIGHTNESS = 0.36
ALPHA_CUTOFF = 0.5
VISIBLE_ALPHA = 24
SHARPEN = 0.6
SATURATION = 1.1


@dataclass(frozen=True)
class Job:
    """How one group of source images is converted.

    ``grid`` is the length of the longer side in art pixels and ``scale`` the
    factor each art pixel is enlarged by in the written file. ``layout`` is
    ``square`` (trim to the content, centre it on a square canvas), ``trim``
    (trim only) or ``keep`` (keep the source framing).
    """

    pattern: str
    grid: int
    colors: int
    scale: int = 8
    layout: str = 'square'


JOBS = [
    Job('sprites/*.png', grid=48, colors=24),
    Job('sprites/heads/*.png', grid=32, colors=20, layout='keep'),
    Job('sprites/spells/*.png', grid=32, colors=16),
    Job('sprites/ui/turn-arrows.png', grid=24, colors=6, layout='trim'),
    Job('sprites/ui/*.png', grid=24, colors=12),
    Job('logo.png', grid=64, colors=20),
    Job('icon-512.png', grid=64, colors=20, layout='keep'),
    Job('icon-maskable-512.png', grid=64, colors=20, layout='keep'),
    Job('icon-192.png', grid=48, colors=20, scale=4, layout='keep'),
    Job('apple-touch-icon.png', grid=60, colors=20, scale=3, layout='keep'),
    Job('mstile-150x150.png', grid=50, colors=20, scale=3, layout='keep'),
    Job('favicon-32x32.png', grid=32, colors=16, scale=1, layout='keep'),
    Job('favicon-16x16.png', grid=16, colors=12, scale=1, layout='keep'),
]

FAVICON_SIZES = ['favicon-16x16.png', 'favicon-32x32.png']


def to_oklab(rgb: np.ndarray) -> np.ndarray:
    """Converts sRGB values in 0..1 to OKLab, where distances match perceived colour difference."""
    linear = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    lms = linear @ np.array([
        [0.4122214708, 0.2119034982, 0.0883024619],
        [0.5363325363, 0.6806995451, 0.2817188376],
        [0.0514459929, 0.1073969566, 0.6299787005],
    ])

    return np.cbrt(lms) @ np.array([
        [0.2104542553, 1.9779984951, 0.0259040371],
        [0.7936177850, -2.4285922050, 0.7827717662],
        [-0.0040720468, 0.4505937099, -0.8086757660],
    ])


def cluster(points: np.ndarray, count: int, rounds: int = 24) -> np.ndarray:
    """Groups points into at most ``count`` clusters with seeded k-means and returns each point's cluster."""
    rng = np.random.default_rng(7)
    count = min(count, len(np.unique(points.round(3), axis=0)))
    centres = points[rng.choice(len(points), 1)]
    distance = ((points - centres[0]) ** 2).sum(1)

    for _ in range(count - 1):
        centres = np.vstack([centres, points[rng.choice(len(points), 1, p=distance / distance.sum())]])
        distance = np.minimum(distance, ((points - centres[-1]) ** 2).sum(1))

    for _ in range(rounds):
        labels = ((points[:, None] - centres[None]) ** 2).sum(2).argmin(1)
        for index in range(len(centres)):
            members = points[labels == index]
            if len(members):
                centres[index] = members.mean(0)

    return ((points[:, None] - centres[None]) ** 2).sum(2).argmin(1)


def shrink(source: Image.Image, size: tuple[int, int]) -> tuple[np.ndarray, np.ndarray]:
    """Area-averages the image down to ``size`` and returns its colours and coverage, both in 0..1."""
    small = np.asarray(source.convert('RGBa').resize(size, Image.BOX).convert('RGBA'), float) / 255

    return small[..., :3], small[..., 3]


def keep_linework(source: Image.Image, size: tuple[int, int], rgb: np.ndarray, share: float = 0.34) -> np.ndarray:
    """Restores dark outlines that averaging would wash out.

    A grid cell whose source area is at least ``share`` dark ink takes the
    colour of that ink instead of the average of the whole cell.
    """
    full = np.asarray(source, float) / 255
    ink = (to_oklab(full[..., :3])[..., 0] < INK_LIGHTNESS) & (full[..., 3] > 0.5)
    ink_only = Image.fromarray((full[..., :3] * ink[..., None] * 255).astype(np.uint8))
    coverage = np.asarray(Image.fromarray(ink.astype(np.uint8) * 255).resize(size, Image.BOX), float) / 255
    ink_colour = np.asarray(ink_only.resize(size, Image.BOX), float) / 255 / np.maximum(coverage, 1e-6)[..., None]

    return np.where((coverage >= share)[..., None], ink_colour, rgb)


def punch_up(rgb: np.ndarray) -> np.ndarray:
    """Sharpens and slightly saturates the shrunken image so small details survive the palette reduction."""
    image = Image.fromarray((rgb * 255).astype(np.uint8))
    blurred = np.asarray(image.filter(ImageFilter.GaussianBlur(1)), float) / 255
    sharpened = np.clip(rgb + SHARPEN * (rgb - blurred), 0, 1)
    grey = sharpened.mean(2, keepdims=True)

    return np.clip(grey + (sharpened - grey) * SATURATION, 0, 1)


def pixelate(image: Image.Image, job: Job) -> Image.Image:
    """Returns the pixel-art version of ``image`` as described by ``job``."""
    source = image.convert('RGBA')
    if job.layout != 'keep':
        source = source.crop(source.getchannel('A').point(lambda alpha: 255 if alpha > VISIBLE_ALPHA else 0).getbbox())

    ratio = job.grid / max(source.size)
    size = (max(1, round(source.width * ratio)), max(1, round(source.height * ratio)))

    rgb, alpha = shrink(source, size)
    solid = alpha >= ALPHA_CUTOFF
    rgb = keep_linework(source, size, punch_up(rgb))

    colours = rgb[solid]
    labels = cluster(to_oklab(colours), job.colors)
    palette = np.array([colours[labels == index].mean(0) for index in range(labels.max() + 1)])

    pixels = np.zeros((size[1], size[0], 4))
    pixels[solid, :3] = palette[labels]
    pixels[solid, 3] = 1
    result = Image.fromarray((pixels * 255).round().astype(np.uint8), 'RGBA')

    if job.layout == 'square':
        canvas = Image.new('RGBA', (job.grid, job.grid), (0, 0, 0, 0))
        canvas.paste(result, ((job.grid - result.width) // 2, (job.grid - result.height) // 2))
        result = canvas

    return result.resize((result.width * job.scale, result.height * job.scale), Image.NEAREST)


def find_sources(filters: list[str]) -> list[tuple[Path, Job]]:
    """Pairs every source image with the first job whose pattern matches it."""
    claimed: dict[Path, Job] = {}
    for job in JOBS:
        for path in sorted(SOURCE_DIR.glob(job.pattern)):
            claimed.setdefault(path, job)

    return [
        (path, job) for path, job in claimed.items()
        if not filters or any(text in path.relative_to(SOURCE_DIR).as_posix() for text in filters)
    ]


def write_favicon() -> None:
    """Bundles the converted favicon PNGs into ``favicon.ico``."""
    icons = [Image.open(OUTPUT_DIR / name).convert('RGBA') for name in FAVICON_SIZES]
    icons[-1].save(
        OUTPUT_DIR / 'favicon.ico',
        sizes=[icon.size for icon in icons],
        append_images=icons[:-1]
    )


def main() -> None:
    sources = find_sources(sys.argv[1:])
    if not sources:
        sys.exit(f'No source images match {sys.argv[1:]} in {SOURCE_DIR}')

    for path, job in sources:
        target = OUTPUT_DIR / path.relative_to(SOURCE_DIR)
        target.parent.mkdir(parents=True, exist_ok=True)
        result = pixelate(Image.open(path), job)
        result.save(target, optimize=True)
        print(f'{path.relative_to(SOURCE_DIR)} -> {result.width // job.scale}x{result.height // job.scale} art px, {result.width}x{result.height} file')

    if all((OUTPUT_DIR / name).exists() for name in FAVICON_SIZES):
        write_favicon()


if __name__ == '__main__':
    main()
