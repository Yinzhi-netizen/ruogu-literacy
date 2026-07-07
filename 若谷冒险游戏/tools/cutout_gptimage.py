#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用 GPT-image（images/edits 编辑接口，经 hfsyapi.cn 中转站）
把若谷的画去背景、保留原画线条，导出透明 PNG 到 ../assets/heroes/。

要点：这是"编辑"而不是"重画"——把原图作为 image 传上去，
prompt 只要求去掉白背景、保持画面内容完全不变，从而保留若谷自己的笔触。

配置读取 ~/.gpt-image/.env（OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL）。
用法：在 若谷冒险游戏/tools/ 目录下运行
    python cutout_gptimage.py
依赖：requests
"""

import base64
import mimetypes
import os
import sys
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
GAME_DIR = HERE.parent
SRC_DIR = (GAME_DIR.parent / "若谷自主阅读计划" / "Ruogu Painting").resolve()
OUT_DIR = GAME_DIR / "assets" / "heroes"

# 抠图 prompt：只去背景，保持原画不变
EDIT_PROMPT = (
    "Remove the background of this child's drawing and make it fully transparent. "
    "Keep the drawn character/figure EXACTLY as it is — do not redraw, restyle, "
    "smooth, or add anything. Preserve every original line, color and stroke. "
    "Output only the character cleanly cut out on a transparent background, "
    "centered, with a little padding."
)

# 哪些图作为角色抠图（11 是地图，跳过）
HERO_INDEXES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]


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


def edit_image(src_path: Path, api_key: str, base_url: str, model: str) -> bytes:
    url = f"{base_url.rstrip('/')}/images/edits"
    mime = mimetypes.guess_type(str(src_path))[0] or "image/jpeg"
    with src_path.open("rb") as fh:
        files = {"image": (src_path.name, fh, mime)}
        data = {
            "model": model,
            "prompt": EDIT_PROMPT,
            "size": "1024x1024",
            "background": "transparent",
            "n": "1",
        }
        headers = {"Authorization": f"Bearer {api_key}"}
        resp = requests.post(
            url, headers=headers, files=files, data=data, timeout=600,
            proxies={"http": None, "https": None},
        )
    if resp.status_code >= 400:
        # 把中转站返回的具体错误打出来，方便诊断
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
    if not SRC_DIR.is_dir():
        sys.exit(f"找不到源图目录：{SRC_DIR}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"中转站：{base_url}  模型：{model}")
    print(f"源图：{SRC_DIR}\n输出：{OUT_DIR}\n")

    ok, fail = [], []
    for i in HERO_INDEXES:
        src = SRC_DIR / f"{i}.jpg"
        dst = OUT_DIR / f"hero-{i}.png"
        if not src.exists():
            print(f"[跳过] 缺图 {src.name}")
            continue
        if dst.exists():
            print(f"[已存在] {dst.name}")
            ok.append(i)
            continue
        print(f"[{i}] 抠图中 {src.name} ...", flush=True)
        start = time.time()
        try:
            raw = edit_image(src, api_key, base_url, model)
            dst.write_bytes(raw)
            print(f"[{i}] 完成 {time.time()-start:.0f}s → {dst.name}")
            ok.append(i)
        except Exception as e:
            print(f"[{i}] 失败：{e}")
            fail.append(i)

    print(f"\n完成 {len(ok)} 个：{ok}")
    if fail:
        print(f"失败 {len(fail)} 个：{fail}")


if __name__ == "__main__":
    main()
