# Boardgame Studio Skills

桌游电子化软件工厂团队专用技能库

## 技能索引

| 技能名称 | 文件路径 | 用途 | 优先级 |
|---------|---------|------|-------|
| game-rules-parser | `game-rules-parser/SKILL.md` | 解析桌游规则文档为结构化数据 | P0 |
| balance-calculator | `balance-calculator/SKILL.md` | 计算和评估游戏平衡性 | P0 |
| test-case-generator | `test-case-generator/SKILL.md` | 生成测试用例和测试数据 | P0 |
| multiplayer-sync | `multiplayer-sync/SKILL.md` | 多人游戏实时同步架构 | P0 |
| game-state-manager | `game-state-manager/SKILL.md` | 游戏状态序列化和恢复 | P1 |
| ai-difficulty-tuner | `ai-difficulty-tuner/SKILL.md` | AI 难度动态调整 | P1 |

## P0 核心技能（必备）

### game-rules-parser
- 输入：规则文档（txt/md/pdf/图片）
- 输出：结构化 ParsedRule 对象
- 核心功能：歧义标记、规则完整性检查

### balance-calculator
- 输入：游戏机制配置
- 输出：平衡性分析报告
- 核心功能：胜率模拟、策略均衡检测

### test-case-generator
- 输入：游戏规则
- 输出：单元/集成/E2E 测试用例
- 核心功能：边界测试、随机性测试、性能测试

### multiplayer-sync
- 输入：游戏状态
- 输出：同步协议和代码模板
- 核心功能：Lockstep、Client-Prediction、断线处理

## P1 重要技能（推荐）

### game-state-manager
- 输入：游戏状态对象
- 输出：序列化数据/快照/差异
- 核心功能：版本迁移、断线重连、回放系统

### ai-difficulty-tuner
- 输入：玩家游戏数据
- 输出：动态难度配置
- 核心功能：Elo 评分、自适应调整、风格识别

## 待开发技能

| 技能名称 | 优先级 | 状态 |
|---------|-------|------|
| animation-choreographer | P2 | 待开发 |
| social-features-builder | P2 | 待开发 |
| performance-profiler | P1 | 待开发 |
| ui-component-library | P2 | 待开发 |

## 技能开发规范

每个技能文件应包含：

1. **触发条件** - 何时使用该技能
2. **核心接口** - TypeScript 接口定义
3. **实现代码** - 可执行的代码模板
4. **使用示例** - 实际使用示例
5. **测试要点** - 质量验证标准

## 协议文件

- `PROTOCOLS.md` - Agent 交接协议标准（必须阅读）

---

*最后更新: 2026-03-24*
