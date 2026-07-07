// 若谷大冒险 · 数据层
// 本文件只放静态数据，不访问 DOM、localStorage 或主 App。

window.RUOGU_ADVENTURE_DATA = (function () {
  "use strict";

  const CUTOUT = "../Ruogu Painting/cutouts/";

  const HERO = {
    id: "ruogu",
    name: "若谷侠",
    title: "识字小哪吒",
    image: CUTOUT + "1_cutout.png",
    forms: {
      normal: CUTOUT + "1_cutout.png",
      armed: CUTOUT + "7_cutout.png",
      powered: CUTOUT + "9_cutout.png"
    },
    maxHp: 10,
    baseAttack: 2
  };

  const ARMORS = [
    {
      id: "cloth",
      name: "小英雄布衣",
      defense: 0,
      hpBonus: 0,
      unlock: "start",
      intro: "轻快好跑，适合刚出发的若谷侠。"
    },
    {
      id: "vine",
      name: "沼泽藤甲",
      defense: 1,
      hpBonus: 1,
      unlock: "node-swamp-chest",
      intro: "用泥泡沼泽的藤条编成，答错时少受一点伤。"
    },
    {
      id: "iron",
      name: "机关铁甲",
      defense: 2,
      hpBonus: 2,
      unlock: "node-castle-chest",
      intro: "机关城堡里的铁片拼成，稳稳挡住怪物反击。"
    },
    {
      id: "windfire",
      name: "风火轮甲",
      defense: 2,
      hpBonus: 3,
      unlock: "node-cloud-elite",
      intro: "像哪吒一样呼呼向前，BOSS 战也不慌。"
    }
  ];

  // 与 ../weapons.js 中的 10 件神兵一一对应
  const WEAPON_SKILLS = {
    jingubang: { name: "如意连击", desc: "三连对时追加一击。", type: "comboStrike" },
    qiankunquan: { name: "乾坤定身", desc: "连击时有机会让怪物不反击。", type: "bind" },
    bajiaoshan: { name: "一扇清沼", desc: "对沼泽怪额外伤害。", type: "swampClear" },
    fantianyin: { name: "番天破防", desc: "对精英和 BOSS 额外破防。", type: "breakDefense" },
    dashenbian: { name: "打神重击", desc: "精英怪战斗伤害更高。", type: "eliteStrike" },
    jiuchidingpa: { name: "九齿护身", desc: "答错时偶尔少扣 1 点血。", type: "guard" },
    sanjianliangrendao: { name: "三尖破阵", desc: "机关城堡额外伤害。", type: "castleCut" },
    langyabang: { name: "狼牙猛击", desc: "普通怪战斗伤害更高。", type: "brute" },
    jinshejian: { name: "金蛇快剑", desc: "每次战斗开局获得 1 连击。", type: "quickStart" },
    shuimochanzhang: { name: "禅杖稳心", desc: "胜利后多恢复 1 点生命。", type: "recover" }
  };

  const MONSTERS = {
    dot: {
      id: "dot",
      name: "圆点怪",
      image: CUTOUT + "5_cutout.png",
      hp: 7,
      attack: 1,
      intro: "一蹦一跳挡在森林路口。"
    },
    mud: {
      id: "mud",
      name: "泥泡怪",
      image: CUTOUT + "5_cutout.png",
      hp: 9,
      attack: 1,
      terrain: "swamp",
      intro: "躲在泡泡泥里，最怕读音被认出来。"
    },
    tangled: {
      id: "tangled",
      name: "缠藤怪",
      image: CUTOUT + "2_cutout.png",
      hp: 8,
      attack: 1,
      terrain: "swamp",
      intro: "沼泽深处的乱藤影子。"
    },
    square: {
      id: "square",
      name: "方脸守卫",
      image: CUTOUT + "4_cutout.png",
      hp: 10,
      attack: 1,
      intro: "守着山洞门，喜欢出相近拼音题。"
    },
    echo: {
      id: "echo",
      name: "回声石怪",
      image: CUTOUT + "6_cutout.png",
      hp: 12,
      attack: 1,
      intro: "会把读音在山洞里绕来绕去。"
    },
    guard: {
      id: "guard",
      name: "机关守卫",
      image: CUTOUT + "4_cutout.png",
      hp: 13,
      attack: 2,
      elite: true,
      terrain: "castle",
      intro: "铁门前的精英怪，需要稳稳答题。"
    },
    redBlock: {
      id: "redBlock",
      name: "熔岩块怪",
      image: CUTOUT + "8_cutout.png",
      hp: 11,
      attack: 2,
      elite: true,
      terrain: "castle",
      intro: "城堡深处烧得发红的石块。"
    },
    boss: {
      id: "boss",
      name: "云顶红怪王",
      image: CUTOUT + "10_cutout.png",
      hp: 22,
      attack: 2,
      boss: true,
      intro: "守着云顶宝殿的长血条 BOSS。"
    }
  };

  const QUESTION_BANK = {
    recognize: [
      { word: "太阳", pinyin: "tai yang", options: ["tai yang", "da yang", "tai yong", "dai yang"] },
      { word: "大山", pinyin: "da shan", options: ["da shan", "tai shan", "da san", "da shang"] },
      { word: "小鸟", pinyin: "xiao niao", options: ["xiao niao", "xiao liao", "shao niao", "xiao niao4"] },
      { word: "白云", pinyin: "bai yun", options: ["bai yun", "bai yin", "bei yun", "bai yong"] },
      { word: "月亮", pinyin: "yue liang", options: ["yue liang", "ye liang", "yue lang", "rui liang"] },
      { word: "星星", pinyin: "xing xing", options: ["xing xing", "xin xing", "qing xing", "xing xin"] },
      { word: "天空", pinyin: "tian kong", options: ["tian kong", "tian keng", "tian gong", "tan kong"] },
      { word: "花朵", pinyin: "hua duo", options: ["hua duo", "hua tuo", "hua dong", "fa duo"] }
    ],
    reverse: [
      { pinyin: "peng you", answer: "朋友", options: ["朋友", "朋有", "月友", "明友"] },
      { pinyin: "kuai le", answer: "快乐", options: ["快乐", "快东", "块乐", "决乐"] },
      { pinyin: "chang ge", answer: "唱歌", options: ["唱歌", "喝歌", "昌歌", "唱可"] },
      { pinyin: "tiao wu", answer: "跳舞", options: ["跳舞", "挑舞", "跳午", "逃舞"] },
      { pinyin: "hui jia", answer: "回家", options: ["回家", "回加", "会来", "汇家"] },
      { pinyin: "xue xiao", answer: "学校", options: ["学校", "学笑", "穴校", "学孝"] },
      { pinyin: "lao shi", answer: "老师", options: ["老师", "老思", "劳师", "老狮"] },
      { pinyin: "tai yang", answer: "太阳", options: ["太阳", "太羊", "大阳", "汰阳"] }
    ],
    similar: [
      { word: "星星", pinyin: "xing xing", options: ["xing xing", "xin xing", "qing xing", "xing xin"] },
      { word: "勇敢", pinyin: "yong gan", options: ["yong gan", "yong gan4", "rong gan", "yong kan"] },
      { word: "力气", pinyin: "li qi", options: ["li qi", "li chi", "ni qi", "li ji"] },
      { word: "胜利", pinyin: "sheng li", options: ["sheng li", "shen li", "cheng li", "sheng ni"] },
      { word: "书包", pinyin: "shu bao", options: ["shu bao", "su bao", "shu pao", "shu bao2"] },
      { word: "明天", pinyin: "ming tian", options: ["ming tian", "min tian", "ming tan", "ming tian2"] },
      { word: "认真", pinyin: "ren zhen", options: ["ren zhen", "reng zhen", "ren zheng", "ren zen"] },
      { word: "高兴", pinyin: "gao xing", options: ["gao xing", "gao xin", "gao qing", "gao xing4"] }
    ],
    phrase: [
      { prompt: "选出能和「小」组成词语的字", answer: "鸟", options: ["鸟", "云", "力", "宝"] },
      { prompt: "选出能和「白」组成词语的字", answer: "云", options: ["云", "山", "歌", "星"] },
      { prompt: "选出能和「唱」组成词语的字", answer: "歌", options: ["歌", "舞", "力", "宝"] },
      { prompt: "选出能和「回」组成词语的字", answer: "家", options: ["家", "山", "月", "友"] },
      { prompt: "选出能和「老」组成词语的字", answer: "师", options: ["师", "生", "友", "校"] },
      { prompt: "选出能和「学」组成词语的字", answer: "校", options: ["校", "生", "师", "书"] },
      { prompt: "选出能和「天」组成词语的字", answer: "空", options: ["空", "明", "阳", "气"] },
      { prompt: "选出能和「快」组成词语的字", answer: "乐", options: ["乐", "东", "块", "决"] }
    ],
    reading: [
      { prompt: "若谷侠到沼泽，要先看清什么？", answer: "泥泡泡", options: ["泥泡泡", "云朵", "月亮", "书包"] },
      { prompt: "打怪前最重要的是？", answer: "认清字", options: ["认清字", "闭眼冲", "乱点", "逃跑"] },
      { prompt: "神兵碎片靠什么慢慢铸成？", answer: "星星", options: ["星星", "石头", "糖果", "雨水"] },
      { prompt: "若谷侠遇到不认识的字，应该？", answer: "仔细看", options: ["仔细看", "跳过", "乱猜", "哭"] },
      { prompt: "穿过森林后，下一个区域是？", answer: "泥泡沼泽", options: ["泥泡沼泽", "机关城堡", "回声山洞", "云顶宝殿"] },
      { prompt: "打败 BOSS 需要？", answer: "认真答题", options: ["认真答题", "跑得快", "跳得高", "力气大"] },
      { prompt: "「朋友」的「朋」读？", answer: "peng", options: ["peng", "pen", "ping", "pin"] },
      { prompt: "装备更好的盔甲可以让若谷侠？", answer: "更能抗", options: ["更能抗", "跑得更快", "跳得更高", "不用答题"] }
    ]
  };

  const REGIONS = [
    {
      id: "forest",
      name: "太阳森林",
      tone: "认读入门",
      x: 16,
      y: 76,
      visual: {
        sky: "linear-gradient(180deg, #eef6d8 0%, #d4e3b8 60%, #c8d9a8 100%)",
        ground: "linear-gradient(180deg, transparent 0%, rgba(132,160,92,.22) 100%)",
        elements: ["canopy", "sunray", "falling-leaves"]
      }
    },
    {
      id: "swamp",
      name: "泥泡沼泽",
      tone: "沼泽打怪",
      x: 34,
      y: 58,
      visual: {
        sky: "linear-gradient(180deg, #d8debf 0%, #9fa86f 60%, #6b5c3e 100%)",
        ground: "linear-gradient(180deg, transparent 0%, rgba(68,54,32,.55) 100%)",
        elements: ["bubbles", "fog", "vines", "bridge"]
      }
    },
    {
      id: "cave",
      name: "回声山洞",
      tone: "相近读音",
      x: 54,
      y: 43,
      visual: {
        sky: "linear-gradient(180deg, #2b2f42 0%, #1a1d2a 60%, #11131c 100%)",
        ground: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,.45) 100%)",
        elements: ["stalactites", "echo", "glow-moss"]
      }
    },
    {
      id: "castle",
      name: "机关城堡",
      tone: "组词机关",
      x: 70,
      y: 28,
      visual: {
        sky: "linear-gradient(180deg, #d7d9e8 0%, #9ca3b8 60%, #5a627d 100%)",
        ground: "linear-gradient(180deg, transparent 0%, rgba(40,44,62,.35) 100%)",
        elements: ["battlements", "gears", "torches", "gate"]
      }
    },
    {
      id: "cloud",
      name: "云顶宝殿",
      tone: "最终 BOSS",
      x: 84,
      y: 15,
      visual: {
        sky: "linear-gradient(180deg, #dff0ff 0%, #b8d2ed 60%, #9fbce0 100%)",
        ground: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,.25) 100%)",
        elements: ["clouds", "temple", "sun-rays"]
      }
    }
  ];

  const NODES = [
    { id: "forest-1", region: "forest", type: "battle", name: "森林入口", x: 12, y: 78, monster: "dot", tier: "recognize", reward: { stars: 2, materials: { leaf: 1 } } },
    { id: "forest-chest", region: "forest", type: "chest", name: "树洞宝箱", x: 21, y: 70, reward: { stars: 2, materials: { leaf: 2 } } },
    { id: "forest-elite", region: "forest", type: "elite", name: "太阳树顶", x: 30, y: 64, monster: "dot", tier: "recognize", reward: { stars: 3, materials: { leaf: 2 } } },

    { id: "swamp-1", region: "swamp", type: "battle", name: "泥泡小路", x: 35, y: 58, monster: "mud", tier: "reverse", reward: { stars: 3, materials: { mud: 1 } } },
    { id: "node-swamp-chest", region: "swamp", type: "chest", name: "藤甲宝箱", x: 43, y: 52, reward: { stars: 2, armor: "vine", materials: { mud: 2 } } },
    { id: "swamp-elite", region: "swamp", type: "elite", name: "深泥潭", x: 48, y: 60, monster: "tangled", tier: "reverse", reward: { stars: 4, materials: { mud: 3 } } },

    { id: "cave-1", region: "cave", type: "battle", name: "回声洞口", x: 56, y: 45, monster: "square", tier: "similar", reward: { stars: 3, materials: { echo: 1 } } },
    { id: "cave-rest", region: "cave", type: "rest", name: "清泉恢复", x: 62, y: 38, heal: 4 },
    { id: "cave-elite", region: "cave", type: "elite", name: "石门回声", x: 66, y: 47, monster: "echo", tier: "similar", reward: { stars: 4, materials: { echo: 3 } } },

    { id: "castle-1", region: "castle", type: "battle", name: "机关前厅", x: 70, y: 32, monster: "guard", tier: "phrase", reward: { stars: 4, materials: { iron: 1 } } },
    { id: "node-castle-chest", region: "castle", type: "chest", name: "铁甲宝箱", x: 76, y: 26, reward: { stars: 2, armor: "iron", materials: { iron: 2 } } },
    { id: "castle-elite", region: "castle", type: "elite", name: "城门守卫", x: 79, y: 35, monster: "redBlock", tier: "phrase", reward: { stars: 5, materials: { iron: 3 } } },

    { id: "cloud-1", region: "cloud", type: "battle", name: "云阶试炼", x: 82, y: 21, monster: "echo", tier: "reading", reward: { stars: 4, materials: { cloud: 1 } } },
    { id: "node-cloud-elite", region: "cloud", type: "elite", name: "宝殿门神", x: 88, y: 18, monster: "guard", tier: "reading", reward: { stars: 5, armor: "windfire", materials: { cloud: 2 } } },
    { id: "cloud-boss", region: "cloud", type: "boss", name: "云顶红怪王", x: 91, y: 10, monster: "boss", tier: "mixed", reward: { stars: 8, materials: { cloud: 5 } } }
  ];

  const MATERIALS = {
    leaf: "森林叶印",
    mud: "沼泽泥晶",
    echo: "回声石",
    iron: "城堡铁片",
    cloud: "云顶灵光"
  };

  return {
    HERO,
    ARMORS,
    WEAPON_SKILLS,
    MONSTERS,
    QUESTION_BANK,
    REGIONS,
    NODES,
    MATERIALS
  };
})();
