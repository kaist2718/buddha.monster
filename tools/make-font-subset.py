#!/usr/bin/env python3
"""본문 서체(Pretendard Variable) 서브셋 생성기.

1) node tools/font-charset.mjs --out .cache/charset.txt 로 사이트 글자 집합을 받습니다.
2) 그 글자만 남겨 assets/fonts/pretendard-variable.woff2 를 만듭니다(가변 축 유지).
3) 폰트가 실제로 담은 글자 목록을 assets/fonts/charset.json 에 적습니다.

필요 환경: Python 3 + fontTools + brotli.
원본 폰트: .cache/PretendardVariable.ttf (Pretendard v1.3.9, SIL OFL 1.1)
"""
import json
import os
import subprocess
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT, ".cache")
SOURCE_FONT = os.path.join(CACHE_DIR, "PretendardVariable.ttf")
CHARSET_TXT = os.path.join(CACHE_DIR, "charset.txt")
OUT_FONT = os.path.join(ROOT, "assets", "fonts", "pretendard-variable.woff2")
OUT_META = os.path.join(ROOT, "assets", "fonts", "charset.json")
SOURCE_VERSION = "v1.3.9"
SOURCE_URL = (
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9"
    "/packages/pretendard/dist/public/variable/PretendardVariable.ttf"
)
LAYOUT_FEATURES = "kern,liga,calt,ccmp,mark,mkmk,rlig,clig,locl"


def codepoints_to_ranges(codepoints):
    ranges = []
    for cp in sorted(codepoints):
        if ranges and cp == ranges[-1][1] + 1:
            ranges[-1][1] = cp
        else:
            ranges.append([cp, cp])
    return [f"{a:x}" if a == b else f"{a:x}-{b:x}" for a, b in ranges]


def main():
    if not os.path.exists(SOURCE_FONT):
        sys.exit(f"원본 폰트가 없습니다: {SOURCE_FONT}")
    subprocess.run(
        ["node", os.path.join(ROOT, "tools", "font-charset.mjs"), "--out", CHARSET_TXT],
        check=True, cwd=ROOT,
    )
    with open(CHARSET_TXT, encoding="utf-8") as f:
        codepoints = [int(tok, 16) for tok in f.read().replace("\n", "").split(",") if tok.strip()]

    os.makedirs(os.path.dirname(OUT_FONT), exist_ok=True)
    subprocess.run(
        [
            sys.executable, "-m", "fontTools.subset", SOURCE_FONT,
            f"--unicodes-file={CHARSET_TXT}",
            "--layout-features=" + LAYOUT_FEATURES,
            "--flavor=woff2",
            f"--output-file={OUT_FONT}",
        ],
        check=True, cwd=ROOT,
    )

    from fontTools.ttLib import TTFont
    font = TTFont(OUT_FONT)
    cmap = font.getBestCmap()
    covered = sorted(cmap.keys())
    bytes_ = os.path.getsize(OUT_FONT)
    meta = {
        "family": "Pretendard Variable",
        "source": SOURCE_URL,
        "version": SOURCE_VERSION,
        "file": "assets/fonts/pretendard-variable.woff2",
        "bytes": bytes_,
        "glyphs": font["maxp"].numGlyphs,
        "covered": codepoints_to_ranges(covered),
    }
    with open(OUT_META, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"서브셋 완료: {os.path.relpath(OUT_FONT, ROOT)} ({bytes_} bytes, 글자 {len(covered)})")


if __name__ == "__main__":
    main()
