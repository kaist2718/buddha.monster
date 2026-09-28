#!/usr/bin/env python3
"""아이콘(PNG) + 소셜 공유 카드(og.png) 생성기.

icon.svg 와 같은 도안(금빛 둥근 사각형 + 法 문자 + 연꽃 무늬)을 PNG 로 굽습니다.
iOS 홈 화면(apple-touch-icon)과 소셜 미리보기(og.png)는 SVG 를 쓰지 않으므로
래스터 이미지가 필요합니다.

생성물 (저장소 루트):
  icon-192.png            일반 아이콘 (둥근 모서리)
  icon-512.png            일반 아이콘
  icon-maskable-512.png   마스커블 — 원형으로 잘라도 안전하도록 꽉 찬 사각형
  apple-touch-icon.png    iOS 홈 화면 (180px, 꽉 찬 사각형)
  og.png                  소셜 공유 카드 (1200×630)

실행:  python tools/make-icons.py
필요 환경: Python 3 + Pillow. 생성물은 저장소에 함께 커밋합니다.
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover
    print("Pillow 가 필요합니다:  python -m pip install pillow", file=sys.stderr)
    raise SystemExit(1)

ROOT = Path(__file__).resolve().parent.parent
FONT_PATH = ROOT / ".cache" / "PretendardVariable.ttf"

ACCENT = (0x9A, 0x6B, 0x2F)
ACCENT_DK = (0x7A, 0x52, 0x22)
CREAM = (0xFD, 0xF6, 0xEA)
BG_WARM = (0x1D, 0x18, 0x11)


def rounded_bg(size: int, radius: int, filled: bool) -> Image.Image:
    """filled=True 면 꽉 찬 사각형(마스커블·apple-touch), False 면 둥근 모서리."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    box = (0, 0, size - 1, size - 1)
    if filled:
        d.rectangle(box, fill=ACCENT + (255,))
    else:
        d.rounded_rectangle(box, radius=radius, fill=ACCENT + (255,), corners=(True, True, True, True))
    # 은은한 아래 그라데이션 느낌 — 사각 밴드
    d.rounded_rectangle((size * 0.06, size * 0.52, size * 0.94, size * 0.94),
                        radius=radius // 2, fill=ACCENT_DK + (90,))
    return img


def draw_glyph(img: Image.Image, char: str = "法", ratio: float = 0.52) -> None:
    d = ImageDraw.Draw(img)
    size = img.size[0]
    try:
        font = ImageFont.truetype(str(FONT_PATH), int(size * ratio))
    except OSError:
        font = ImageFont.load_default()
    bbox = d.textbbox((0, 0), char, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), char, font=font, fill=CREAM)


def draw_lotus(img: Image.Image, cx: float, cy: float, scale: float) -> None:
    """icon.svg 의 연꽃 무늬 — 세 겹의 활꼴."""
    d = ImageDraw.Draw(img)
    s = scale
    stroke = max(2, int(scale * 0.14))
    for k in (1.0, 0.72, 0.46):
        w = s * k
        h = s * k * 0.62
        d.arc((cx - w, cy - h, cx + w, cy + h), start=0, end=180, fill=CREAM, width=stroke)


def make_icons() -> None:
    # icon-192 / icon-512 — 둥근 모서리 + 法
    for out, size in (("icon-192.png", 192), ("icon-512.png", 512)):
        img = rounded_bg(size, int(size * 0.22), filled=False)
        draw_glyph(img, "法", 0.5)
        img.save(ROOT / out, "PNG", optimize=True)
        print(f"→ {out}")

    # maskable — 안드로이드가 원형으로 잘라도 안전하게, 여백 최소
    img = rounded_bg(512, 0, filled=True)
    draw_glyph(img, "法", 0.38)
    draw_lotus(img, 256, 400, 150)
    img.save(ROOT / "icon-maskable-512.png", "PNG", optimize=True)
    print("→ icon-maskable-512.png")

    # apple-touch-icon — 꽉 찬 사각형 (iOS 가 직접 둥글게 자릅니다)
    img = rounded_bg(180, 0, filled=True)
    draw_glyph(img, "法", 0.5)
    img.save(ROOT / "apple-touch-icon.png", "PNG", optimize=True)
    print("→ apple-touch-icon.png")


def make_og() -> None:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BG_WARM)
    d = ImageDraw.Draw(img)

    # 배경 — 오른쪽 위 금빛 광원
    for i in range(H):
        t = i / H
        col = tuple(int(BG_WARM[c] + (0x2B - BG_WARM[c]) * t * 0.55) for c in range(3))
        d.line((0, i, W, i), fill=col)
    d.ellipse((W - 520, -240, W + 180, 420), fill=(0x2E, 0x24, 0x18))
    d.ellipse((W - 420, -180, W + 80, 320), fill=(0x3A, 0x2C, 0x1C))

    # 왼쪽 상단 — 法 마크
    mark = rounded_bg(120, 26, filled=True)
    draw_glyph(mark, "法", 0.56)
    img.paste(mark, (72, 64), mark)

    # 워드마크·제목
    try:
        f_small = ImageFont.truetype(str(FONT_PATH), 34)
        f_title = ImageFont.truetype(str(FONT_PATH), 84)
        f_sub = ImageFont.truetype(str(FONT_PATH), 36)
    except OSError:
        f_small = f_title = f_sub = ImageFont.load_default()

    d.text((212, 84), "법구경 · Dhammapada · 26품 423게송", font=f_small, fill=(0xC2, 0xB3, 0x9C))
    d.text((72, 240), "마음의 괴물을 다스리는 부처님", font=f_title, fill=CREAM)
    d.text((72, 368), "— 마음을 다스리는 부처님처럼 살기", font=f_sub, fill=(0xD8, 0xC8, 0xAE))
    d.text((72, 428), "법구경(Dhammapada) 영어·한국어 대역 전문", font=f_sub, fill=(0xB8, 0xA6, 0x8C))

    # 하단 — 주소
    d.line((72, 500, 420, 500), fill=ACCENT, width=5)
    d.text((72, 528), "buddha.monster", font=f_sub, fill=ACCENT)

    img.save(ROOT / "og.png", "PNG", optimize=True, compress_level=9)
    print("→ og.png (1200×630)")


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    make_icons()
    make_og()
