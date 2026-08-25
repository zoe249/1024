from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
BACKGROUND = HERE / "transition-loading-v1-background.jpg"
OUTPUT = HERE / "transition-loading-v1.jpg"
CANVAS_SIZE = (750, 1334)

FONT_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")
FONT_REGULAR = Path(r"C:\Windows\Fonts\msyh.ttc")

BROWN = (74, 48, 28)
CREAM = (255, 246, 218)
GREEN = (126, 183, 54)
TRACK = (255, 239, 199)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_BOLD if bold and FONT_BOLD.exists() else FONT_REGULAR
    return ImageFont.truetype(str(path), size=size)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    image = image.convert("RGB")
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    center_y: int,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    stroke_width: int = 0,
    stroke_fill: tuple[int, int, int] = CREAM,
) -> None:
    bounds = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    x = (CANVAS_SIZE[0] - width) / 2 - bounds[0]
    y = center_y - height / 2 - bounds[1]
    draw.text(
        (x, y),
        text,
        font=font,
        fill=fill,
        stroke_width=stroke_width,
        stroke_fill=stroke_fill,
    )


def draw_crayon_progress(canvas: Image.Image, progress: float) -> None:
    draw = ImageDraw.Draw(canvas, "RGBA")
    box = (155, 1018, 595, 1048)
    radius = 15
    draw.rounded_rectangle((158, 1023, 598, 1053), radius=radius, fill=(62, 40, 25, 80))
    draw.rounded_rectangle(box, radius=radius, fill=TRACK + (255,), outline=BROWN + (255,), width=3)

    inner = (161, 1024, 589, 1042)
    fill_width = max(18, round((inner[2] - inner[0]) * progress))
    fill_box = (inner[0], inner[1], inner[0] + fill_width, inner[3])
    draw.rounded_rectangle(fill_box, radius=9, fill=GREEN + (255,))

    # 进度条只使用短促彩铅排线，不添加顶部高光。
    rng = random.Random(1024)
    for _ in range(70):
        x = rng.randint(inner[0] + 3, max(inner[0] + 3, fill_box[2] - 8))
        y = rng.randint(inner[1] + 2, inner[3] - 2)
        length = rng.randint(3, 10)
        draw.line((x, y, min(fill_box[2] - 2, x + length), y + rng.randint(-2, 2)), fill=(73, 116, 33, 65), width=1)


def render() -> None:
    canvas = cover(Image.open(BACKGROUND), CANVAS_SIZE)
    draw = ImageDraw.Draw(canvas)

    # 文字直接落在场景里，避免重新出现与页面割裂的中央卡片。
    draw_centered_text(draw, "游戏准备中", 650, load_font(44, True), CREAM, 4, BROWN)
    draw_centered_text(draw, "正在整理棋盘与数字", 708, load_font(22), BROWN, 3, CREAM)

    progress = 0.68
    draw_crayon_progress(canvas, progress)
    draw = ImageDraw.Draw(canvas)
    draw_centered_text(draw, "68%", 985, load_font(22, True), BROWN, 2, CREAM)
    draw_centered_text(draw, "小提示：相同数字相邻后会自动合成", 1092, load_font(21), BROWN, 3, CREAM)

    canvas.save(OUTPUT, "JPEG", quality=90, optimize=True, progressive=True)
    print(OUTPUT)


if __name__ == "__main__":
    render()
