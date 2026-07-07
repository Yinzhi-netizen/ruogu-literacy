#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把若谷的画（Ruogu Painting/1.jpg–11.jpg）抠图去白背景、裁边，
导出为透明 PNG 到 ../assets/heroes/。
第 11 张是地图，不抠成角色（单独复制到 ../assets/map-raw.jpg 供参考）。

用法：在 若谷冒险游戏/tools/ 目录下运行
    python cutout_heroes.py
依赖：Pillow  (pip install Pillow)
"""

import os
from PIL import Image

# ---- 路径 ----
HERE = os.path.dirname(os.path.abspath(__file__))
GAME_DIR = os.path.dirname(HERE)
# 源图在识字 App 目录下的 Ruogu Painting/
SRC_DIR = os.path.abspath(os.path.join(
    GAME_DIR, "..", "若谷自主阅读计划", "Ruogu Painting"))
OUT_DIR = os.path.join(GAME_DIR, "assets", "heroes")

# ---- 参数 ----
WHITE_THRESHOLD = 238   # R、G、B 都 >= 此值视为"白背景" → 透明
PAD = 12                # 裁边后四周留白像素
MAX_SIDE = 512          # 最长边缩放到不超过此值，控制文件大小


def make_transparent(img: Image.Image, thr: int) -> Image.Image:
    """白/近白像素转透明。"""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= thr and g >= thr and b >= thr:
                px[x, y] = (r, g, b, 0)
    return img


def autocrop(img: Image.Image, pad: int) -> Image.Image:
    """按非透明内容裁到边界，四周留 pad。"""
    bbox = img.getbbox()  # 基于 alpha 的非零区域
    if not bbox:
        return img
    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(img.width, right + pad)
    bottom = min(img.height, bottom + pad)
    return img.crop((left, top, right, bottom))


def downscale(img: Image.Image, max_side: int) -> Image.Image:
    w, h = img.size
    m = max(w, h)
    if m <= max_side:
        return img
    scale = max_side / m
    return img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    if not os.path.isdir(SRC_DIR):
        raise SystemExit(f"找不到源图目录：{SRC_DIR}")

    made = []
    for i in range(1, 12):
        src = os.path.join(SRC_DIR, f"{i}.jpg")
        if not os.path.exists(src):
            print(f"跳过（缺失）：{src}")
            continue

        if i == 11:
            # 第 11 张是地图，保留原样供后续参考/重绘
            img = Image.open(src).convert("RGB")
            img = downscale(img, 1600)
            dst = os.path.join(GAME_DIR, "assets", "map-raw.jpg")
            img.save(dst, quality=88)
            print(f"地图参考图 → {dst}")
            continue

        img = Image.open(src)
        img = make_transparent(img, WHITE_THRESHOLD)
        img = autocrop(img, PAD)
        img = downscale(img, MAX_SIDE)
        dst = os.path.join(OUT_DIR, f"hero-{i}.png")
        img.save(dst)
        made.append(os.path.basename(dst))
        print(f"抠图 → {dst}  ({img.width}x{img.height})")

    print(f"\n完成，共 {len(made)} 个角色：{', '.join(made)}")


if __name__ == "__main__":
    main()
