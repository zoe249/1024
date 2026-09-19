#!/usr/bin/env python3
"""检查 1024 项目 UI PNG 的像素、透明通道和文件体积。"""

from __future__ import annotations

import argparse
import struct
import sys
from dataclasses import dataclass
from pathlib import Path


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


@dataclass(frozen=True)
class Profile:
    max_width: int
    max_height: int
    max_bytes: int
    exact_size: tuple[int, int] | None = None
    require_alpha: bool = True


PROFILES = {
    "rank-icon": Profile(88, 96, 16 * 1024, exact_size=(88, 96)),
    "ui-icon": Profile(256, 256, 64 * 1024),
    "row-strip": Profile(650, 96, 32 * 1024, exact_size=(650, 96)),
    "button": Profile(640, 228, 96 * 1024),
    "panel": Profile(750, 1200, 256 * 1024),
    "header": Profile(720, 384, 128 * 1024),
}


def read_png_info(path: Path) -> tuple[int, int, bool, int]:
    data = path.read_bytes()
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError("不是有效的 PNG 文件")

    offset = len(PNG_SIGNATURE)
    width = height = color_type = None
    has_trns = False

    while offset + 12 <= len(data):
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        chunk_type = data[offset + 4 : offset + 8]
        chunk_data = data[offset + 8 : offset + 8 + length]
        offset += 12 + length

        if chunk_type == b"IHDR":
            width, height, _depth, color_type, _compression, _filter, _interlace = struct.unpack(
                ">IIBBBBB", chunk_data
            )
        elif chunk_type == b"tRNS":
            has_trns = True
        elif chunk_type == b"IEND":
            break

    if width is None or height is None or color_type is None:
        raise ValueError("PNG 缺少 IHDR")

    has_alpha = color_type in (4, 6) or has_trns
    return width, height, has_alpha, len(data)


def validate(path: Path, profile: Profile) -> list[str]:
    errors: list[str] = []
    try:
        width, height, has_alpha, byte_size = read_png_info(path)
    except (OSError, ValueError, struct.error) as error:
        return [str(error)]

    if profile.exact_size and (width, height) != profile.exact_size:
        errors.append(f"像素必须为 {profile.exact_size[0]}x{profile.exact_size[1]}，当前为 {width}x{height}")
    elif width > profile.max_width or height > profile.max_height:
        errors.append(
            f"像素超限：{width}x{height}，上限为 {profile.max_width}x{profile.max_height}"
        )

    if byte_size > profile.max_bytes:
        errors.append(f"文件超限：{byte_size} bytes，上限为 {profile.max_bytes} bytes")
    if profile.require_alpha and not has_alpha:
        errors.append("缺少 Alpha/透明信息")

    size_kb = byte_size / 1024
    alpha_text = "yes" if has_alpha else "no"
    print(f"{path}: {width}x{height}, {size_kb:.1f} KB, alpha={alpha_text}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=sorted(PROFILES), required=True)
    parser.add_argument("files", nargs="+", type=Path)
    args = parser.parse_args()

    failed = False
    profile = PROFILES[args.profile]
    for path in args.files:
        errors = validate(path, profile)
        if errors:
            failed = True
            for error in errors:
                print(f"  FAIL: {error}", file=sys.stderr)
        else:
            print("  PASS")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
