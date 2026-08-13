"""生成游戏页需要的轻量运行时视觉素材。

背景从已验收的春日蜡笔源图缩放并压缩；设置和交换图标使用确定性绘制，
避免把整张设计稿或过大透明图导入 Cocos。
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


DESIGN_SIZE = 128
AA_SCALE = 4


def rounded_rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, **kwargs) -> None:
    draw.rounded_rectangle(tuple(value * AA_SCALE for value in box), radius * AA_SCALE, **kwargs)


def downsample(image: Image.Image) -> Image.Image:
    return image.resize((DESIGN_SIZE, DESIGN_SIZE), Image.Resampling.LANCZOS)


def build_settings_icon(output: Path) -> None:
    canvas = Image.new("RGBA", (DESIGN_SIZE * AA_SCALE, DESIGN_SIZE * AA_SCALE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    rounded_rect(draw, (7, 7, 121, 121), 20, fill="#ffc733", outline="#4b3528", width=5 * AA_SCALE)
    rounded_rect(draw, (14, 14, 114, 114), 15, outline="#ffeaa2", width=3 * AA_SCALE)

    center = 64 * AA_SCALE
    outer = 31 * AA_SCALE
    inner = 14 * AA_SCALE
    teeth = []
    for index in range(16):
        import math

        angle = -math.pi / 2 + index * math.pi / 8
        radius = outer if index % 2 == 0 else 24 * AA_SCALE
        teeth.append((center + math.cos(angle) * radius, center + math.sin(angle) * radius))
    draw.polygon(teeth, fill="#fff9e9", outline="#4b3528")
    draw.ellipse((center - inner, center - inner, center + inner, center + inner), fill="#ffc733", outline="#4b3528", width=4 * AA_SCALE)

    output.parent.mkdir(parents=True, exist_ok=True)
    downsample(canvas).save(output, "PNG", optimize=True, compress_level=9)


def build_swap_icon(output: Path, font_path: Path) -> None:
    canvas = Image.new("RGBA", (DESIGN_SIZE * AA_SCALE, DESIGN_SIZE * AA_SCALE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    rounded_rect(draw, (13, 34, 69, 88), 10, fill="#7658d8", outline="#4b3528", width=4 * AA_SCALE)
    rounded_rect(draw, (59, 29, 115, 83), 10, fill="#f57948", outline="#4b3528", width=4 * AA_SCALE)

    font = ImageFont.truetype(str(font_path), 29 * AA_SCALE)
    for text, center_x, center_y in (("2", 41, 61), ("8", 87, 56)):
        bounds = draw.textbbox((0, 0), text, font=font, stroke_width=1 * AA_SCALE)
        width = bounds[2] - bounds[0]
        height = bounds[3] - bounds[1]
        draw.text(
            (center_x * AA_SCALE - width / 2, center_y * AA_SCALE - height / 2 - bounds[1]),
            text,
            font=font,
            fill="#fff9ea",
            stroke_width=1 * AA_SCALE,
            stroke_fill="#4b3528",
        )

    # 两条弧线和简化箭头，保留设计稿的手绘感但不嵌入整个圆形按钮。
    draw.arc((20 * AA_SCALE, 8 * AA_SCALE, 108 * AA_SCALE, 105 * AA_SCALE), 202, 320, fill="#22a8cf", width=6 * AA_SCALE)
    draw.polygon(
        [(103 * AA_SCALE, 20 * AA_SCALE), (116 * AA_SCALE, 24 * AA_SCALE), (108 * AA_SCALE, 35 * AA_SCALE)],
        fill="#22a8cf",
    )
    draw.arc((20 * AA_SCALE, 23 * AA_SCALE, 108 * AA_SCALE, 120 * AA_SCALE), 22, 140, fill="#f5b72b", width=6 * AA_SCALE)
    draw.polygon(
        [(25 * AA_SCALE, 93 * AA_SCALE), (12 * AA_SCALE, 88 * AA_SCALE), (20 * AA_SCALE, 77 * AA_SCALE)],
        fill="#f5b72b",
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    downsample(canvas).save(output, "PNG", optimize=True, compress_level=9)


def build_background(source: Path, output: Path) -> None:
    image = Image.open(source).convert("RGB")
    target_size = (750, 1335)
    source_ratio = image.width / image.height
    target_ratio = target_size[0] / target_size[1]
    if source_ratio > target_ratio:
        crop_width = round(image.height * target_ratio)
        left = (image.width - crop_width) // 2
        image = image.crop((left, 0, left + crop_width, image.height))
    else:
        crop_height = round(image.width / target_ratio)
        top = (image.height - crop_height) // 2
        image = image.crop((0, top, image.width, top + crop_height))

    image = image.resize(target_size, Image.Resampling.LANCZOS)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, "JPEG", quality=82, optimize=True, progressive=True, subsampling=1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, default=Path.cwd())
    args = parser.parse_args()
    project = args.project.resolve()

    build_background(
        project / "assets/images/World/bg_flat_cartoon_spring_meadow_v1.png",
        project / "assets/images/World/spring-meadow-game-v1.jpg",
    )
    build_settings_icon(project / "assets/images/Buttons/GameSettingsBtn.png")
    build_swap_icon(
        project / "assets/images/Skills/SwapIcon.png",
        project / "assets/fonts/EazyChatR.ttf",
    )


if __name__ == "__main__":
    main()
