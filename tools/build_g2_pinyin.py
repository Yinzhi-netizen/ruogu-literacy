#!/usr/bin/env python
# 从 grade2-words.js 提取全部词语，用 pypinyin 生成拼音，人工修正多音字/轻声后写入 grade2-pinyin.js
# 风格约定：与一年级 pinyin-data.js 一致——「一」不变调、轻声词第二个字标轻声
import json, re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from pypinyin import pinyin, Style

# 人工校对修正（pypinyin 初稿 → 定稿）
CORRECTIONS = {
    "教课": "jiāo kè",            # 教 jiāo（传授）
    "发夹": "fà jiā",             # 发 fà（头发）
    "一行": "yī háng",            # 一行垂柳 háng
    "绕着北极星转": "rào zhe běi jí xīng zhuàn",  # 转 zhuàn（绕圈）
    "数星星": "shǔ xīng xing",    # 数 shǔ（点数）
    "天都": "tiān dū",            # 天都峰 dū
    "钉着": "dìng zhe",           # 钉 dìng（动词）
    "盛水": "chéng shuǐ",         # 盛 chéng（装水）
    "混身": "hún shēn",
    "乘着风": "chéng zhe fēng",
    "扎风筝": "zā fēng zheng",    # 扎 zā（捆扎/做风筝）
    "风筝": "fēng zheng",
    "风筝线": "fēng zheng xiàn",
    "刺猬": "cì wei",
    "队伍": "duì wu",
    "肚子": "dù zi",
    "庄稼": "zhuāng jia",
    "知识": "zhī shi",
    "告诉": "gào su",
    "名字": "míng zi",
    "清楚": "qīng chu",
    "舅舅": "jiù jiu",
    "哥哥": "gē ge",
    "爷爷": "yé ye",
    "奶奶": "nǎi nai",
    "朋友": "péng you",
    "休息": "xiū xi",
    "扁担": "biǎn dan",
    "骆驼": "luò tuo",
    "猩猩": "xīng xing",
    "蚕宝宝": "cán bǎo bao",
    "虾米": "xiā mi",
    "哪里": "nǎ li",
    "口袋": "kǒu dai",
    "嘴巴": "zuǐ ba",
    "葡萄沟": "pú tao gōu",
    "葡萄干": "pú tao gān",
    "消息": "xiāo xi",
    "小时候": "xiǎo shí hou",
    "衣服": "yī fu",
    "云彩": "yún cai",
    "事情": "shì qing",
    "几百颗星星": "jǐ bǎi kē xīng xing",
    "拿着一面镜子": "ná zhe yī miàn jìng zi",
    "一点儿": "yī diǎn ér",
    "一点儿心意": "yī diǎn ér xīn yì",
    "闭上眼睛": "bì shàng yǎn jing",
    "呜呜地哭": "wū wū de kū",    # 地 de（助词）
}

src = open("grade2-words.js", encoding="utf-8").read()
words = []
for m in re.finditer(r'"(recognize|write)":\s*\[(.*?)\]', src, re.S):
    for w in re.findall(r'"([^"]+)"', m.group(2)):
        if w not in words:
            words.append(w)

result = {}
for w in words:
    if w in CORRECTIONS:
        result[w] = CORRECTIONS[w]
    else:
        py = pinyin(w, style=Style.TONE, neutral_tone_with_five=False)
        result[w] = " ".join(p[0] for p in py)

lines = []
for w in words:
    lines.append(f'  {json.dumps(w, ensure_ascii=False)}: {json.dumps(result[w], ensure_ascii=False)},')
out = "// 若谷识字 · 二年级上册词拼音（带声调）\n"
out += "// 生成：tools/build_g2_pinyin.py（pypinyin 初稿）→ 人工校对多音字与轻声（2026-09）\n"
out += "// 说明：直接并入 RUOGU_PINYIN；风格与一年级一致（一不变调、轻声词标轻声）\n"
out += "window.RUOGU_PINYIN = Object.assign(window.RUOGU_PINYIN || {}, {\n"
out += "\n".join(lines)
out += "\n});\n"
open("grade2-pinyin.js", "w", encoding="utf-8").write(out)
print(f"共 {len(words)} 词，修正 {len(CORRECTIONS)} 处 → grade2-pinyin.js")
