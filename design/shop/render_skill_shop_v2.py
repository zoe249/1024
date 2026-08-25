from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path(__file__).with_name("skill-shop-popup-v2.png")
CANVAS_SIZE = (750, 1334)

BACKGROUND = ROOT / "design/homepage/homepage-design-v14-tree-branch-swing-static.png"
PANEL = ROOT / "assets/resources/Settings/panel-background.png"
CLOSE = ROOT / "assets/resources/Settings/button-close.png"
COIN = ROOT / "assets/resources/Settlement/reward-coin.png"
# 项目内两款字体不包含完整中文字形；设计稿使用 Creator 可替换的中文粗体占位。
FONT = Path(r"C:\Windows\Fonts\msyhbd.ttc")
FALLBACK_FONT = Path(r"C:\Windows\Fonts\simhei.ttf")

BROWN = (78, 48, 28, 255)
CREAM = (255, 246, 222, 255)
CORAL = (242, 111, 80, 255)
CORAL_LIGHT = (255, 140, 102, 255)
GREEN = (132, 190, 57, 255)
GREEN_LIGHT = (166, 211, 78, 255)
TEXT = (76, 48, 31, 255)
MUTED_TEXT = (127, 86, 55, 255)


def load_font(size: int) -> ImageFont.FreeTypeFont:
    path = FONT if FONT.exists() else FALLBACK_FONT
    return ImageFont.truetype(str(path), size=size)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    image = image.convert("RGBA")
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    image = image.convert("RGBA")
    image.thumbnail(size, Image.Resampling.LANCZOS)
    result = Image.new("RGBA", size, (0, 0, 0, 0))
    result.alpha_composite(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    return result


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def texture_fill(size: tuple[int, int], base: tuple[int, int, int, int], seed: int, radius: int) -> Image.Image:
    layer = Image.new("RGBA", size, base)
    strokes = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(strokes)
    rng = random.Random(seed)
    for _ in range(max(80, size[0] * size[1] // 850)):
        x = rng.randint(0, size[0])
        y = rng.randint(0, size[1])
        length = rng.randint(3, 13)
        shade = rng.choice(((255, 255, 255, 14), (80, 47, 28, 10)))
        draw.line((x, y, x + length, y + rng.randint(-2, 2)), fill=shade, width=1)
    layer.alpha_composite(strokes)
    layer.putalpha(rounded_mask(size, radius))
    return layer


def paste_round_rect(
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    fill: tuple[int, int, int, int],
    radius: int,
    seed: int,
    outline: tuple[int, int, int, int] = BROWN,
    outline_width: int = 3,
    shadow: bool = True,
) -> None:
    x1, y1, x2, y2 = box
    draw = ImageDraw.Draw(canvas)
    if shadow:
        draw.rounded_rectangle((x1 + 2, y1 + 5, x2 + 2, y2 + 5), radius=radius, fill=(52, 35, 23, 72))
    draw.rounded_rectangle(box, radius=radius, fill=outline)
    inner = (x1 + outline_width, y1 + outline_width, x2 - outline_width, y2 - outline_width)
    texture = texture_fill((inner[2] - inner[0], inner[3] - inner[1]), fill, seed, max(1, radius - outline_width))
    canvas.alpha_composite(texture, (inner[0], inner[1]))


def draw_centered_text(
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    stroke_width: int = 0,
    stroke_fill: tuple[int, int, int, int] = BROWN,
) -> None:
    draw = ImageDraw.Draw(canvas)
    bounds = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    x = box[0] + (box[2] - box[0] - width) / 2
    y = box[1] + (box[3] - box[1] - height) / 2 - bounds[1]
    draw.text((x, y), text, font=font, fill=fill, stroke_width=stroke_width, stroke_fill=stroke_fill)


def draw_left_text(canvas: Image.Image, position: tuple[int, int], text: str, size: int, fill=TEXT) -> None:
    ImageDraw.Draw(canvas).text(position, text, font=load_font(size), fill=fill)


def draw_coin_price(canvas: Image.Image, box: tuple[int, int, int, int], amount: int, seed: int) -> None:
    paste_round_rect(canvas, box, CREAM, 21, seed, outline_width=3, shadow=False)
    coin = contain(Image.open(COIN), (34, 34))
    canvas.alpha_composite(coin, (box[0] + 10, box[1] + 8))
    draw_centered_text(canvas, (box[0] + 42, box[1], box[2] - 2, box[3]), str(amount), load_font(25), TEXT)


def draw_buy_button(canvas: Image.Image, box: tuple[int, int, int, int], seed: int) -> None:
    paste_round_rect(canvas, box, GREEN, 18, seed, outline_width=4)
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((box[0] + 8, box[1] + 7, box[2] - 8, box[1] + 18), radius=6, fill=GREEN_LIGHT[:3] + (75,))
    draw_centered_text(canvas, box, "购买", load_font(25), (255, 253, 232, 255), 2, BROWN)


def draw_product_card(
    canvas: Image.Image,
    y: int,
    name: str,
    description: str,
    owned: int,
    price: int,
    icon_path: Path,
    icon_color: tuple[int, int, int, int],
    seed: int,
) -> None:
    row = (86, y, 664, y + 180)
    paste_round_rect(canvas, row, (255, 249, 230, 255), 22, seed, outline_width=3)

    icon_box = (102, y + 14, 246, y + 166)
    paste_round_rect(canvas, icon_box, icon_color, 18, seed + 1, outline_width=3, shadow=False)
    icon = contain(Image.open(icon_path), (112, 112))
    canvas.alpha_composite(icon, (118, y + 32))

    draw_left_text(canvas, (270, y + 24), name, 31)
    draw_left_text(canvas, (270, y + 66), description, 19, MUTED_TEXT)

    owned_box = (268, y + 112, 390, y + 151)
    paste_round_rect(canvas, owned_box, (255, 239, 203, 255), 18, seed + 2, outline_width=2, shadow=False)
    draw_centered_text(canvas, owned_box, f"持有 {owned}/9", load_font(17), TEXT)

    draw_coin_price(canvas, (492, y + 25, 638, y + 75), price, seed + 3)
    draw_buy_button(canvas, (492, y + 99, 638, y + 157), seed + 4)


def render() -> None:
    canvas = cover(Image.open(BACKGROUND), CANVAS_SIZE)
    canvas.alpha_composite(Image.new("RGBA", CANVAS_SIZE, (7, 47, 52, 164)))

    panel = Image.open(PANEL).convert("RGBA").resize((650, 922), Image.Resampling.LANCZOS)
    canvas.alpha_composite(panel, (50, 214))

    # 标题牌使用项目色板确定性绘制，避免生成式字体和无法复用的装饰。
    paste_round_rect(canvas, (215, 174, 535, 276), CORAL, 28, 11, outline_width=5)
    ImageDraw.Draw(canvas).rounded_rectangle((230, 184, 520, 203), radius=8, fill=CORAL_LIGHT[:3] + (95,))
    draw_centered_text(canvas, (215, 174, 535, 276), "技能商店", load_font(43), (255, 253, 236, 255), 3, BROWN)

    close = contain(Image.open(CLOSE), (62, 62))
    canvas.alpha_composite(close, (614, 248))

    balance_box = (265, 298, 485, 360)
    paste_round_rect(canvas, balance_box, CREAM, 25, 21, outline_width=3)
    coin = contain(Image.open(COIN), (40, 40))
    canvas.alpha_composite(coin, (289, 309))
    draw_centered_text(canvas, (337, 298, 470, 360), "1280", load_font(27), TEXT)

    draw_product_card(
        canvas,
        390,
        "炸弹",
        "清除周围棋子",
        7,
        500,
        ROOT / "assets/images/Skills/Bomb.png",
        (139, 92, 181, 255),
        31,
    )
    draw_product_card(
        canvas,
        584,
        "木槌",
        "敲碎指定棋子",
        5,
        300,
        ROOT / "assets/images/Skills/Hammer.png",
        (75, 157, 207, 255),
        41,
    )
    draw_product_card(
        canvas,
        778,
        "交换",
        "交换相邻棋子",
        7,
        400,
        ROOT / "assets/images/Skills/SwapIcon.png",
        (246, 183, 53, 255),
        51,
    )

    draw = ImageDraw.Draw(canvas)
    draw.line((170, 1023, 240, 1023), fill=(184, 135, 89, 145), width=2)
    draw.line((510, 1023, 580, 1023), fill=(184, 135, 89, 145), width=2)
    draw_centered_text(canvas, (230, 995, 520, 1052), "技能将在下一局中使用", load_font(20), MUTED_TEXT)

    canvas.convert("RGB").save(OUTPUT, "PNG", optimize=True, compress_level=9)
    print(OUTPUT)


if __name__ == "__main__":
    render()
