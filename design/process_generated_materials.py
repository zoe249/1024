from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
GENERATED_DIRS = (
    ROOT / "homepage" / "materials-generated",
    ROOT / "settings" / "materials-generated",
    ROOT / "settlement" / "materials-generated",
)


def trim_transparent_image(path: Path, padding: int = 12) -> None:
    """按透明通道紧边裁切，并保留少量安全边距。"""
    with Image.open(path).convert("RGBA") as image:
        alpha = image.getchannel("A").point(lambda value: 0 if value <= 12 else value)
        image.putalpha(alpha)
        alpha = image.getchannel("A")
        bbox = alpha.getbbox()
        if bbox is None:
            return
        left = max(0, bbox[0] - padding)
        top = max(0, bbox[1] - padding)
        right = min(image.width, bbox[2] + padding)
        bottom = min(image.height, bbox[3] + padding)
        image.crop((left, top, right, bottom)).save(path)


def checkerboard(size: tuple[int, int], cell: int = 16) -> Image.Image:
    image = Image.new("RGB", size, "#f6efe3")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#ded4c4")
    return image


def create_contact_sheet(directory: Path) -> None:
    files = sorted(
        path
        for path in directory.glob("*.png")
        if path.name not in {"background-clean.png", "materials-preview.png"}
    )
    if not files:
        return

    columns = 3
    cell_width, cell_height = 360, 290
    rows = (len(files) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), "#fff9ef")
    font = ImageFont.load_default()
    draw = ImageDraw.Draw(sheet)

    for index, path in enumerate(files):
        x = (index % columns) * cell_width
        y = (index // columns) * cell_height
        preview = checkerboard((cell_width - 20, cell_height - 54))
        with Image.open(path).convert("RGBA") as asset:
            asset.thumbnail((cell_width - 48, cell_height - 82), Image.Resampling.LANCZOS)
            preview_x = (preview.width - asset.width) // 2
            preview_y = (preview.height - asset.height) // 2
            preview.paste(asset, (preview_x, preview_y), asset)
        sheet.paste(preview, (x + 10, y + 10))
        draw.text((x + 12, y + cell_height - 34), path.stem, fill="#3d2a20", font=font)

    sheet.save(directory / "materials-preview.png")


def main() -> None:
    for directory in GENERATED_DIRS:
        for path in directory.glob("*.png"):
            if path.name in {"background-clean.png", "materials-preview.png"}:
                continue
            trim_transparent_image(path)
        create_contact_sheet(directory)
        print(f"Processed: {directory}")


if __name__ == "__main__":
    main()
