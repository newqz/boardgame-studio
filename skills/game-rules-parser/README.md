# Game Rules Parser

> 桌游规则解析器 — 将自然语言规则文档转化为结构化数据

[![npm](https://img.shields.io/badge/npm-2.0.0-blue.svg)](https://www.npmjs.com/package/game-rules-parser)
[![Tests](https://img.shields.io/badge/tests-104%20passed-brightgreen.svg)](https://jestjs.io/)
[![Coverage](https://img.shields.io/badge/coverage-104%20tests-green.svg)]()

## 特性

- 🎯 **智能解析** — 自动提取游戏信息、组件、阶段、动作、胜利条件
- 📊 **置信度评分** — 每条提取结果附带置信度指标
- ⚠️ **歧义检测** — 自动识别规则中的歧义和不确定表述
- 🌍 **多语言支持** — 支持中英文规则文档
- 📝 **Markdown 输出** — 生成结构化 Markdown 报告
- ✅ **全面测试** — 104 个测试用例，包含真实规则书测试

## 安装

```bash
npm install game-rules-parser
```

## 快速开始

```javascript
const { parseRules, toMarkdown, GameCategory } = require('game-rules-parser');

const rules = `
# Catan

## Contents
- 19 hexagonal terrain tiles
- 6 sea frames
- 18 number tokens
- 84 resource cards
- 2-4 players, ages 10+
- Playing time: 60-120 minutes

## Game Flow
1. Roll Dice
2. Trade
3. Build

## Victory
First to 10 points wins!
`;

const result = parseRules(rules);

console.log(result.gameInfo.name);        // "Catan"
console.log(result.gameInfo.playerCount); // { min: 2, max: 4 }
console.log(result.gameInfo.ageRange);    // "10+"
console.log(result.metadata.confidence.overall); // 0.85

// 生成 Markdown 报告
console.log(toMarkdown(result));
```

## API

### parseRules(text, options?)

解析规则文档，返回 `ParsedRule` 对象。

**参数：**
- `text` (string) — 规则文档文本
- `options` (ParserOptions) — 可选配置

**返回：**

```typescript
interface ParsedRule {
  gameInfo: GameInfo;           // 游戏基本信息
  components: Component[];      // 游戏组件列表
  setup: SetupStep[];           // 设置步骤
  phases: GamePhase[];          // 游戏阶段
  actions: ActionType[];        // 可用动作
  victoryConditions: VictoryCondition[]; // 胜利条件
  specialRules: SpecialRule[];  // 特殊规则
  edgeCases: EdgeCase[];        // 边界情况
  ambiguities: Ambiguity[];     // 检测到的歧义
  warnings: string[];            // 警告信息
  metadata: ParseMetadata;       // 元数据（含置信度）
}
```

**选项：**

```javascript
const options = {
  computeConfidence: true,  // 是否计算置信度（默认 true）
  detectAmbiguities: true, // 是否检测歧义（默认 true）
  detectEdgeCases: true,   // 是否检测边界情况（默认 true）
  maxParseTime: 5000,      // 最大解析时间（默认 5000ms）
  language: 'en'           // 语言 'en' | 'zh'（默认 'en'）
};
```

### validateRules(parsedRule)

验证解析结果的完整性。

**返回：**

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

### toMarkdown(parsedRule)

将解析结果转换为 Markdown 格式报告。

### GameCategory (枚举)

```javascript
const GameCategory = {
  STRATEGY: 'strategy',
  FAMILY: 'family',
  PARTY: 'party',
  COOPERATIVE: 'cooperative',
  COMPETITIVE: 'competitive',
  CARD: 'card',
  DICE: 'dice',
  TILE: 'tile'
};
```

## 数据结构

### GameInfo

```typescript
interface GameInfo {
  name: string;              // 游戏名称
  playerCount: { min: number; max: number }; // 玩家数量范围
  ageRange: string;          // 年龄范围，如 "10+"
  playTime: { min: number; max: number };    // 游戏时间（分钟）
  category: GameCategory;   // 游戏类别
}
```

### Component

```typescript
interface Component {
  name: string;             // 组件名称
  quantity: number | null;  // 数量（未知为 null）
  category: ComponentCategory;
  description?: string;
}
```

### VictoryCondition

```typescript
interface VictoryCondition {
  name: string;             // 胜利条件名称
  description: string;      // 描述
  criteria: string[];       // 判定标准
  isPrimary: boolean;       // 是否为主要胜利条件
}
```

### Ambiguity

```typescript
interface Ambiguity {
  type: 'vague_quantifier' | 'uncertain_outcome' | 'vague_reference' | 'incomplete_rule';
  severity: 'blocking' | 'warning' | 'info';
  message: string;          // 描述
  position: { start: number; end: number }; // 文本位置
  suggestions?: string[];   // 澄清建议
}
```

## 置信度评分

解析结果包含详细的置信度评分：

```javascript
result.metadata.confidence
// {
//   overall: 0.85,        // 总体置信度
//   gameInfo: 0.92,      // 游戏信息置信度
//   components: 0.80,     // 组件置信度
//   phases: 0.75,         // 阶段置信度
//   actions: 0.70,        // 动作置信度
//   victory: 0.90,        // 胜利条件置信度
//   ambiguity: 0.85,      // 歧义检测置信度
//   details: {            // 详细分数
//     name: 0.95,
//     playerCount: 0.95,
//     ageRange: 0.95,
//     playTime: 0.90,
//     category: 0.80
//   }
// }
```

**置信度等级：**
- 0.9+ — 高度可靠
- 0.7-0.9 — 可靠
- 0.5-0.7 — 中等置信度
- < 0.5 — 需要人工审核

## 歧义检测

自动检测规则中的歧义表述：

| 类型 | 描述 | 严重程度 |
|------|------|----------|
| `vague_quantifier` | 模糊数量词（"一些"、"几个"） | warning |
| `uncertain_outcome` | 不确定结果（"可能"、"也许"） | warning |
| `vague_reference` | 模糊引用（"同上"、"同样"） | info |
| `incomplete_rule` | 不完整规则 | blocking |

## 使用示例

### 基础用法

```javascript
const { parseRules } = require('game-rules-parser');

const rules = `
# Chess

2 players, ages 6+
30-180 minutes

## Game Flow
1. White moves
2. Black moves
3. Repeat until checkmate or draw

## Victory
Checkmate the opponent's king to win.
`;

const result = parseRules(rules);
console.log(result.gameInfo);
// {
//   name: 'Chess',
//   playerCount: { min: 2, max: 2 },
//   ageRange: '6+',
//   playTime: { min: 30, max: 180 },
//   category: 'strategy'
// }
```

### 中文规则

```javascript
const { parseRules } = require('game-rules-parser');

const chineseRules = `
# 狼人杀

## 游戏信息
- 8-18名玩家
- 适合年龄：12+
- 游戏时长：30-60分钟

## 游戏阶段
1. 夜晚阶段
2. 白天阶段
3. 投票阶段

## 胜利条件
- 狼人阵营：消灭所有村民
- 村民阵营：消灭所有狼人
`;

const result = parseRules(chineseRules, { language: 'zh' });
```

### 验证结果

```javascript
const { parseRules, validateRules } = require('game-rules-parser');

const rules = `# Game`;
const result = parseRules(rules);
const validation = validateRules(result);

if (!validation.valid) {
  console.log('Errors:', validation.errors);
  console.log('Warnings:', validation.warnings);
}
```

### 生成报告

```javascript
const { parseRules, toMarkdown } = require('game-rules-parser');

const rules = `...`; // 规则文本
const result = parseRules(rules);
const report = toMarkdown(result);

// 输出或保存 Markdown 报告
console.log(report);
```

## 性能基准

| 文本长度 | 解析时间 | 置信度 |
|----------|----------|--------|
| 1,000 字符 | < 100ms | 0.85 |
| 10,000 字符 | < 500ms | 0.90 |
| 50,000 字符 | < 2s | 0.92 |

## 游戏类别

支持的 `GameCategory` 值：

```javascript
{
  STRATEGY: 'strategy',        // 策略游戏
  FAMILY: 'family',            // 家庭游戏
  PARTY: 'party',              // 派对游戏
  COOPERATIVE: 'cooperative',  // 合作游戏
  COMPETITIVE: 'competitive',  // 竞技游戏
  CARD: 'card',                // 卡牌游戏
  DICE: 'dice',                // 骰子游戏
  TILE: 'tile'                 // 板块游戏
}
```

## 错误处理

```javascript
const { parseRules, GameRulesError } = require('game-rules-parser');

try {
  const result = parseRules(null); // 会抛出错误
} catch (error) {
  if (error instanceof GameRulesError) {
    console.log('Parser error:', error.message);
  }
}
```

## 测试

```bash
npm test
```

## 许可证

MIT
