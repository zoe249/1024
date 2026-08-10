from __future__ import annotations

from collections import deque
from math import ceil, pi, sin
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent / "materials-generated" / "animations"
FRAME_SIZE = (384, 512)
DURATIONS_MS = {
    "bear-blowing": 85,
    "bird-flapping": 65,
    "dandelion-drifting": 75,
}
BIRD_BOB_OFFSETS = (-1, -2, -3, -2, 0, 2, 3, 2, 0, -2, -3, -2, 0, 2, 1, 0)


def checkerboard(size: tuple[int, int], cell: int = 20) -> Image.Image:
    image = Image.new("RGB", size, "#f4eddf")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#ddd1be")
    return image


def clean_low_alpha(image: Image.Image) -> Image.Image:
    """清除色键处理后几乎不可见的残余像素，同时保留抗锯齿边缘。"""
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A").point(lambda value: 0 if value <= 12 else value)
    rgba.putalpha(alpha)
    return rgba


def connected_components(image: Image.Image, minimum_area: int = 10) -> list[list[tuple[int, int]]]:
    mask = np.asarray(image.convert("RGBA"))[:, :, 3] > 12
    visited = np.zeros(mask.shape, dtype=bool)
    height, width = mask.shape
    components: list[list[tuple[int, int]]] = []

    for start_y, start_x in np.argwhere(mask):
        if visited[start_y, start_x]:
            continue
        queue: deque[tuple[int, int]] = deque([(int(start_y), int(start_x))])
        component: list[tuple[int, int]] = []
        while queue:
            y, x = queue.popleft()
            if visited[y, x] or not mask[y, x]:
                continue
            visited[y, x] = True
            component.append((y, x))
            if x > 0:
                queue.append((y, x - 1))
            if x + 1 < width:
                queue.append((y, x + 1))
            if y > 0:
                queue.append((y - 1, x))
            if y + 1 < height:
                queue.append((y + 1, x))
        if len(component) >= minimum_area:
            components.append(component)
    return components


def remove_small_border_components(image: Image.Image, max_area: int = 20_000) -> Image.Image:
    """移除跨格生成时落在边缘的小碎片，并保留接触边缘的主体。"""
    rgba = np.asarray(image.convert("RGBA")).copy()
    height, width = rgba.shape[:2]
    for component in connected_components(image):
        touches_border = any(
            x == 0 or y == 0 or x == width - 1 or y == height - 1 for y, x in component
        )
        if touches_border and len(component) < max_area:
            ys, xs = zip(*component)
            rgba[np.asarray(ys), np.asarray(xs), 3] = 0
    return Image.fromarray(rgba, mode="RGBA")


def keep_largest_component(image: Image.Image) -> Image.Image:
    """保留完整角色主体，清除无间隔图集跨格产生的相邻角色碎片。"""
    rgba = np.asarray(image.convert("RGBA")).copy()
    components = connected_components(image)
    if not components:
        return image.convert("RGBA")
    largest = max(components, key=len)
    keep = np.zeros(rgba.shape[:2], dtype=bool)
    ys, xs = zip(*largest)
    keep[np.asarray(ys), np.asarray(xs)] = True
    rgba[~keep, 3] = 0
    return Image.fromarray(rgba, mode="RGBA")


def add_safe_padding(image: Image.Image, scale: float, align_bottom: bool) -> Image.Image:
    """统一缩放整帧，为动作极值预留边缘安全区并保持锚点稳定。"""
    width = round(image.width * scale)
    height = round(image.height * scale)
    resized = image.resize((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", image.size, (0, 0, 0, 0))
    x = (image.width - width) // 2
    y = image.height - height if align_bottom else (image.height - height) // 2
    canvas.paste(resized, (x, y), resized)
    return clean_low_alpha(canvas)


def split_4x2_atlas(path: Path) -> list[Image.Image]:
    with Image.open(path) as source:
        atlas = clean_low_alpha(source)
    if atlas.width % 4 or atlas.height % 2:
        raise ValueError(f"{path} 不是可均分的 4×2 图集")
    width = atlas.width // 4
    height = atlas.height // 2
    return [
        atlas.crop(
            (
                (index % 4) * width,
                (index // 4) * height,
                (index % 4 + 1) * width,
                (index // 4 + 1) * height,
            )
        )
        for index in range(8)
    ]


def translate_frame(image: Image.Image, offset_x: int, offset_y: int) -> Image.Image:
    canvas = Image.new("RGBA", image.size, (0, 0, 0, 0))
    canvas.paste(image, (offset_x, offset_y), image)
    return clean_low_alpha(canvas)


def bird_beak_center(image: Image.Image) -> tuple[float, float]:
    """以橙色鸟喙作为稳定参考，避免翅膀姿态改变包围盒中心。"""
    rgba = np.asarray(image.convert("RGBA"))
    red, green, blue, alpha = [rgba[:, :, index] for index in range(4)]
    mask = (alpha > 100) & (red > 160) & (green > 60) & (green < 190) & (blue < 100)
    mask_image = Image.new("RGBA", image.size, (0, 0, 0, 0))
    mask_image.putalpha(Image.fromarray(mask.astype(np.uint8) * 255, mode="L"))
    candidates = []
    for component in connected_components(mask_image, minimum_area=60):
        ys, xs = zip(*component)
        center_x = float(sum(xs) / len(xs))
        center_y = float(sum(ys) / len(ys))
        if center_x < image.width * 0.45:
            candidates.append((center_x, center_y))
    if not candidates:
        raise ValueError("未识别到小鸟鸟喙锚点")
    return min(candidates, key=lambda center: center[0])


def normalize_character_anchor(image: Image.Image, name: str, frame_index: int) -> Image.Image:
    alpha = np.asarray(image.getchannel("A"))
    ys, xs = np.nonzero(alpha > 12)
    if name == "bear-blowing":
        center_x = (float(xs.min()) + float(xs.max())) / 2
        bottom = float(ys.max())
        return translate_frame(image, round(192 - center_x), round(490 - bottom))

    beak_x, beak_y = bird_beak_center(image)
    target_y = 250 + BIRD_BOB_OFFSETS[frame_index]
    return translate_frame(image, round(62 - beak_x), round(target_y - beak_y))


def build_character_frames(name: str) -> list[Image.Image]:
    directory = ROOT / name
    keys = split_4x2_atlas(directory / "key-atlas-source.png")
    inbetweens = split_4x2_atlas(directory / "inbetween-atlas-source.png")
    align_bottom = name == "bear-blowing"
    raw_frames: list[Image.Image] = []
    for index in range(8):
        raw_frames.extend((keys[index], inbetweens[index]))

    if name == "bear-blowing":
        # 首尾姿势完全一致，形成短暂停顿并避免生成式中间帧的嘴部变形。
        raw_frames[-1] = keys[0]

    frames: list[Image.Image] = []
    for index, frame in enumerate(raw_frames):
        if name == "bird-flapping":
            frame = keep_largest_component(frame)
        frame = add_safe_padding(frame, scale=0.90, align_bottom=align_bottom)
        frames.append(normalize_character_anchor(frame, name, index))

    if name == "bird-flapping":
        # 鸟喙不参与动作，复用稳定贴片，避免跨格生成造成的边缘缺口。
        patch_box = (30, 210, 100, 290)
        stable_patch = frames[0].crop(patch_box)
        base_y = patch_box[1]
        for index, frame in enumerate(frames):
            y = base_y + BIRD_BOB_OFFSETS[index] - BIRD_BOB_OFFSETS[0]
            frame.paste(stable_patch, (patch_box[0], y), stable_patch)
    return frames


def extract_seed_sprites(path: Path) -> list[Image.Image]:
    with Image.open(path) as source:
        image = clean_low_alpha(source)
    components = sorted(connected_components(image, minimum_area=500), key=len, reverse=True)[:7]
    if len(components) != 7:
        raise ValueError(f"{path} 未识别到 7 颗蒲公英种子")

    sprites: list[Image.Image] = []
    for component in components:
        ys, xs = zip(*component)
        left, top = max(0, min(xs) - 3), max(0, min(ys) - 3)
        right, bottom = min(image.width, max(xs) + 4), min(image.height, max(ys) + 4)
        sprites.append(image.crop((left, top, right, bottom)))
    return sprites


def build_dandelion_frames() -> list[Image.Image]:
    """使用固定粒子沿闭合 S 曲线运动，避免逐帧随机生成造成闪现。"""
    directory = ROOT / "dandelion-drifting"
    sprites = extract_seed_sprites(directory / "seed-source-frame.png")
    bases = [(72, 92), (190, 82), (306, 105), (96, 250), (266, 240), (85, 405), (286, 405)]
    amplitudes = [(20, 26), (28, 18), (20, 28), (26, 34), (30, 22), (18, 24), (22, 26)]
    phases = [0.0, 0.7, 1.5, 2.2, 3.1, 4.0, 5.1]
    frames: list[Image.Image] = []

    for frame_index in range(32):
        progress = 2 * pi * frame_index / 32
        frame = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
        for index, sprite in enumerate(sprites):
            phase = phases[index]
            amplitude_x, amplitude_y = amplitudes[index]
            center_x = bases[index][0] + amplitude_x * sin(progress + phase)
            center_y = bases[index][1] + amplitude_y * sin(2 * progress + phase * 0.65)
            angle = 10 * sin(progress + phase * 1.15)
            rotated = sprite.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
            x = round(center_x - rotated.width / 2)
            y = round(center_y - rotated.height / 2)
            frame.paste(rotated, (x, y), rotated)
        frames.append(clean_low_alpha(frame))
    return frames


def compose_atlas(frames: list[Image.Image], columns: int = 4) -> Image.Image:
    rows = ceil(len(frames) / columns)
    atlas = Image.new("RGBA", (FRAME_SIZE[0] * columns, FRAME_SIZE[1] * rows), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        atlas.paste(frame, ((index % columns) * FRAME_SIZE[0], (index // columns) * FRAME_SIZE[1]), frame)
    return atlas


def save_animation(name: str, frames: list[Image.Image]) -> None:
    directory = ROOT / name
    frames_directory = directory / "frames"
    frames_directory.mkdir(parents=True, exist_ok=True)
    for old_frame in frames_directory.glob("frame-*.png"):
        old_frame.unlink()
    for index, frame in enumerate(frames):
        frame.save(frames_directory / f"frame-{index:02d}.png")

    atlas = compose_atlas(frames)
    atlas.save(directory / "atlas.png")
    preview_sheet = checkerboard(atlas.size)
    preview_sheet.paste(atlas, (0, 0), atlas)
    preview_sheet.save(directory / "preview-sheet.png")

    gif_frames: list[Image.Image] = []
    for frame in frames:
        background = Image.new("RGB", FRAME_SIZE, "#48bce8")
        background.paste(frame, (0, 0), frame)
        gif_frames.append(background)
    gif_frames[0].save(
        directory / "preview.gif",
        save_all=True,
        append_images=gif_frames[1:],
        duration=DURATIONS_MS[name],
        loop=0,
        disposal=2,
        optimize=False,
    )
    print(f"{name}: {len(frames)} frames, {FRAME_SIZE[0]}×{FRAME_SIZE[1]}")


def main() -> None:
    save_animation("bear-blowing", build_character_frames("bear-blowing"))
    save_animation("bird-flapping", build_character_frames("bird-flapping"))
    save_animation("dandelion-drifting", build_dandelion_frames())


if __name__ == "__main__":
    main()
