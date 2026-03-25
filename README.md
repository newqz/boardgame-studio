# 🎮 Board Game Studio

> 桌游电子化软件工厂 — 将实体桌游高效转换为在线版本
>
> 🌍 [English version](README-en.md) | 中文版

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%20≥18.0-brightgreen)](package.json)

## 什么是 Board Game Studio？

Board Game Studio 是一个 **AI Agent 团队**，由 16 个专业角色组成，负责将实体桌游（如卡坦岛、UNO、七大奇迹等）转换为可在线运行的软件。

团队成员包括：规则解析专家、平衡性评估专家、UI 设计师、游戏引擎开发者、多人架构师、AI 对手工程师、QA 工程师等，覆盖从规则分析到游戏上线的完整流程。

---

## ✨ 核心特性

- **规则解析** — 自动从文字规则提取游戏机制、结构化数据
- **平衡性计算** — 蒙特卡洛模拟、胜率分析、策略均衡检测
- **多人同步** — 支持 Lockstep、Client-Prediction 等多种同步架构
- **状态管理** — 序列化、回放、断线重连
- **测试生成** — 自动生成单元/集成/E2E 测试用例
- **AI 对手** — 动态难度调整、自适应学习

---

## 🛠️ Skills 技能库

项目包含 6 个可独立使用的技能包：

| 技能 | 说明 | 优先级 |
|------|------|--------|
| [game-rules-parser](skills/game-rules-parser/) | 解析桌游规则文档为结构化数据 | P0 |
| [balance-calculator](skills/balance-calculator/) | 计算和评估游戏平衡性 | P0 |
| [test-case-generator](skills/test-case-generator/) | 生成测试用例和测试数据 | P0 |
| [multiplayer-sync](skills/multiplayer-sync/) | 多人游戏实时同步架构 | P0 |
| [game-state-manager](skills/game-state-manager/) | 游戏状态序列化和恢复 | P1 |
| [ai-difficulty-tuner](skills/ai-difficulty-tuner/) | AI 难度动态调整 | P1 |

每个技能目录包含：
- `SKILL.md` — 技能定义和使用说明
- `src/` — 核心实现代码
- `tests/` — 测试用例
- `package.json` — 依赖配置

---

## 📦 安装

### 前提条件

- **Node.js** ≥ 18.0
- **npm** ≥ 9.0

### 克隆项目

```bash
git clone https://github.com/<your-username>/boardgame-studio.git
cd boardgame-studio
```

### 安装依赖

```bash
# 安装所有 skills 的依赖
cd skills/game-rules-parser && npm install && cd ../..
cd skills/balance-calculator && npm install && cd ../..
cd skills/test-case-generator && npm install && cd ../..
cd skills/multiplayer-sync && npm install && cd ../..
cd skills/game-state-manager && npm install && cd ../..
cd skills/ai-difficulty-tuner && npm install && cd ../..

# 或使用脚本一键安装
bash scripts/install-all.sh
```

### 快速安装（所有 skills）

```bash
for dir in skills/*/; do
  if [ -f "$dir/package.json" ]; then
    echo "Installing $(basename "$dir")..."
    npm install --prefix "$dir"
  fi
done
```

---

## 🚀 快速开始

### 1. 解析桌游规则

```javascript
const { RuleParser } = require('./skills/game-rules-parser/src/index');

const parser = new RuleParser();
const result = await parser.parseFromFile('./rules/catan.md');

console.log(result.gameInfo);
// { name: '卡坦岛', playerCount: { min: 3, max: 4 }, ... }
```

### 2. 计算平衡性

```javascript
const { BalanceCalculator } = require('./skills/balance-calculator/src/index');

const calculator = new BalanceCalculator();
const report = await calculator.analyze({
  resources: ['wood', 'brick', 'sheep', 'wheat', 'ore'],
  productionRate: { wood: 0.2, brick: 0.2, ... },
  victoryPoints: 10
});

console.log(report.overallScore); // 0-100
```

### 3. 多人同步

```javascript
const { LockstepSynchronizer } = require('./skills/multiplayer-sync/src/index');

const sync = new LockstepSynchronizer({ playerCount: 4 });
sync.on('turn_executed', (data) => broadcastToPlayers(data));
sync.submitInput('player1', { type: 'roll_dice' });
```

### 4. 状态管理

```javascript
const { GameStateManager } = require('./skills/game-state-manager/src/index');

const manager = new GameStateManager();
manager.createGame('room-001', initialState);
const snapshot = manager.createSnapshot(state, 'Turn 5');
const delta = manager.diff(stateA, stateB);
```

### 5. 生成测试用例

```javascript
const { TestGenerator } = require('./skills/test-case-generator/src/index');

const generator = new TestGenerator();
const cases = generator.generateFromRules(parsedRules, {
  coverage: 'full',
  types: ['unit', 'boundary', 'integration']
});

console.log(cases); // 测试用例数组
```

---

## 🧪 运行测试

```bash
# 单个 skill 测试
cd skills/game-state-manager
npm test

# 所有 skill 测试
npm test --workspaces --if-present

# 带覆盖率
npm run test:coverage --workspaces --if-present
```

---

## 📁 项目结构

```
boardgame-studio/
├── README.md               # 本文件
├── SOUL.md                 # 团队宪章
├── PROTOCOLS.md            # Agent 交接协议
├── META-MODEL.md           # 桌游元模型 DSL
├── EXAMPLES.md             # 端到端案例
├── AGENT-MODEL-MAPPING.md # Agent-Model 绑定
│
├── *.md                    # Agent 角色定义 (16个)
│
├── skills/                 # 技能库
│   ├── game-rules-parser/  # P0 - 规则解析
│   ├── balance-calculator/ # P0 - 平衡计算
│   ├── test-case-generator/ # P0 - 测试生成
│   ├── multiplayer-sync/   # P0 - 多人同步
│   ├── game-state-manager/ # P1 - 状态管理
│   └── ai-difficulty-tuner/ # P1 - 难度调整
│
├── backend/                # 后端代码（开发中）
├── frontend/               # 前端代码（开发中）
├── src/                    # 共享源代码（开发中）
├── tests/                  # 集成测试（开发中）
├── design/                 # 设计稿（开发中）
├── devops/                 # CI/CD 配置（开发中）
└── docs/                   # 文档
```

---

## 🎯 复杂度分级

| 级别 | 示例游戏 | 预计工时 | Agent 配置 |
|------|---------|---------|-----------|
| Tier 1 | UNO、接力快手 | 20-40h | 简化 |
| Tier 2 | 卡坦岛、七大奇迹 | 80-120h | 标准 |
| Tier 3 | 神秘大地、农场主 | 200-400h | 增强 |
| Tier 4 | 黑暗降临、Gloomhaven | 600h+ | 全配 |

---

## 🏗️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React + TypeScript / Phaser 3 |
| 后端 | Node.js + Colyseus |
| 数据库 | PostgreSQL + Redis |
| 实时通信 | WebSocket (Socket.io) |
| 部署 | Docker + Kubernetes |
| 监控 | Prometheus + Grafana |
| AI | Game Tree Search (Minimax, MCTS) |

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [SOUL.md](SOUL.md) | 团队价值观和工作流程 |
| [PROTOCOLS.md](PROTOCOLS.md) | Agent 交接协议 v3 |
| [META-MODEL.md](META-MODEL.md) | 桌游元模型 DSL |
| [EXAMPLES.md](EXAMPLES.md) | 卡坦岛+UNO+神秘大地案例 |
| [OBSERVABILITY.md](OBSERVABILITY.md) | 可观测性框架 |
| [RULES-ENGINE.md](RULES-ENGINE.md) | 规则验证层 |
| [RESILIENCE.md](RESILIENCE.md) | 容错和降级模型 |
| [CONCURRENCY.md](CONCURRENCY.md) | 并发控制 |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing`)
5. 创建 Pull Request

详见 [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)

---

## 📄 许可证

本项目基于 MIT 许可证开源 — 详见 [LICENSE](LICENSE)

---

*最后更新: 2026-03-25*
