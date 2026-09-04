from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SHARE_CARD = PROJECT_ROOT / "assets" / "resources" / "Share" / "share-card-rabbit.png"
VICTORY_HEADER = PROJECT_ROOT / "assets" / "resources" / "Settlement" / "victory-header.png"
LEADERBOARD_DIR = PROJECT_ROOT / "assets" / "resources" / "Leaderboard"
SPLASH_BACKGROUND = PROJECT_ROOT / "settings" / "first-entry-splash-v2.jpg"
SWING_BACKGROUND = (
    PROJECT_ROOT
    / "assets"
    / "resources"
    / "Homepage"
    / "SwingV14"
    / "background-tree-branch.jpg"
)


def quantize_png(source: Image.Image, colors: int) -> Image.Image:
    """按是否含透明像素选择量化算法，保留 UI 素材的 Alpha 边缘。"""
    rgba = source.convert("RGBA")
    alpha = rgba.getchannel("A")
    if alpha.getextrema() == (255, 255):
        return rgba.convert("RGB").quantize(
            colors=colors,
            method=Image.Quantize.MEDIANCUT,
            dither=Image.Dither.NONE,
        )
    return rgba.quantize(
        colors=colors,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.NONE,
    )


def optimize_file(
    source_path: Path,
    output_path: Path,
    colors: int,
    target_size: tuple[int, int] | None = None,
) -> tuple[int, int]:
    before = source_path.stat().st_size
    with Image.open(source_path) as source:
        image = source.convert("RGBA")
        if target_size is not None and image.size != target_size:
            image = image.resize(target_size, Image.Resampling.LANCZOS)
        optimized = quantize_png(image, colors)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    optimized.save(output_path, "PNG", optimize=True, compress_level=9)
    return before, output_path.stat().st_size


def optimize_jpeg(
    source_path: Path,
    output_path: Path,
    quality: int,
    target_size: tuple[int, int] | None = None,
) -> tuple[int, int]:
    """重编码全屏背景；保持设计尺寸，仅将超出 750px 的旧背景缩到实际显示宽度。"""
    before = source_path.stat().st_size
    with Image.open(source_path) as source:
        image = source.convert("RGB")
        if target_size is not None and image.size != target_size:
            image = image.resize(target_size, Image.Resampling.LANCZOS)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(
        output_path,
        "JPEG",
        quality=quality,
        optimize=True,
        progressive=True,
        subsampling=2,
    )
    return before, output_path.stat().st_size


def create_candidates(output_root: Path) -> list[tuple[Path, Path, int, int]]:
    jobs: list[tuple[Path, Path, int, int]] = []

    share_output = output_root / "Share" / SHARE_CARD.name
    before, after = optimize_file(SHARE_CARD, share_output, 160, (600, 480))
    jobs.append((SHARE_CARD, share_output, before, after))

    victory_output = output_root / "Settlement" / VICTORY_HEADER.name
    before, after = optimize_file(VICTORY_HEADER, victory_output, 160)
    jobs.append((VICTORY_HEADER, victory_output, before, after))

    for source_path in sorted(LEADERBOARD_DIR.glob("*.png")):
        output_path = output_root / "Leaderboard" / source_path.name
        before, after = optimize_file(source_path, output_path, 128)
        jobs.append((source_path, output_path, before, after))

    jpeg_jobs = (
        (SPLASH_BACKGROUND, output_root / "Settings" / SPLASH_BACKGROUND.name, 74, None),
        (
            SWING_BACKGROUND,
            output_root / "Homepage" / "SwingV14" / SWING_BACKGROUND.name,
            76,
            (750, 1625),
        ),
    )
    for source_path, output_path, quality, target_size in jpeg_jobs:
        before, after = optimize_jpeg(source_path, output_path, quality, target_size)
        jobs.append((source_path, output_path, before, after))

    return jobs


def replace_runtime_files(jobs: list[tuple[Path, Path, int, int]]) -> None:
    for source_path, candidate_path, _, _ in jobs:
        temporary_path = source_path.with_name(
            f"{source_path.stem}.package-optimized{source_path.suffix}"
        )
        temporary_path.write_bytes(candidate_path.read_bytes())
        temporary_path.replace(source_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="压缩可选 UI 的运行时 PNG，降低微信主包体积")
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / "tmp" / "package-optimization-preview",
        help="候选图片输出目录",
    )
    parser.add_argument("--apply", action="store_true", help="验证候选图后覆盖 assets 中的运行时副本")
    args = parser.parse_args()

    jobs = create_candidates(args.output.resolve())
    if args.apply:
        replace_runtime_files(jobs)

    before_total = sum(job[2] for job in jobs)
    after_total = sum(job[3] for job in jobs)
    for source_path, _, before, after in jobs:
        relative = source_path.relative_to(PROJECT_ROOT)
        print(f"{relative}: {before} -> {after} bytes")
    print(f"TOTAL: {before_total} -> {after_total} bytes")
    print(f"SAVED: {before_total - after_total} bytes ({(1 - after_total / before_total) * 100:.1f}%)")
    print("APPLIED" if args.apply else f"PREVIEW: {args.output.resolve()}")


if __name__ == "__main__":
    main()
