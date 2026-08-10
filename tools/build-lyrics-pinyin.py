#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
补齐 reading-texts.js 里 lyrics（歌词）每首的 py 拼音表。

阅读关会把「识字库以外的字」标黄底并注拼音，拼音就取自每首歌的 py:{字:拼音}。
歌词生字多，手敲容易漏，这个脚本自动算：

    python tools/build-lyrics-pinyin.py            # 只检查，报告缺哪些字
    python tools/build-lyrics-pinyin.py --write    # 直接改写 reading-texts.js

多音字由 pypinyin 按上下文判断，但它不是万无一失（「长」「行」「乐」「重」这类
要自己复核）。改写后脚本会把所有多音字候选列出来，照着核一遍。

依赖：pypinyin（pip install pypinyin）、node（用来读 JS 里的数据）
"""

import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "reading-texts.js")

# 用 node 把 JS 里的数据读出来：识字库字集 + 歌词各首的标题和正文
DUMP_JS = r"""
global.window = {};
require('./grade1-words.js');
require('./pinyin-data.js');
require('./word-data.js');
require('./reading-texts.js');
const DATA = window.RUOGU_WORD_DATA;
const lyrics = (window.RUOGU_READING_TEXTS || {}).lyrics || [];
process.stdout.write(JSON.stringify({
  libChars: [...DATA.LIB_CHARS],
  lyrics: lyrics.map(x => ({ title: x.title || '', text: x.text || '', py: x.py || {} }))
}));
"""


def load_data():
    out = subprocess.run(
        ["node", "-e", DUMP_JS], cwd=ROOT,
        capture_output=True, check=True,
    )
    return json.loads(out.stdout.decode("utf-8"))


def is_han(ch):
    return "一" <= ch <= "鿿"


def build_py(text, lib_chars):
    """算出这首歌里所有库外汉字的拼音；按整句注音，多音字才判得准。"""
    from pypinyin import pinyin, Style

    result = {}
    for line in text.split("\n"):
        chars = [c for c in line if is_han(c)]
        if not chars:
            continue
        # 整行送进去，pypinyin 才有上下文可用
        readings = pinyin("".join(chars), style=Style.TONE, heteronym=False)
        for ch, r in zip(chars, readings):
            if ch in lib_chars:
                continue
            if ch not in result and r and r[0]:
                result[ch] = r[0]
    return result


def find_heteronyms(py_map):
    """列出可能有多个读音的字，供人工复核。"""
    from pypinyin import pinyin, Style

    flagged = []
    for ch, reading in py_map.items():
        all_readings = pinyin(ch, style=Style.TONE, heteronym=True)
        if all_readings and len(all_readings[0]) > 1:
            flagged.append((ch, reading, all_readings[0]))
    return flagged


def format_py(py_map):
    if not py_map:
        return "py:{}"
    inner = ",".join('"%s":"%s"' % (ch, r) for ch, r in py_map.items())
    return "py:{%s}" % inner


def lyrics_block_range(lines):
    """找到 lyrics: [ ... ], 的行号区间（0 起，含头不含尾）。"""
    start = None
    for i, line in enumerate(lines):
        if re.match(r"^\s*lyrics:\s*\[", line):
            start = i
            break
    if start is None:
        raise SystemExit("reading-texts.js 里没找到 lyrics: [")
    for j in range(start + 1, len(lines)):
        if re.match(r"^\s*\],\s*$", lines[j]):
            return start, j
    raise SystemExit("lyrics 数组没有找到结尾的 ],")


def main():
    write = "--write" in sys.argv
    data = load_data()
    lib_chars = set(data["libChars"])
    songs = data["lyrics"]

    if not songs:
        print("lyrics 还是空的，先把歌词填进 reading-texts.js 再跑我。")
        return

    computed = [build_py(s["text"], lib_chars) for s in songs]

    missing_total = 0
    for song, want in zip(songs, computed):
        have = song["py"]
        missing = [c for c in want if c not in have]
        extra = [c for c in have if c not in want]
        wrong = [c for c in want if c in have and have[c] != want[c]]
        missing_total += len(missing) + len(extra) + len(wrong)
        if missing or extra or wrong:
            print("《%s》" % song["title"])
            if missing:
                print("   缺注音：" + " ".join("%s(%s)" % (c, want[c]) for c in missing))
            if extra:
                print("   多余的：" + " ".join(extra) + "（这些字识字库里已经有了）")
            if wrong:
                print("   读音不一致：" + " ".join(
                    "%s 现写 %s / 建议 %s" % (c, have[c], want[c]) for c in wrong))

    if not missing_total:
        print("全部 %d 首歌的注音都齐了，没有要改的。" % len(songs))
        return

    if not write:
        print("\n（只是检查。要真的改写，加 --write 再跑一遍）")
        return

    # 改写：lyrics 区间里第 k 个 py:{...} 对应第 k 首歌
    with open(TARGET, "r", encoding="utf-8") as f:
        lines = f.read().split("\n")
    start, end = lyrics_block_range(lines)

    idx = 0
    for i in range(start + 1, end):
        if "py:{" not in lines[i]:
            continue
        if idx >= len(computed):
            break
        lines[i] = re.sub(r"py:\{[^}]*\}", format_py(computed[idx]).replace("\\", "\\\\"), lines[i])
        idx += 1

    if idx != len(songs):
        raise SystemExit(
            "对不上：lyrics 里有 %d 首歌，却只找到 %d 处 py:{}。"
            "请确保每首歌的 py:{} 和它写在同一行。" % (len(songs), idx))

    with open(TARGET, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print("\n已改写 %d 首歌的注音。" % idx)

    flagged = []
    for song, want in zip(songs, computed):
        for item in find_heteronyms(want):
            flagged.append((song["title"],) + item)
    if flagged:
        print("\n下面这些是多音字，pypinyin 挑的不一定对，请核一遍：")
        for title, ch, chosen, options in flagged:
            print("   《%s》 %s → %s（也读 %s）" % (
                title, ch, chosen, "、".join(o for o in options if o != chosen)))


if __name__ == "__main__":
    main()
