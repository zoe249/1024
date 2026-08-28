#!/usr/bin/env python3

"""把三张首次进入页设计源整理为等规格背景、启动页预览和横向对比图。"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIRECTORY = Path(__file__).resolve().parent / "background-variants-v1"
LOGO_PATH = PROJECT_ROOT / "assets/resources/Homepage/logo-1024-number-garden.png"
CANVAS_SIZE = (750, 1334)

VARIANTS = (
    ("a-colored-pencil-morning", "A  彩铅晨光"),
    ("b-layered-paper-garden", "B  手工剪纸"),
    ("c-luminous-watercolor-night", "C  夜光水彩"),
)

FONT_CANDIDATES = (
    Path("C:/Windows/Fonts/msyh.ttc"),
    Path("C:/Windows/Fonts/simhei.ttf"),
    Path("/System/Library/Fonts/PingFang.ttc"),
    Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
)


def resolve_font_path() -> Path:
    """选择本机中文字体；字体只用于设计预览，不进入游戏包。"""

    for candidate in FONT_CANDIDATES:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("未找到可用于生成启动页对比图的中文字体。")


def prepare_logo(target_width: int = 500) -> Image.Image:
    """裁掉项目 Logo 的透明留白并缩放到统一预览尺寸。"""

    logo = Image.open(LOGO_PATH).convert("RGBA")
    bounds = logo.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("项目 Logo 没有可见像素。")

    left, top, right, bottom = bounds
    padding = 16
    logo = logo.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(logo.width, right + padding),
            min(logo.height, bottom + padding),
        )
    )
    target_height = round(logo.height * target_width / logo.width)
    return logo.resize((target_width, target_height), Image.Resampling.LANCZOS)


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    center_y: int,
    font: ImageFont.FreeTypeFont,
    fill: str,
    stroke_fill: str,
    stroke_width: int,
) -> None:
    """在 750 像素设计宽度内绘制居中文字。"""

    bounds = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    draw.text(
        ((CANVAS_SIZE[0] - width) / 2, center_y - height / 2 - bounds[1]),
        text,
        font=font,
        fill=fill,
        stroke_fill=stroke_fill,
        stroke_width=stroke_width,
    )


def render_startup_preview(
    background: Image.Image,
    logo: Image.Image,
    font_path: Path,
) -> Image.Image:
    """叠加当前启动页信息层，以相同 UI 检查不同背景的可读性。"""

    preview = background.copy()
    logo_left = round((preview.width - logo.width) / 2)
    logo_top = round(244 - logo.height / 2)
    preview.paste(logo, (logo_left, logo_top), logo)

    draw = ImageDraw.Draw(preview, "RGBA")
    status_font = ImageFont.truetype(str(font_path), 36)
    advice_title_font = ImageFont.truetype(str(font_path), 25)
    advice_font = ImageFont.truetype(str(font_path), 18)

    draw_centered_text(
        draw,
        "正在唤醒数字花园…",
        center_y=1000,
        font=status_font,
        fill="#fff6da",
        stroke_fill="#4a301c",
        stroke_width=4,
    )

    draw.rounded_rectangle((120, 1044, 630, 1078), radius=17, fill="#4a301ce8")
    draw.rounded_rectangle((125, 1049, 625, 1073), radius=12, fill="#fff0c7f2")
    draw.rounded_rectangle((125, 1049, 435, 1073), radius=12, fill="#7eb736ff")

    draw.rounded_rectangle((36, 1155, 714, 1296), radius=28, fill="#402b19b8")
    draw_centered_text(
        draw,
        "健康游戏忠告",
        center_y=1190,
        font=advice_title_font,
        fill="#ffe27a",
        stroke_fill="#4a301c",
        stroke_width=2,
    )
    draw_centered_text(
        draw,
        "抵制不良游戏  拒绝盗版游戏  注意自我保护  谨防受骗上当",
        center_y=1232,
        font=advice_font,
        fill="#fff6da",
        stroke_fill="#4a301c",
        stroke_width=1,
    )
    draw_centered_text(
        draw,
        "适度游戏益脑  沉迷游戏伤身  合理安排时间  享受健康生活",
        center_y=1265,
        font=advice_font,
        fill="#fff6da",
        stroke_fill="#4a301c",
        stroke_width=1,
    )
    return preview


def render_contact_sheet(
    previews: list[tuple[str, Image.Image]],
    font_path: Path,
) -> None:
    """把三张实际启动页预览缩成同尺度并排展示。"""

    card_width = 330
    card_height = round(card_width * CANVAS_SIZE[1] / CANVAS_SIZE[0])
    margin = 24
    title_height = 68
    sheet_width = margin * 4 + card_width * 3
    sheet_height = margin * 2 + title_height + card_height
    sheet = Image.new("RGB", (sheet_width, sheet_height), "#f3ead3")
    draw = ImageDraw.Draw(sheet)
    title_font = ImageFont.truetype(str(font_path), 30)

    for index, (label, preview) in enumerate(previews):
        left = margin + index * (card_width + margin)
        card = preview.resize((card_width, card_height), Image.Resampling.LANCZOS)
        sheet.paste(card, (left, margin + title_height))
        bounds = draw.textbbox((0, 0), label, font=title_font)
        label_width = bounds[2] - bounds[0]
        draw.text(
            (left + (card_width - label_width) / 2, margin + 10),
            label,
            font=title_font,
            fill="#4a301c",
        )

    sheet.save(
        OUTPUT_DIRECTORY / "background-variants-v1-contact-sheet.jpg",
        quality=90,
        optimize=True,
        subsampling=2,
    )


def main() -> None:
    """生成三套纯背景、实际启动页预览和对比图。"""

    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    font_path = resolve_font_path()
    logo = prepare_logo()
    previews: list[tuple[str, Image.Image]] = []

    for slug, label in VARIANTS:
        source_path = OUTPUT_DIRECTORY / f"{slug}-source.png"
        if not source_path.is_file():
            raise FileNotFoundError(f"缺少生成源：{source_path}")

        background = ImageOps.fit(
            Image.open(source_path).convert("RGB"),
            CANVAS_SIZE,
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
        background.save(
            OUTPUT_DIRECTORY / f"{slug}-background.jpg",
            quality=86,
            optimize=True,
            progressive=False,
            subsampling=2,
        )

        preview = render_startup_preview(background, logo, font_path)
        preview.save(
            OUTPUT_DIRECTORY / f"{slug}-preview.jpg",
            quality=89,
            optimize=True,
            progressive=False,
            subsampling=2,
        )
        previews.append((label, preview))

    render_contact_sheet(previews, font_path)
    print(f"三套启动背景与对比图已生成：{OUTPUT_DIRECTORY}")


if __name__ == "__main__":
    main()
