"""从棋子六格透明源图生成 Cocos 运行时小图。

源图保留在 design/pieces，运行时只输出 160x160 的分层 PNG，避免把生成大图导入 assets。
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ASSET_SIZE = 160
AA_SCALE = 4
CELL_NAMES = (
    "piece-body-fill",
    "piece-outline",
    "piece-highlight",
    "piece-shadow",
    "piece-decoration-sparkle",
    "piece-decoration-crown",
)


def fit_layer(layer: Image.Image, max_width: int, max_height: int) -> Image.Image:
    """裁掉透明边缘并按比例缩放到指定范围。"""

    alpha_box = layer.getchannel("A").getbbox()
    if alpha_box is None:
        raise ValueError("图层没有可见像素")
    cropped = layer.crop(alpha_box)
    scale = min(max_width / cropped.width, max_height / cropped.height)
    target = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
    return cropped.resize(target, Image.Resampling.LANCZOS)


def paste_center(canvas: Image.Image, layer: Image.Image, offset_x: int = 0, offset_y: int = 0) -> None:
    x = (canvas.width - layer.width) // 2 + offset_x
    y = (canvas.height - layer.height) // 2 + offset_y
    canvas.alpha_composite(layer, (x, y))


def build_assets(source_path: Path, output_dir: Path) -> None:
    source = Image.open(source_path).convert("RGBA")
    width, height = source.size
    if width % 3 or height % 2:
        raise ValueError(f"源图必须是可均分的 3x2 网格，当前尺寸为 {source.size}")

    output_dir.mkdir(parents=True, exist_ok=True)
    cell_width = width // 3
    cell_height = height // 2
    cells = []
    for row in range(2):
        for column in range(3):
            box = (
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            )
            cells.append(source.crop(box))

    for index, (name, cell) in enumerate(zip(CELL_NAMES, cells)):
        canvas = Image.new("RGBA", (ASSET_SIZE, ASSET_SIZE), (0, 0, 0, 0))
        if index == 0:
            # 设计稿是低圆角方块，主体使用中性白便于 Sprite.color 动态染色。
            large = Image.new("RGBA", (ASSET_SIZE * AA_SCALE, ASSET_SIZE * AA_SCALE), (0, 0, 0, 0))
            draw = ImageDraw.Draw(large)
            draw.rounded_rectangle(
                (7 * AA_SCALE, 7 * AA_SCALE, 153 * AA_SCALE, 153 * AA_SCALE),
                radius=12 * AA_SCALE,
                fill=(246, 246, 246, 255),
            )
            # 只保留非常轻的蜡笔短纹，不再叠加玻璃渐变和高光。
            for offset in range(18, 142, 17):
                draw.line(
                    (offset * AA_SCALE, 32 * AA_SCALE, (offset + 11) * AA_SCALE, 29 * AA_SCALE),
                    fill=(255, 255, 255, 18),
                    width=1 * AA_SCALE,
                )
                draw.line(
                    ((offset - 5) * AA_SCALE, 126 * AA_SCALE, (offset + 8) * AA_SCALE, 123 * AA_SCALE),
                    fill=(220, 220, 220, 12),
                    width=1 * AA_SCALE,
                )
            canvas = large.resize((ASSET_SIZE, ASSET_SIZE), Image.Resampling.LANCZOS)
        elif index == 1:
            # 描边使用中性白，运行时统一染成棕色；8192 可单独染成金色。
            large = Image.new("RGBA", (ASSET_SIZE * AA_SCALE, ASSET_SIZE * AA_SCALE), (0, 0, 0, 0))
            draw = ImageDraw.Draw(large)
            draw.rounded_rectangle(
                (5 * AA_SCALE, 5 * AA_SCALE, 155 * AA_SCALE, 155 * AA_SCALE),
                radius=14 * AA_SCALE,
                outline=(255, 255, 255, 255),
                width=5 * AA_SCALE,
            )
            canvas = large.resize((ASSET_SIZE, ASSET_SIZE), Image.Resampling.LANCZOS)
        elif index == 2:
            # 高光改成少量手绘短纹，避免之前整片发白的塑料感。
            large = Image.new("RGBA", (ASSET_SIZE * AA_SCALE, ASSET_SIZE * AA_SCALE), (0, 0, 0, 0))
            draw = ImageDraw.Draw(large)
            for x, y, length in ((25, 31, 18), (48, 23, 12), (91, 28, 21), (121, 40, 13), (28, 109, 14), (102, 119, 19)):
                draw.line(
                    (x * AA_SCALE, y * AA_SCALE, (x + length) * AA_SCALE, (y - 3) * AA_SCALE),
                    fill=(255, 255, 255, 24),
                    width=2 * AA_SCALE,
                )
            canvas = large.resize((ASSET_SIZE, ASSET_SIZE), Image.Resampling.LANCZOS)
        elif index == 3:
            # 设计稿中只有很轻的落地阴影，不使用厚黑底。
            large = Image.new("RGBA", (ASSET_SIZE * AA_SCALE, ASSET_SIZE * AA_SCALE), (0, 0, 0, 0))
            draw = ImageDraw.Draw(large)
            draw.rounded_rectangle(
                (8 * AA_SCALE, 11 * AA_SCALE, 154 * AA_SCALE, 157 * AA_SCALE),
                radius=14 * AA_SCALE,
                fill=(52, 38, 28, 42),
            )
            large = large.filter(ImageFilter.GaussianBlur(2.2 * AA_SCALE))
            canvas = large.resize((ASSET_SIZE, ASSET_SIZE), Image.Resampling.LANCZOS)
        elif index == 4:
            sparkle = fit_layer(cell, 48, 58)
            canvas.alpha_composite(sparkle, (ASSET_SIZE - sparkle.width - 8, 8))
        else:
            crown = fit_layer(cell, 82, 58)
            canvas.alpha_composite(crown, ((ASSET_SIZE - crown.width) // 2, 4))

        output_path = output_dir / f"{name}.png"
        canvas.save(output_path, format="PNG", optimize=True, compress_level=9)
        if output_path.stat().st_size > 100 * 1024:
            raise ValueError(f"{output_path.name} 超过 100 KB 预算")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    build_assets(args.source, args.output_dir)


if __name__ == "__main__":
    main()
