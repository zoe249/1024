#!/usr/bin/env python3

"""生成微信启动页的轻量发布资源。

启动阶段不再依赖 wx.createOffscreenCanvas 绘制中文，避免部分微信基础库或设备
无法将离屏 2D Canvas 上传到 WebGL，导致文字不可见。同时压缩背景和 Logo，
避免高清原图直接进入微信主包造成体积超限。
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIRECTORY.parent.parent
SOURCE_BACKGROUND = (
    PROJECT_ROOT / "assets/images/Loading/loading_bg_candy_shop.png"
)
SOURCE_LOGO = (
    PROJECT_ROOT / "assets/images/title_1024_number_garden_v4_borderless.png"
)
FONT_CANDIDATES = (
    Path("/System/Library/Fonts/STHeiti Medium.ttc"),
    Path("/System/Library/Fonts/Supplemental/Songti.ttc"),
)


def quantize_transparent_image(image: Image.Image, colors: int = 256) -> Image.Image:
    """将透明图片转为调色板 PNG，在保留透明边缘的同时显著缩小体积。"""

    return image.convert("RGBA").quantize(
        colors=colors,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.FLOYDSTEINBERG,
    )


def create_background() -> None:
    """生成启动页专用的竖屏 JPEG 背景。"""

    image = Image.open(SOURCE_BACKGROUND).convert("RGB")
    image = ImageOps.fit(
        image,
        (750, 1334),
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
    image.save(
        SCRIPT_DIRECTORY / "startup-background.jpg",
        quality=76,
        optimize=True,
        progressive=False,
        subsampling=2,
    )


def create_logo() -> None:
    """裁掉新版 Logo 的透明留白并生成轻量透明 PNG。"""

    image = Image.open(SOURCE_LOGO).convert("RGBA")
    alpha_bounds = image.getchannel("A").getbbox()
    if alpha_bounds is None:
        raise ValueError("新版 Logo 没有可见像素。")

    padding = 20
    left, top, right, bottom = alpha_bounds
    crop_bounds = (
        max(0, left - padding),
        max(0, top - padding),
        min(image.width, right + padding),
        min(image.height, bottom + padding),
    )
    image = image.crop(crop_bounds)
    target_width = 720
    target_height = round(image.height * target_width / image.width)
    image = image.resize(
        (target_width, target_height),
        Image.Resampling.LANCZOS,
    )
    quantize_transparent_image(image).save(
        SCRIPT_DIRECTORY / "startup-logo.png",
        optimize=True,
    )


def find_font() -> Path:
    """选择本机可用的中文字体。"""

    for font_path in FONT_CANDIDATES:
        if font_path.is_file():
            return font_path

    raise FileNotFoundError("未找到可用于生成启动页文字的中文字体。")


def create_loading_label(font_path: Path) -> None:
    """生成进度条中央的“初始化中”透明图片。"""

    image = Image.new("RGBA", (512, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(font_path), 58)
    text = "初始化中"
    bounds = draw.textbbox((0, 0), text, font=font, stroke_width=2)
    text_width = bounds[2] - bounds[0]
    text_height = bounds[3] - bounds[1]

    draw.text(
        (
            (image.width - text_width) * 0.5 - bounds[0],
            (image.height - text_height) * 0.5 - bounds[1],
        ),
        text,
        font=font,
        fill=(255, 255, 255, 255),
        stroke_width=2,
        stroke_fill=(0, 0, 0, 90),
    )
    quantize_transparent_image(image, colors=128).save(
        SCRIPT_DIRECTORY / "loading-label.png",
        optimize=True,
    )


def create_health_advice(font_path: Path) -> None:
    """生成标题加两行正文的健康游戏忠告透明图片。"""

    image = Image.new("RGBA", (1024, 256), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    title_font = ImageFont.truetype(str(font_path), 48)
    body_font = ImageFont.truetype(str(font_path), 34)
    lines = (
        ("健康游戏忠告", title_font, (255, 227, 154, 255), 44),
        (
            "抵制不良游戏　拒绝盗版游戏　注意自我保护　谨防受骗上当",
            body_font,
            (255, 255, 255, 255),
            118,
        ),
        (
            "适度游戏益脑　沉迷游戏伤身　合理安排时间　享受健康生活",
            body_font,
            (255, 255, 255, 255),
            174,
        ),
    )

    for text, font, color, center_y in lines:
        bounds = draw.textbbox((0, 0), text, font=font, stroke_width=2)
        text_width = bounds[2] - bounds[0]
        text_height = bounds[3] - bounds[1]
        draw.text(
            (
                (image.width - text_width) * 0.5 - bounds[0],
                center_y - text_height * 0.5 - bounds[1],
            ),
            text,
            font=font,
            fill=color,
            stroke_width=2,
            stroke_fill=(0, 0, 0, 150),
        )

    quantize_transparent_image(image, colors=128).save(
        SCRIPT_DIRECTORY / "health-advice.png",
        optimize=True,
    )


def main() -> None:
    """生成启动页使用的全部轻量资源。"""

    font_path = find_font()
    create_background()
    create_logo()
    create_loading_label(font_path)
    create_health_advice(font_path)
    print(f"启动页轻量资源已生成：{SCRIPT_DIRECTORY}")


if __name__ == "__main__":
    main()
