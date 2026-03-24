# Skill: game-rules-parser

> 桌游规则解析技能 — 将自然语言规则文档转化为结构化数据

## 触发条件

当需要解析桌游规则文档时激活此技能。

## 输入

- 桌游规则文档（文字、PDF、图片）
- 游戏名称和类型
- 已知的关键术语表

## 解析流程

### 1. 文档预处理

```
输入：规则文档（txt/md/pdf/图片）
  ↓
文本提取（OCR/PDF解析）
  ↓
输出：原始文本
```

### 2. 结构化解析

```typescript
interface ParsedRule {
  // 游戏基本信息
  gameInfo: {
    name: string;
    playerCount: { min: number; max: number };
    ageRange: string;
    playTime: { min: number; max: number }; // minutes
    category: GameCategory;
  };
  
  // 游戏组件
  components: Component[];
  
  // 设置流程
  setup: SetupStep[];
  
  // 游戏流程
  phases: GamePhase[];
  
  // 行动类型
  actions: ActionType[];
  
  // 胜利条件
  victoryConditions: VictoryCondition[];
  
  // 特殊规则
  specialRules: SpecialRule[];
  
  // 边界情况
  edgeCases: EdgeCase[];
}

enum GameCategory {
  STRATEGY = 'strategy',
  FAMILY = 'family',
  PARTY = 'party',
  COOPERATIVE = 'cooperative',
  COMPETITIVE = 'competitive',
  CARD = 'card',
  DICE = 'dice',
  TILE = 'tile'
}
```

### 3. 关键信息提取

| 信息类型 | 提取目标 | 示例 |
|---------|---------|------|
| 资源/资产 | 所有可收集/交易的物品 | "木头、砖块、羊毛、麦子、矿石" |
| 区域/位置 | 游戏板上的位置 | "六边形格子、顶点、边" |
| 条件判断 | 触发某动作的条件 | "当你有 2 张同色卡牌时" |
| 数值限制 | 最大/最小值 | "最多 15 张手牌" |
| 顺序依赖 | 先后次序要求 | "必须先建造道路才能建定居点" |

### 4. 歧义标记

```typescript
interface Ambiguity {
  originalText: string;
  location: { line: number; context: string };
  interpretations: Interpretation[];
  severity: 'blocking' | 'warning' | 'info';
}

interface Interpretation {
  reading: string;
  implications: string[];
  edgeCases: EdgeCase[];
}
```

## 输出格式

```markdown
## 游戏：[游戏名称]

### 基本信息
- 玩家数：X-Y人
- 游戏时间：XX-YY分钟
- 适合年龄：X岁+
- 游戏类型：[类型]

### 游戏组件
- [组件列表]

### 游戏流程
1. [Phase 1]
2. [Phase 2]
...

### 核心机制
- [机制1]
- [机制2]

### 资源系统
- [资源类型及获取方式]

### 胜利条件
- [条件1]
- [条件2]

### 待澄清问题
- [歧义1]
- [歧义2]
```

## 歧义处理

当遇到规则歧义时：

1. **标记**：记录原文和可能解读
2. **推断**：根据常见桌游设计惯例推断最可能意图
3. **验证**：输出时标注"需确认"
4. **备选**：提供多种实现方案

## 质量检查

解析完成后自检：

- [ ] 所有玩家动作有对应规则支持
- [ ] 资源流转形成闭环
- [ ] 胜利条件可触发
- [ ] 无悬空引用（提及但未定义的内容）
- [ ] 边界情况已识别

---

*Skill: game-rules-parser v1.0*
