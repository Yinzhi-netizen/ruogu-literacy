# 若谷大冒险

一款以若谷自己的画为核心素材的电影感儿童识字冒险游戏。第一阶段为独立版，第二阶段将接入「若谷识字 App」的题库、星星与成长路径。

## 启动方式

因为游戏通过相对路径读取上一级目录的 `weapons.js`，直接用 `file://` 打开可能会跨域失败，建议用本地 HTTP 服务器：

```bash
cd "D:/ClaudeProjects/家庭AI大脑/旷兮若谷/教育档案/若谷语文/若谷自主阅读计划"
python -m http.server 8000
```

然后在浏览器打开：

```
http://localhost:8000/若谷冒险游戏/index.html
```

## 文件结构

```
若谷冒险游戏/
├── index.html              # 入口与全局样式
├── adventure-data.js       # 静态数据（英雄、怪物、盔甲、武器技能、题库、区域、节点）
├── adventure-adapters.js   # 适配层：读取 ../weapons.js、localStorage 存档、出题、碎片计算
├── adventure-engine.js     # 纯逻辑引擎：状态机、战斗、进度、装备、存档
├── adventure-renderer.js   # DOM 渲染器：地图、战斗、结算、装备、图鉴
├── adventure-input.js      # 输入处理：点击、键盘、触控
└── README.md               # 本文件
```

## 核心规则

- 读对字词 = 若谷侠攻击怪物；读错 = 怪物反击。
- 每 10 颗星星铸成 1 枚神兵碎片，碎片满足条件后解锁对应神兵。
- 失败不扣星，生命恢复到半血后可立刻重试。
- 武器数据全部来自 `../weapons.js`（`window.RUOGU_WEAPONS`），不做复制。

## 阶段二接入点

在 `adventure-adapters.js` 中预留了以下钩子：

```js
// 注入主 App 的出题函数
RUOGU_ADVENTURE_ADAPTERS.setQuestionProvider(fn);

// 注入主 App 的星星来源（用于碎片同步）
RUOGU_ADVENTURE_ADAPTERS.setStarSource(fn);
```

接入主系统时，把主 App 的出题函数和星星来源注入即可，无需修改本目录下的引擎与渲染代码。

## 存档

使用独立的 localStorage 键：`ruogu-adventure-v2`，不会污染主识字 App 的存档字段。

## 素材

- 主角与怪物：`../Ruogu Painting/cutouts/`（若谷原画）
- 神兵图片：`../assets/weapons-png/`（来自主 App）
