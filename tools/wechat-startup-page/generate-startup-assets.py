#!/usr/bin/env python3

"""生成数字花园首次进入页的轻量运行资源与设计预览。

微信原生首屏使用独立背景和透明 Logo；Cocos 发布插屏使用烘焙 Logo 的完整图片，
从而彻底避开默认 Cocos Logo，并保证两层首屏使用同一套视觉素材。
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIRECTORY.parent.parent
DESIGN_DIRECTORY = PROJECT_ROOT / "design/startup"
VARIANT_DIRECTORY = DESIGN_DIRECTORY / "background-variants-v1"
SOURCE_BACKGROUND = DESIGN_DIRECTORY / "first-entry-background-v2-source.png"
SOURCE_LOGO = (
    PROJECT_ROOT / "assets/resources/Homepage/logo-1024-number-garden.png"
)
STARTUP_BACKGROUND = SCRIPT_DIRECTORY / "startup-background.jpg"
DAY_BACKGROUND_SOURCE = (
    VARIANT_DIRECTORY / "b-layered-paper-garden-background.jpg"
)
NIGHT_BACKGROUND_SOURCE = (
    VARIANT_DIRECTORY / "c-luminous-watercolor-night-background.jpg"
)
STARTUP_DAY_BACKGROUND = SCRIPT_DIRECTORY / "startup-background-day.jpg"
STARTUP_NIGHT_BACKGROUND = SCRIPT_DIRECTORY / "startup-background-night.jpg"
STARTUP_LOGO = SCRIPT_DIRECTORY / "startup-logo.png"
COCOS_SPLASH = PROJECT_ROOT / "settings/first-entry-splash-v2.jpg"
DESIGN_PREVIEW = DESIGN_DIRECTORY / "first-entry-v2-preview.jpg"
PREVIEW_FONT_CANDIDATES = (
    Path("C:/Windows/Fonts/msyh.ttc"),
    Path("C:/Windows/Fonts/simhei.ttf"),
    Path("/System/Library/Fonts/PingFang.ttc"),
    Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
)

CANVAS_SIZE = (750, 1334)


def resolve_preview_font() -> Path:
    """选择本机可用的中文字体；预览字体不进入游戏包。"""

    for font_path in PREVIEW_FONT_CANDIDATES:
        if font_path.is_file():
            return font_path
    raise FileNotFoundError("未找到可用于生成启动页预览的中文系统字体。")


def quantize_transparent_image(image: Image.Image, colors: int = 256) -> Image.Image:
    """将透明图片转为调色板 PNG，在保留透明边缘的同时显著缩小体积。"""

    return image.convert("RGBA").quantize(
        colors=colors,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.FLOYDSTEINBERG,
    )


def prepare_background() -> Image.Image:
    """按竖屏设计尺寸裁切背景，避免运行时出现横向拉伸。"""

    image = Image.open(SOURCE_BACKGROUND).convert("RGB")
    return ImageOps.fit(
        image,
        CANVAS_SIZE,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )


def prepare_logo(target_width: int = 720) -> Image.Image:
    """裁掉 Logo 透明留白，并按目标宽度生成清晰的透明图。"""

    image = Image.open(SOURCE_LOGO).convert("RGBA")
    alpha_bounds = image.getchannel("A").getbbox()
    if alpha_bounds is None:
        raise ValueError("数字花园 Logo 没有可见像素。")

    padding = 20
    left, top, right, bottom = alpha_bounds
    image = image.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(image.width, right + padding),
            min(image.height, bottom + padding),
        )
    )
    target_height = round(image.height * target_width / image.width)
    return image.resize(
        (target_width, target_height),
        Image.Resampling.LANCZOS,
    )


def paste_centered(base: Image.Image, overlay: Image.Image, center_y: int) -> None:
    """以水平居中的方式合成透明图片。"""

    left = round((base.width - overlay.width) / 2)
    top = round(center_y - overlay.height / 2)
    base.paste(overlay, (left, top), overlay)


def create_runtime_assets(background: Image.Image, logo: Image.Image) -> None:
    """输出微信主包使用的轻量背景和透明 Logo。"""

    background.save(
        STARTUP_BACKGROUND,
        quality=78,
        optimize=True,
        progressive=False,
        subsampling=2,
    )
    quantize_transparent_image(logo).save(STARTUP_LOGO, optimize=True)


def create_dynamic_background_assets() -> None:
    """由高清候选图生成微信主包专用版本，保留尺寸并降低短暂首屏的码率。"""

    for source, target in (
        (DAY_BACKGROUND_SOURCE, STARTUP_DAY_BACKGROUND),
        (NIGHT_BACKGROUND_SOURCE, STARTUP_NIGHT_BACKGROUND),
    ):
        image = ImageOps.fit(
            Image.open(source).convert("RGB"),
            CANVAS_SIZE,
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
        image.save(
            target,
            quality=55,
            optimize=True,
            progressive=False,
            subsampling=2,
        )


def create_cocos_splash(background: Image.Image, logo: Image.Image) -> None:
    """生成 Cocos 插屏背景；Logo 直接烘焙，避免引擎回退到默认品牌图。"""

    splash = background.copy()
    splash_logo_width = 500
    splash_logo = logo.resize(
        (
            splash_logo_width,
            round(logo.height * splash_logo_width / logo.width),
        ),
        Image.Resampling.LANCZOS,
    )
    paste_centered(splash, splash_logo, center_y=244)
    splash.save(
        COCOS_SPLASH,
        quality=82,
        optimize=True,
        progressive=False,
        subsampling=2,
    )


def centered_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    center_y: int,
    font: ImageFont.FreeTypeFont,
    fill: str,
    stroke_fill: str,
    stroke_width: int,
) -> None:
    """绘制用于设计预览的居中文字。"""

    bounds = draw.textbbox(
        (0, 0),
        text,
        font=font,
        stroke_width=stroke_width,
    )
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


def create_design_preview(background: Image.Image, logo: Image.Image) -> None:
    """生成带典型加载进度的静态预览，便于不启动微信工具也能检查排版。"""

    preview = background.copy()
    preview_logo_width = 500
    preview_logo = logo.resize(
        (
            preview_logo_width,
            round(logo.height * preview_logo_width / logo.width),
        ),
        Image.Resampling.LANCZOS,
    )
    paste_centered(preview, preview_logo, center_y=244)

    draw = ImageDraw.Draw(preview, "RGBA")
    preview_font = resolve_preview_font()
    status_font = ImageFont.truetype(str(preview_font), 36)
    advice_title_font = ImageFont.truetype(str(preview_font), 25)
    advice_font = ImageFont.truetype(str(preview_font), 18)
    centered_text(
        draw,
        "加载中",
        center_y=1000,
        font=status_font,
        fill="#fff6da",
        stroke_fill="#4a301c",
        stroke_width=4,
    )

    track_box = (120, 1044, 630, 1078)
    draw.rounded_rectangle(track_box, radius=17, fill="#4a301ce8")
    draw.rounded_rectangle((125, 1049, 625, 1073), radius=12, fill="#fff0c7f2")
    draw.rounded_rectangle((125, 1049, 435, 1073), radius=12, fill="#7eb736ff")

    advice_box = (36, 1155, 714, 1296)
    draw.rounded_rectangle(advice_box, radius=28, fill="#402b19b8")
    centered_text(
        draw,
        "健康游戏忠告",
        center_y=1190,
        font=advice_title_font,
        fill="#ffe27a",
        stroke_fill="#4a301c",
        stroke_width=2,
    )
    centered_text(
        draw,
        "抵制不良游戏  拒绝盗版游戏  注意自我保护  谨防受骗上当",
        center_y=1232,
        font=advice_font,
        fill="#fff6da",
        stroke_fill="#4a301c",
        stroke_width=1,
    )
    centered_text(
        draw,
        "适度游戏益脑  沉迷游戏伤身  合理安排时间  享受健康生活",
        center_y=1265,
        font=advice_font,
        fill="#fff6da",
        stroke_fill="#4a301c",
        stroke_width=1,
    )
    preview.save(DESIGN_PREVIEW, quality=88, optimize=True, subsampling=2)


def main() -> None:
    """生成首次进入页全部派生资源。"""

    DESIGN_DIRECTORY.mkdir(parents=True, exist_ok=True)
    background = prepare_background()
    logo = prepare_logo()
    create_runtime_assets(background, logo)
    create_dynamic_background_assets()
    create_cocos_splash(background, logo)
    create_design_preview(background, logo)
    print("首次进入页资源已生成：")
    for path in (
        STARTUP_BACKGROUND,
        STARTUP_DAY_BACKGROUND,
        STARTUP_NIGHT_BACKGROUND,
        STARTUP_LOGO,
        COCOS_SPLASH,
        DESIGN_PREVIEW,
    ):
        print(f"- {path}")


if __name__ == "__main__":
    main()
