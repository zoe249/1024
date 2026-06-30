#!/usr/bin/env python3

"""生成微信启动页文字图片。

启动阶段不再依赖 wx.createOffscreenCanvas 绘制中文，避免部分微信基础库或设备
无法将离屏 2D Canvas 上传到 WebGL，导致“初始化中”和健康游戏忠告不可见。
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
FONT_CANDIDATES = (
    Path("/System/Library/Fonts/STHeiti Medium.ttc"),
    Path("/System/Library/Fonts/Supplemental/Songti.ttc"),
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
    image.save(SCRIPT_DIRECTORY / "loading-label.png", optimize=True)


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

    image.save(SCRIPT_DIRECTORY / "health-advice.png", optimize=True)


def main() -> None:
    """生成启动页使用的全部文字图片。"""

    font_path = find_font()
    create_loading_label(font_path)
    create_health_advice(font_path)
    print(f"启动页文字图片已生成：{SCRIPT_DIRECTORY}")


if __name__ == "__main__":
    main()
