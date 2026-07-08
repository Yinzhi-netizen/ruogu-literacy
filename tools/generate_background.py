#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用 GPT-image（images/generations 生图接口，经 hfsyapi.cn 中转站）
为「若谷星河书旅」生成首页背景星图。

配置读取 ~/.gpt-image/.env（OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL）。
用法：在 project/tools/ 目录下运行
    python generate_background.py
输出：../assets/backgrounds/07_reading_galaxy_map.png
"""

import base64
import os
import sys
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
PROJECT_DIR = HERE.parent
OUT_DIR = PROJECT_DIR / "assets" / "backgrounds"

# 默认输出文件名
DEFAULT_OUT = "07_reading_galaxy_map.png"

# 默认生图 prompt（可在此修改，也可通过环境变量 BG_PROMPT 传入）
DEFAULT_PROMPT = (
    "A panoramic ancient Chinese celestial star-map, entirely set in a vast starry river "
    "and deep indigo cosmos. A luminous path made of open book pages, golden ink strokes, "
    "and constellations winds upward and inward through space, connecting a series of "
    "glowing starfield realms one after another. The first realm near the bottom is a soft, "
    "welcoming valley of light and drifting characters, like a gentle nebula where a journey "
    "begins. Further along the path, the realms become increasingly celestial: spiral "
    "galaxies, star clusters, radiant nebulae, and a distant abstract luminous portal. "
    "The upper left should show an elegant constellation chart with connected stars and "
    "mythological star patterns, NOT concentric circles, NOT a mandala, and NOT any religious symbol. The far endpoint should be a simple glowing portal "
    "or star cluster, NOT a temple gate, archway, or religious architecture. "
    "Style: Chinese mythological fantasy, Dunhuang-inspired color palette only, "
    "Song-dynasty celestial map aesthetics, ink wash with gold leaf, ethereal clouds of stars, "
    "deep indigo and cream palette, magical atmosphere. "
    "No text, no characters, no UI elements, no religious symbols, no Buddhism, no temples, "
    "no mandalas, no lotus motifs. "
    "Landscape 16:9 composition, suitable for iPad and desktop full-screen background."
)


def load_env():
    env = Path.home() / ".gpt-image" / ".env"
    cfg = {}
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            cfg[k.strip()] = v.strip().strip('"').strip("'")
    return cfg


def generate_image(prompt: str, api_key: str, base_url: str, model: str, size: str) -> bytes:
    url = f"{base_url.rstrip('/')}/images/generations"
    headers = {"Authorization": f"Bearer {api_key}"}
    data = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "n": 1,
        "response_format": "b64_json",
    }
    resp = requests.post(
        url, headers=headers, json=data, timeout=600,
        proxies={"http": None, "https": None},
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:500]}")
    resp.raise_for_status()
    payload = resp.json()
    item = payload.get("data", [{}])[0]
    b64 = item.get("b64_json")
    if b64:
        return base64.b64decode(b64)
    img_url = item.get("url")
    if img_url:
        r = requests.get(img_url, timeout=120)
        r.raise_for_status()
        return r.content
    raise RuntimeError(f"接口没返回图片：{str(payload)[:300]}")


def main():
    cfg = load_env()
    api_key = os.environ.get("OPENAI_API_KEY") or cfg.get("OPENAI_API_KEY")
    base_url = os.environ.get("OPENAI_BASE_URL") or cfg.get("OPENAI_BASE_URL") or "https://api.openai.com/v1"
    model = os.environ.get("OPENAI_MODEL") or cfg.get("OPENAI_MODEL") or "gpt-image-2pro"

    if not api_key:
        sys.exit("找不到 OPENAI_API_KEY（~/.gpt-image/.env）")

    prompt = os.environ.get("BG_PROMPT") or DEFAULT_PROMPT
    # iPad / 电脑横版
    size = os.environ.get("BG_SIZE") or "1536x1024"
    out_name = os.environ.get("BG_OUT") or DEFAULT_OUT

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dst = OUT_DIR / out_name

    print(f"中转站：{base_url}")
    print(f"模型：{model}")
    print(f"尺寸：{size}")
    print(f"输出：{dst}\n")

    start = time.time()
    try:
        raw = generate_image(prompt, api_key, base_url, model, size)
        dst.write_bytes(raw)
        print(f"完成 {time.time()-start:.0f}s → {dst.name}")
    except Exception as e:
        print(f"失败：{e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
