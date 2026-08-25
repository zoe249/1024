from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

from render_skill_shop_v2 import (
    BACKGROUND,
    BROWN,
    CANVAS_SIZE,
    CLOSE,
    COIN,
    CORAL,
    CORAL_LIGHT,
    CREAM,
    MUTED_TEXT,
    ROOT,
    TEXT,
    contain,
    cover,
    draw_centered_text,
    load_font,
    paste_round_rect,
)


OUTPUT = Path(__file__).with_name("skill-shop-popup-v3.png")
CARD_FILL = (247, 190, 121, 255)


def add_pencil_texture(
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    seed: int,
    density: float = 1.0,
) -> None:
    """在平涂色块上叠加细碎彩铅排线，不使用成片的玻璃高光。"""
    x1, y1, x2, y2 = box
    width = x2 - x1
    height = y2 - y1
    texture = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(texture)
    rng = random.Random(seed)
    stroke_count = max(34, round(width * height / 175 * density))
    colors = (
        (104, 61, 31, 28),
        (143, 86, 44, 24),
        (255, 237, 196, 32),
        (255, 248, 222, 22),
    )

    for _ in range(stroke_count):
        x = rng.randint(-8, width + 2)
        y = rng.randint(1, height - 2)
        length = rng.randint(7, 23)
        slope = rng.randint(-4, 4)
        draw.line((x, y, x + length, y + slope), fill=rng.choice(colors), width=1)

    # 少量反向短线打破规整感，模拟纸面上重复铺色留下的交叉笔触。
    for _ in range(max(12, stroke_count // 7)):
        x = rng.randint(0, width - 1)
        y = rng.randint(0, height - 1)
        length = rng.randint(4, 12)
        draw.line((x, y, x - length, y + rng.randint(2, 6)), fill=(101, 62, 34, 20), width=1)

    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=radius, fill=255)
    texture.putalpha(ImageChops.multiply(texture.getchannel("A"), mask))
    canvas.alpha_composite(texture, (x1, y1))


def draw_balance(canvas: Image.Image) -> None:
    box = (256, 278, 494, 340)
    paste_round_rect(canvas, box, CREAM, 24, 301, outline_width=3)
    add_pencil_texture(canvas, box, 24, 1301, 0.7)
    coin = contain(Image.open(COIN), (38, 38))
    canvas.alpha_composite(coin, (278, 290))
    draw_centered_text(canvas, (326, 278, 476, 340), "金币 1280", load_font(23), TEXT)


def draw_price_button(canvas: Image.Image, box: tuple[int, int, int, int], price: int, seed: int) -> None:
    paste_round_rect(canvas, box, CORAL, 20, seed, outline_width=3)
    add_pencil_texture(canvas, box, 20, seed + 700, 1.35)
    coin = contain(Image.open(COIN), (27, 27))
    canvas.alpha_composite(coin, (box[0] + 28, box[1] + 10))
    draw_centered_text(canvas, (box[0] + 56, box[1], box[2] - 12, box[3]), str(price), load_font(21), (255, 253, 235, 255), 1, BROWN)


def draw_item_card(
    canvas: Image.Image,
    x: int,
    y: int,
    name: str,
    owned: int,
    price: int,
    icon_path: Path,
    seed: int,
) -> None:
    card = (x, y, x + 246, y + 300)
    paste_round_rect(canvas, card, CARD_FILL, 21, seed, outline_width=3)
    add_pencil_texture(canvas, card, 21, seed + 500, 1.35)

    draw_centered_text(canvas, (x + 14, y + 16, x + 232, y + 63), name, load_font(28), TEXT)
    icon = contain(Image.open(icon_path), (126, 126))
    canvas.alpha_composite(icon, (x + 60, y + 66))

    owned_box = (x + 60, y + 197, x + 186, y + 234)
    paste_round_rect(canvas, owned_box, (255, 240, 205, 255), 17, seed + 1, outline_width=2, shadow=False)
    add_pencil_texture(canvas, owned_box, 17, seed + 600, 0.8)
    draw_centered_text(canvas, owned_box, f"持有 {owned}/9", load_font(17), MUTED_TEXT)

    draw_price_button(canvas, (x + 37, y + 245, x + 209, y + 290), price, seed + 2)


def render() -> None:
    canvas = cover(Image.open(BACKGROUND), CANVAS_SIZE)
    canvas.alpha_composite(Image.new("RGBA", CANVAS_SIZE, (5, 35, 44, 176)))

    close = contain(Image.open(CLOSE), (66, 66))
    canvas.alpha_composite(close, (620, 172))
    draw_balance(canvas)

    draw_item_card(
        canvas,
        110,
        390,
        "炸弹",
        7,
        500,
        ROOT / "assets/images/Skills/Bomb.png",
        401,
    )
    draw_item_card(
        canvas,
        394,
        390,
        "木槌",
        5,
        300,
        ROOT / "assets/images/Skills/Hammer.png",
        411,
    )
    draw_item_card(
        canvas,
        252,
        722,
        "交换",
        7,
        400,
        ROOT / "assets/images/Skills/SwapIcon.png",
        421,
    )

    hint_box = (230, 1056, 520, 1112)
    paste_round_rect(canvas, hint_box, (255, 246, 222, 232), 22, 431, outline_width=2, shadow=False)
    add_pencil_texture(canvas, hint_box, 22, 1431, 0.7)
    draw_centered_text(canvas, hint_box, "点击价格即可购买", load_font(19), MUTED_TEXT)

    canvas.convert("RGB").save(OUTPUT, "PNG", optimize=True, compress_level=9)
    print(OUTPUT)


if __name__ == "__main__":
    render()
