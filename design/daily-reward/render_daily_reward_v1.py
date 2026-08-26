from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(
    r"C:\Users\14217\.codex\generated_images\019fd0b9-fce4-73c3-a998-727e7aa92711\exec-b7e08c00-acf4-414e-8c1e-222996a2c08e.png"
)
OUTPUT = Path(__file__).with_name("daily-reward-design-v1.png")
COIN = ROOT / "assets/resources/Settlement/reward-coin.png"
CLOSE = ROOT / "assets/resources/Settings/button-close.png"
FONT_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")
FONT_REGULAR = Path(r"C:\Windows\Fonts\msyh.ttc")

CANVAS_SIZE = (750, 1334)
BROWN = (73, 43, 27, 255)
CREAM = (255, 244, 213, 255)
CORAL = (243, 105, 76, 255)
GREEN = (111, 166, 55, 255)
MUTED = (125, 94, 67, 255)


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    path = FONT_BOLD if bold else FONT_REGULAR
    return ImageFont.truetype(str(path), size=size)


def contain(path: Path, size: tuple[int, int], opacity: int = 255) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    image.thumbnail(size, Image.Resampling.LANCZOS)
    result = Image.new("RGBA", size, (0, 0, 0, 0))
    result.alpha_composite(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    if opacity < 255:
        result.putalpha(result.getchannel("A").point(lambda value: value * opacity // 255))
    return result


def centered_text(
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    value: str,
    text_font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    stroke_width: int = 0,
    stroke_fill: tuple[int, int, int, int] = BROWN,
) -> None:
    draw = ImageDraw.Draw(canvas)
    bounds = draw.textbbox((0, 0), value, font=text_font, stroke_width=stroke_width)
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    x = box[0] + (box[2] - box[0] - width) / 2
    y = box[1] + (box[3] - box[1] - height) / 2 - bounds[1]
    draw.text(
        (x, y),
        value,
        font=text_font,
        fill=fill,
        stroke_width=stroke_width,
        stroke_fill=stroke_fill,
    )


def draw_check(canvas: Image.Image, center: tuple[int, int]) -> None:
    draw = ImageDraw.Draw(canvas)
    x, y = center
    draw.ellipse((x - 16, y - 16, x + 16, y + 16), fill=BROWN)
    draw.ellipse((x - 13, y - 13, x + 13, y + 13), fill=GREEN)
    draw.line((x - 7, y, x - 1, y + 7, x + 9, y - 7), fill=CREAM, width=4, joint="curve")


def draw_small_reward(
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    day: int,
    amount: int,
    state: str,
) -> None:
    x1, y1, x2, y2 = box
    text_fill = MUTED if state == "claimed" else BROWN
    centered_text(canvas, (x1 + 8, y1 + 12, x2 - 8, y1 + 49), f"第{day}天", font(19), text_fill)

    coin = contain(COIN, (72, 76), 165 if state == "claimed" else 255)
    canvas.alpha_composite(coin, ((x1 + x2 - 72) // 2, y1 + 62))
    centered_text(canvas, (x1 + 10, y2 - 48, x2 - 10, y2 - 5), str(amount), font(25), text_fill)

    if state == "claimed":
        draw_check(canvas, (x2 - 24, y1 + 142))
    elif state == "today":
        centered_text(canvas, (x1 + 42, y1 - 17, x2 - 42, y1 + 16), "今日", font(16), CREAM, 1, BROWN)


def draw_seventh_day(canvas: Image.Image) -> None:
    # 第七天沿用原图的横向大奖结构，但奖励只保留金币。
    centered_text(canvas, (142, 738, 300, 789), "第7天", font(27), BROWN)
    centered_text(canvas, (139, 784, 304, 829), "连续大奖", font(19), MUTED)

    coin = contain(COIN, (88, 93))
    canvas.alpha_composite(coin, (331, 752))
    centered_text(canvas, (454, 746, 672, 846), "×12000", font(32), CORAL, 2, BROWN)
    centered_text(canvas, (145, 852, 650, 894), "累计登录7天即可领取", font(18, False), MUTED)


def render() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"未找到生成底稿：{SOURCE}")

    # 截取生成底稿中信息密度最合适的一段，再精确适配项目常用的 750×1334 设计尺寸。
    source = Image.open(SOURCE).convert("RGBA")
    canvas = source.crop((0, 220, source.width, 1735)).resize(CANVAS_SIZE, Image.Resampling.LANCZOS)

    centered_text(canvas, (105, 35, 645, 112), "每日奖励", font(52), CREAM, 3, BROWN)
    centered_text(canvas, (85, 119, 665, 167), "连续登录越久，金币奖励越多！", font(23), CREAM, 2, BROWN)

    close = contain(CLOSE, (60, 60))
    canvas.alpha_composite(close, (660, 43))

    first_row = ((46, 223, 195, 443), (216, 223, 365, 443), (382, 223, 534, 443), (553, 223, 704, 443))
    second_row = ((216, 476, 365, 690), (383, 476, 534, 690))
    rewards = (1000, 1500, 2000, 3000, 5000, 8000)
    states = ("claimed", "claimed", "today", "future", "future", "future")

    for index, reward_box in enumerate((*first_row, *second_row)):
        draw_small_reward(canvas, reward_box, index + 1, rewards[index], states[index])

    draw_seventh_day(canvas)

    coin = contain(COIN, (42, 45))
    canvas.alpha_composite(coin, (354, 980))
    centered_text(canvas, (172, 974, 350, 1033), "今日可领取", font(24), CREAM, 2, BROWN)
    centered_text(canvas, (398, 974, 568, 1033), "2000 金币", font(23), CREAM, 2, BROWN)

    centered_text(canvas, (245, 1161, 507, 1248), "立即领取", font(36), CREAM, 2, BROWN)

    # 设计稿采用索引色压缩，保留彩铅纹理，同时避免单张评审图体积失控。
    compressed = canvas.convert("RGB").quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    compressed.save(OUTPUT, "PNG", optimize=True, compress_level=9)
    print(OUTPUT)


if __name__ == "__main__":
    render()
