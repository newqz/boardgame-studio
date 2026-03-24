# 🎮 Board Game Studio - Agent Team

> 桌游电子化软件工厂 AI Agent 团队

## 团队概览

**任务**: 将各种桌游高效地转换为在线版本

**Agent数量**: 16个专业角色

---

## 团队架构

```
🎯 项目总监 (Project Director)
   │
   ├── 📋 规则分析团队
   │   ├── rule-analyst.md - 规则解析专家
   │   ├── mechanic-extractor.md - 玩法提炼专家
   │   ├── balance-evaluator.md - 平衡性评估专家
   │   └── test-generator.md - 测试生成专家
   │
   ├── 🎨 设计前端团队
   │   ├── ui-designer.md - UI架构师
   │   ├── interaction-designer.md - UX交互设计专家
   │   ├── visual-designer.md - 视觉设计师
   │   └── animation-effects.md - 动画特效专家
   │
   ├── ⚙️ 后端游戏团队
   │   ├── game-engine-dev.md - 游戏引擎开发
   │   ├── multiplayer-architect.md - 多人架构专家
   │   ├── ai-opponent-dev.md - AI对手开发
   │   ├── social-features-dev.md - 社交功能开发
   │   └── data-engineer.md - 数据工程师
   │
   └── 🔧 测试运维团队
       ├── qa-engineer.md - QA工程师
       ├── automation-qa.md - 自动化QA工程师
       └── devops-engineer.md - DevOps工程师
```

---

## 核心文档 (P0 生产就绪)

| 文档 | 用途 | 大小 | 状态 |
|------|------|------|------|
| `SOUL.md` | 团队宪章、价值观、工作流程 | 5.4KB | ✅ |
| `PROTOCOLS.md` | Agent 交接协议 v3（反向流控+人类审核）、冲突解决 | 18KB | ✅ |
| `META-MODEL.md` | **桌游元模型 DSL、复杂度分级、运行时架构、随机性模型** | 28KB | ✅ |
| `EXAMPLES.md` | **卡坦岛+UNO+神秘大地端到端案例** | 25KB | ✅ |
| `QUALITY.md` | **质量门禁 vs 运营监控分离** | 10KB | ✅ |
| `AGENT-MODEL-MAPPING.md` | **Agent-Model 显式绑定矩阵** | 16KB | ✅ |
| `OBSERVABILITY.md` | **Trace架构、决策日志、Dashboard、告警、Top10指标** | 24KB | ✅ P0 |
| `RULES-ENGINE.md` | **权威规则验证层、FEN格式、防作弊、超时默认拒绝** | 20KB | ✅ P0 |
| `RESILIENCE.md` | **Agent降级/熔断模型、故障恢复、负荷管理** | 19KB | ✅ |
| `CONCURRENCY.md` | **并发模型、一致性边界、锁策略、负荷卸载** | 11KB | ✅ P0 |

---

## 工作流程

```
桌游输入
    │
    ▼
┌─────────────────┐
│  规则分析团队   │ ← 解析规则、提炼机制、评估平衡
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  项目总监       │ ← 规划任务、协调团队
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│设计前端│ │后端游戏│
│ 团队   │ │  团队   │
└───┬────┘ └───┬────┘
    │         │
    └────┬────┘
         ▼
┌─────────────────┐
│  测试运维团队   │ ← 自动化测试、部署、监控
└────────┬────────┘
         │
         ▼
    游戏上线
```

---

## 复杂度分级系统

```yaml
Tier 1 (简单):
  - UNO、接力快手
  - 预计工时: 20-40h
  - Agent配置: 简化
  
Tier 2 (中等):
  - 卡坦岛、七大奇迹
  - 预计工时: 80-120h
  - Agent配置: 标准
  
Tier 3 (复杂):
  - 神秘大地、农场主
  - 预计工时: 200-400h
  - Agent配置: 增强
  
Tier 4 (专家):
  - 黑暗降临、Gloomhaven
  - 预计工时: 600h+
  - Agent配置: 全配
```

---

## 技术栈参考

### 前端
- React + TypeScript / Phaser 3
- CSS3 + Animation
- WebSocket for real-time

### 后端
- Node.js + Colyseus
- PostgreSQL + Redis
- WebSocket (Socket.io)

### 基础设施
- Kubernetes
- Docker
- Prometheus + Grafana
- GitHub Actions

### AI
- Minimax/MiniMax-M2.7-highspeed
- Game tree search (Minimax, MCTS)

---

## 技能库 (Skills)

| 技能 | 用途 | 优先级 |
|------|------|-------|
| `skills/game-rules-parser/` | 规则文档解析 | P0 |
| `skills/balance-calculator/` | 平衡性计算 | P0 |
| `skills/test-case-generator/` | 测试用例生成 | P0 |
| `skills/multiplayer-sync/` | 多人同步架构 | P0 |
| `skills/game-state-manager/` | 状态序列化/回放 | P1 |
| `skills/ai-difficulty-tuner/` | AI难度动态调整 | P1 |

详见 [skills/README.md](skills/README.md)

---

## 框架结构

```
boardgame-studio/
├── SOUL.md                    # 团队灵魂宪章
├── README.md                  # 本文件
├── PROTOCOLS.md               # Agent交接协议标准 (v3)
├── META-MODEL.md              # 桌游元模型 DSL (v1.2)
├── EXAMPLES.md                # 端到端案例
├── QUALITY.md                 # 质量度量标准
├── AGENT-MODEL-MAPPING.md    # Agent-Model绑定矩阵
├── OBSERVABILITY.md          # 可观测性框架 (含日志回放协议) ⭐第四轮新增
│
├── project-director.md        # 项目总监（含错误处理、Human-in-loop）
├── rule-analyst.md            # 规则解析专家
├── mechanic-extractor.md      # 玩法提炼专家
├── balance-evaluator.md      # 平衡性评估专家
├── test-generator.md          # 测试生成专家
├── ui-designer.md            # UI架构师
├── interaction-designer.md    # UX交互设计专家
├── visual-designer.md        # 视觉设计师
├── game-engine-dev.md        # 游戏引擎开发
├── multiplayer-architect.md  # 多人架构专家
├── ai-opponent-dev.md        # AI对手开发
├── social-features-dev.md     # 社交功能开发
├── animation-effects.md       # 动画特效专家
├── data-engineer.md          # 数据工程师
├── qa-engineer.md           # QA工程师
├── automation-qa.md         # 自动化QA工程师
└── devops-engineer.md       # DevOps工程师
    │
    └── skills/              # 技能库
        ├── README.md
        ├── PROTOCOLS.md
        ├── game-rules-parser/
        ├── balance-calculator/
        ├── test-case-generator/
        ├── multiplayer-sync/
        ├── game-state-manager/
        └── ai-difficulty-tuner/
```

---

## 优化记录

### 第一轮优化 (18:00-18:17)
- ✅ PROTOCOLS.md — 标准化交接协议
- ✅ game-state-manager skill — 状态序列化
- ✅ ai-difficulty-tuner skill — AI难度调整
- ✅ project-director 增加错误处理、Human-in-loop

### 第二轮优化 (18:20-18:30) — 基于 Opus 4.6 评审
- ✅ META-MODEL.md — 桌游元模型 DSL
- ✅ EXAMPLES.md — 卡坦岛端到端完整案例
- ✅ QUALITY.md — 质量度量标准体系

### 第三轮优化 (18:30-18:45) — 基于 Opus 4.6 第二轮评审
- ✅ AGENT-MODEL-MAPPING.md — Agent与元模型的显式绑定矩阵 (16KB)
- ✅ META-MODEL.md 新增 RUNTIME 章节 — 游戏状态机、同步策略、验证回滚
- ✅ EXAMPLES.md 新增 UNO + 神秘大地骨架 — 验证跨Tier复用率
- ✅ PROTOCOLS.md v2 — 增加反向流控、版本控制、拒绝协议
- ✅ QUALITY.md v2 — 拆分质量门禁(pre) vs 运营监控(post)

### 第四轮优化 (18:45-19:00) — 基于 Opus 4.6 第三轮评审
- ✅ OBSERVABILITY.md — Trace架构、决策日志、Dashboard、告警体系 (16KB)
- ✅ META-MODEL.md 新增随机性模型 — RandomnessSource/Seed管理/多人同步/AI处理
- ✅ PROTOCOLS.md v3 — 增加人类审核节点、升级工单Schema、SLA、知识库反馈循环

### 第五轮优化 (18:48-19:05) — 基于 Opus 4.6 第四轮评审
- ✅ RULES-ENGINE.md — 权威规则验证层、FEN游戏状态格式、防作弊验证 (14KB)
- ✅ RESILIENCE.md — Agent降级/熔断模型、故障恢复、负荷管理 (19KB)
- ✅ OBSERVABILITY.md v1.1 — 新增日志回放协议 (fork/反事实模拟支持)

### 第六轮优化 (18:58-19:10) — P0 生产必选修复
- ✅ RULES-ENGINE.md v1.1 — 新增验证超时+默认拒绝行为 (3.0节)
- ✅ OBSERVABILITY.md v1.2 — 新增运行时指标规范 Top10 + 告警阈值配置 (7.0节)
- ✅ CONCURRENCY.md — 新增并发模型、一致性边界、死锁预防 (11KB)
- **状态**: P0 问题已全部修复

---

## 下一步

1. **实例部署**: 在 OpenClaw boardgame 实例 (port 18809) 上部署团队
2. **实际测试**: 选择一款桌游（如卡坦岛）进行端到端测试
3. **迭代优化**: 根据实际运行结果优化 Agent 配置

---

*最后更新: 2026-03-24*
