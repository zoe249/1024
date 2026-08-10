from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
TARGET_WIDTHS = {
    # 首页：按 750×1335 设计分辨率和界面实际显示面积保留约 1.5～2 倍采样。
    "homepage/button-start-game.png": 640,
    "homepage/character-bear-dandelion.png": 600,
    "homepage/character-blue-bird.png": 256,
    "homepage/effect-dandelion-seeds.png": 480,
    "homepage/feature-daily-reward.png": 320,
    "homepage/feature-leaderboard.png": 320,
    "homepage/feature-share.png": 320,
    "homepage/feature-shop.png": 320,
    "homepage/logo-1024-number-garden.png": 800,
    "homepage/resource-coin.png": 384,
    "homepage/resource-stamina.png": 384,
    "homepage/ui-settings.png": 160,
    # 设置窗口。
    "settings/button-close.png": 160,
    "settings/button-customer-feedback.png": 384,
    "settings/button-restart.png": 512,
    "settings/button-return-home.png": 512,
    "settings/button-share-friend.png": 384,
    "settings/icon-music.png": 192,
    "settings/icon-sound.png": 192,
    "settings/panel-background.png": 750,
    "settings/slider-fill.png": 640,
    "settings/slider-knob.png": 144,
    "settings/slider-track-empty.png": 640,
    "settings/title-settings.png": 384,
    # 结算页。
    "settlement/button-continue.png": 640,
    "settlement/button-double-reward.png": 640,
    "settlement/reward-coin.png": 224,
    "settlement/star-filled.png": 256,
    "settlement/star-hollow.png": 256,
    "settlement/statistics-strip.png": 768,
    "settlement/victory-header.png": 900,
}


def asset_path(relative: str) -> Path:
    area, name = relative.split("/", 1)
    return ROOT / area / "materials-generated" / name


def optimize_transparent_png(path: Path, target_width: int) -> tuple[int, int]:
    before = path.stat().st_size
    with Image.open(path).convert("RGBA") as source:
        width = min(target_width, source.width)
        height = round(source.height * width / source.width)
        resized = source.resize((width, height), Image.Resampling.LANCZOS)
        indexed = resized.quantize(
            colors=256,
            method=Image.Quantize.FASTOCTREE,
            dither=Image.Dither.NONE,
        )
    temporary = path.with_name(f"{path.stem}.optimized.png")
    indexed.save(temporary, optimize=True, compress_level=9)
    temporary.replace(path)
    return before, path.stat().st_size


def optimize_background() -> tuple[int, int, Path]:
    source_path = ROOT / "homepage" / "materials-generated" / "background-clean.png"
    destination = source_path.with_suffix(".jpg")
    input_path = source_path if source_path.exists() else destination
    before = input_path.stat().st_size
    with Image.open(input_path).convert("RGB") as source:
        width = min(750, source.width)
        height = round(source.height * width / source.width)
        resized = source.resize((width, height), Image.Resampling.LANCZOS)
    temporary = destination.with_name(f"{destination.stem}.optimized.jpg")
    resized.save(
        temporary,
        format="JPEG",
        quality=88,
        subsampling=0,
        optimize=True,
        progressive=True,
    )
    temporary.replace(destination)
    if source_path.exists():
        source_path.unlink()
    return before, destination.stat().st_size, destination


def checkerboard(size: tuple[int, int], cell: int = 14) -> Image.Image:
    image = Image.new("RGB", size, "#f5eddf")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#ddd1be")
    return image


def create_preview(directory: Path) -> None:
    files = sorted(
        path
        for path in directory.glob("*.png")
        if path.name not in {"materials-preview.png", "materials-preview.jpg"}
    )
    columns = 3
    cell_width, cell_height = 300, 245
    rows = (len(files) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), "#fff9ef")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, path in enumerate(files):
        x = (index % columns) * cell_width
        y = (index // columns) * cell_height
        preview = checkerboard((cell_width - 18, cell_height - 48))
        with Image.open(path).convert("RGBA") as asset:
            asset.thumbnail((cell_width - 42, cell_height - 72), Image.Resampling.LANCZOS)
            preview_x = (preview.width - asset.width) // 2
            preview_y = (preview.height - asset.height) // 2
            preview.paste(asset, (preview_x, preview_y), asset)
        sheet.paste(preview, (x + 9, y + 9))
        draw.text((x + 11, y + cell_height - 30), path.stem, fill="#3d2a20", font=font)

    destination = directory / "materials-preview.jpg"
    sheet.save(destination, quality=84, subsampling=0, optimize=True, progressive=True)
    legacy_preview = directory / "materials-preview.png"
    if legacy_preview.exists():
        legacy_preview.unlink()


def main() -> None:
    total_before = 0
    total_after = 0
    for relative, target_width in TARGET_WIDTHS.items():
        path = asset_path(relative)
        before, after = optimize_transparent_png(path, target_width)
        total_before += before
        total_after += after
        with Image.open(path) as image:
            print(
                f"{relative}: {before / 1024:.1f} KB -> {after / 1024:.1f} KB, "
                f"{image.width}×{image.height}"
            )

    before, after, background_path = optimize_background()
    total_before += before
    total_after += after
    with Image.open(background_path) as image:
        print(
            f"homepage/{background_path.name}: {before / 1024:.1f} KB -> "
            f"{after / 1024:.1f} KB, {image.width}×{image.height}"
        )

    for area in ("homepage", "settings", "settlement"):
        create_preview(ROOT / area / "materials-generated")

    print(
        f"Static assets total: {total_before / 1024 / 1024:.2f} MB -> "
        f"{total_after / 1024 / 1024:.2f} MB"
    )


if __name__ == "__main__":
    main()
