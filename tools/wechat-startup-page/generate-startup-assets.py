#!/usr/bin/env python3

"""生成微信启动页的两张轻量图片。

启动页只有背景和 Logo 使用图片；进度条、状态文字与健康游戏忠告均在运行时绘制。
这里仅压缩背景和 Logo，避免高清原图直接进入微信主包造成体积超限。
"""

from pathlib import Path

from PIL import Image, ImageOps


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIRECTORY.parent.parent
SOURCE_BACKGROUND = (
    PROJECT_ROOT / "assets/images/Loading/loading_bg_candy_shop.png"
)
SOURCE_LOGO = (
    PROJECT_ROOT / "assets/images/title_1024_number_garden_v4_borderless.png"
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


def main() -> None:
    """生成启动页使用的背景和 Logo。"""

    create_background()
    create_logo()
    print(f"启动页背景和 Logo 已生成：{SCRIPT_DIRECTORY}")


if __name__ == "__main__":
    main()
