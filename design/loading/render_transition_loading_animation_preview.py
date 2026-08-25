from __future__ import annotations

import math
import random
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
BACKGROUND = ROOT / "assets/images/World/spring-meadow-game-v1.jpg"
LEAF = ROOT / "assets/resources/Homepage/SwingV14/swing-leaf.png"
OUTPUT = Path(__file__).with_name("transition-loading-v1-preview.webp")
CONTACT_SHEET = Path(__file__).with_name("transition-loading-v1-preview-sheet.jpg")

DESIGN_SIZE = (750, 1334)
PREVIEW_SIZE = (480, 854)
FRAME_COUNT = 24
FPS = 12
LEAF_COUNT = 24

FONT_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")
FONT_REGULAR = Path(r"C:\Windows\Fonts\msyh.ttc")

PATHS = (
    ((430, 610), (110, 500), (70, -130), (-430, -560)),
    ((440, 330), (160, 230), (-130, -70), (-430, -310)),
)


@dataclass(frozen=True)
class Particle:
    path_index: int
    offset: float
    speed: float
    sway: float
    phase: float
    scale: float
    rotation: float
    angular_velocity: float
    tint: tuple[int, int, int]


def cubic(path: tuple[tuple[int, int], ...], progress: float) -> tuple[float, float]:
    inverse = 1 - progress
    weights = (
        inverse**3,
        3 * inverse * inverse * progress,
        3 * inverse * progress * progress,
        progress**3,
    )
    return (
        sum(point[0] * weight for point, weight in zip(path, weights)),
        sum(point[1] * weight for point, weight in zip(path, weights)),
    )


def tangent(path: tuple[tuple[int, int], ...], progress: float) -> tuple[float, float]:
    inverse = 1 - progress
    return (
        3 * inverse * inverse * (path[1][0] - path[0][0])
        + 6 * inverse * progress * (path[2][0] - path[1][0])
        + 3 * progress * progress * (path[3][0] - path[2][0]),
        3 * inverse * inverse * (path[1][1] - path[0][1])
        + 6 * inverse * progress * (path[2][1] - path[1][1])
        + 3 * progress * progress * (path[3][1] - path[2][1]),
    )


def to_screen(point: tuple[float, float]) -> tuple[float, float]:
    scale = PREVIEW_SIZE[0] / DESIGN_SIZE[0]
    return ((point[0] + DESIGN_SIZE[0] / 2) * scale, (DESIGN_SIZE[1] / 2 - point[1]) * scale)


def tinted_leaf(source: Image.Image, tint: tuple[int, int, int]) -> Image.Image:
    alpha = source.getchannel("A")
    rgb = ImageChops.multiply(source.convert("RGB"), Image.new("RGB", source.size, tint))
    rgb.putalpha(alpha)
    return rgb


def centered_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    stroke_width: int,
    stroke_fill: tuple[int, int, int],
) -> None:
    bounds = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    draw.text(
        ((PREVIEW_SIZE[0] - width) / 2 - bounds[0], y - height / 2 - bounds[1]),
        text,
        font=font,
        fill=fill,
        stroke_width=stroke_width,
        stroke_fill=stroke_fill,
    )


def render_frame(
    background: Image.Image,
    leaf_variants: dict[tuple[int, int, int], Image.Image],
    particles: list[Particle],
    frame_index: int,
) -> Image.Image:
    frame = background.copy().convert("RGBA")
    draw = ImageDraw.Draw(frame, "RGBA")
    time_seconds = frame_index / FPS

    # 用同一组贝塞尔路径绘制淡风痕，实际 Cocos 版本由 Graphics 一次性生成。
    for path_index, path in enumerate(PATHS):
        for offset in ((-28, 0, 24) if path_index == 0 else (-14, 14)):
            points = []
            for step in range(31):
                x, y = cubic(path, step / 30)
                points.append(to_screen((x, y + offset)))
            draw.line(points, fill=(255, 249, 217, 55), width=1)

    for particle in particles:
        progress = (particle.offset + time_seconds * particle.speed) % 1
        path = PATHS[particle.path_index]
        x, y = cubic(path, progress)
        tx, ty = tangent(path, progress)
        length = max(0.001, math.hypot(tx, ty))
        wave = math.sin(progress * math.pi * 5 + particle.phase) * particle.sway
        x += -ty / length * wave
        y += tx / length * wave
        screen_x, screen_y = to_screen((x, y))

        pulse = 1 + math.sin(progress * math.pi * 4 + particle.phase) * 0.08
        scale = particle.scale * pulse * PREVIEW_SIZE[0] / DESIGN_SIZE[0]
        source = leaf_variants[particle.tint]
        size = (max(8, round(source.width * scale)), max(8, round(source.height * scale)))
        leaf = source.resize(size, Image.Resampling.LANCZOS)
        angle = particle.rotation + time_seconds * particle.angular_velocity
        leaf = leaf.rotate(-angle, resample=Image.Resampling.BICUBIC, expand=True)
        edge_fade = min(1, progress * 10, (1 - progress) * 10)
        leaf.putalpha(leaf.getchannel("A").point(lambda value: round(value * edge_fade)))
        frame.alpha_composite(leaf, (round(screen_x - leaf.width / 2), round(screen_y - leaf.height / 2)))

    scale = PREVIEW_SIZE[0] / DESIGN_SIZE[0]
    draw = ImageDraw.Draw(frame, "RGBA")
    bold = ImageFont.truetype(str(FONT_BOLD), round(44 * scale))
    regular = ImageFont.truetype(str(FONT_REGULAR), round(22 * scale))
    tip_font = ImageFont.truetype(str(FONT_REGULAR), round(21 * scale))
    centered_text(draw, "游戏准备中", round(650 * scale), bold, (255, 246, 218), 3, (74, 48, 28))
    centered_text(draw, "正在整理棋盘与数字", round(708 * scale), regular, (74, 48, 28), 2, (255, 246, 218))

    progress = min(1, 0.08 + frame_index / (FRAME_COUNT - 1) * 0.92)
    centered_text(draw, f"{round(progress * 100)}%", round(985 * scale), regular, (74, 48, 28), 1, (255, 246, 218))
    box = tuple(round(value * scale) for value in (155, 1018, 595, 1048))
    draw.rounded_rectangle(box, radius=round(15 * scale), fill=(255, 239, 199, 255), outline=(74, 48, 28, 255), width=2)
    inner = tuple(round(value * scale) for value in (161, 1024, 589, 1042))
    fill_width = max(10, round((inner[2] - inner[0]) * progress))
    draw.rounded_rectangle((inner[0], inner[1], inner[0] + fill_width, inner[3]), radius=round(9 * scale), fill=(126, 183, 54, 255))
    centered_text(draw, "小提示：相同数字相邻后会自动合成", round(1092 * scale), tip_font, (74, 48, 28), 2, (255, 246, 218))
    return frame.convert("RGB")


def render() -> None:
    background = Image.open(BACKGROUND).convert("RGB").resize(PREVIEW_SIZE, Image.Resampling.LANCZOS)
    source_leaf = Image.open(LEAF).convert("RGBA")
    tints = ((255, 255, 255), (226, 255, 190), (255, 242, 160), (208, 238, 154))
    variants = {tint: tinted_leaf(source_leaf, tint) for tint in tints}

    rng = random.Random(1024)
    particles = []
    for index in range(LEAF_COUNT):
        particles.append(
            Particle(
                path_index=index % len(PATHS),
                offset=(index / LEAF_COUNT + rng.random() * 0.08) % 1,
                speed=0.13 + rng.random() * 0.09,
                sway=8 + rng.random() * 20,
                phase=rng.random() * math.pi * 2,
                scale=0.5 + rng.random() * 0.72,
                rotation=rng.random() * 360,
                angular_velocity=(1 if rng.random() > 0.5 else -1) * (70 + rng.random() * 150),
                tint=tints[index % len(tints)],
            )
        )

    frames = [render_frame(background, variants, particles, index) for index in range(FRAME_COUNT)]
    frames[0].save(
        OUTPUT,
        "WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=round(1000 / FPS),
        loop=0,
        quality=72,
        method=4,
    )

    thumbs = [frames[index].resize((240, 427), Image.Resampling.LANCZOS) for index in (0, 4, 8, 12, 16, 23)]
    sheet = Image.new("RGB", (720, 854), (255, 255, 255))
    for index, thumb in enumerate(thumbs):
        sheet.paste(thumb, ((index % 3) * 240, (index // 3) * 427))
    sheet.save(CONTACT_SHEET, "JPEG", quality=86, optimize=True, progressive=True)
    print(OUTPUT)
    print(CONTACT_SHEET)


if __name__ == "__main__":
    render()
