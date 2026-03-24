# Agent-Model Mapping — Agent 与元模型的绑定关系

> 明确每个 Agent 负责产出和消费 META-MODEL 中的哪些类型对象

---

## 一、映射矩阵总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Agent-Model 映射矩阵                           │
├─────────────────────────────────────────────────────────────────────────┤
│  Agent                  │ 输入                    │ 输出               │
├─────────────────────────┼────────────────────────┼────────────────────┤
│  🎯 项目总监            │ ProjectBrief           │ ProjectPlan        │
│                         │ RiskAssessment         │ TaskList           │
├─────────────────────────┼────────────────────────┼────────────────────┤
│  📋 规则分析团队        │                        │                    │
│  ├ rule-analyst         │ RuleBook              │ ParsedGame         │
│  │                      │ AmbiguityList         │ RuleCoverageReport │
│  ├ mechanic-extractor   │ ParsedGame            │ GameMechanics[]    │
│  │                      │                       │ MechanicGraph      │
│  ├ balance-evaluator    │ GameMechanics[]       │ BalanceReport      │
│  │                      │ StrategyProfiles      │ WinRateAnalysis    │
│  └ test-generator       │ ParsedGame            │ TestSuite          │
│                         │ GameMechanics[]       │ AcceptanceCriteria │
├─────────────────────────┼────────────────────────┼────────────────────┤
│  🎨 设计前端团队        │                        │                    │
│  ├ ui-designer          │ ParsedGame            │ UIComponentSpec[]  │
│  │                      │ GameMechanics[]       │ LayoutSpec         │
│  ├ interaction-designer │ UIComponentSpec[]     │ InteractionFlow    │
│  │                      │ GameMechanics[]       │ UXSpec             │
│  ├ visual-designer      │ GameTheme             │ VisualAssetSpec    │
│  │                      │ UIComponentSpec[]      │ ColorPalette       │
│  └ animation-effects    │ InteractionFlow       │ AnimationSpec      │
│                         │ GameMechanics[]        │ EffectLibrary      │
├─────────────────────────┼────────────────────────┼────────────────────┤
│  ⚙️ 后端游戏团队        │                        │                    │
│  ├ game-engine-dev      │ GameMechanics[]       │ GameStateClass     │
│  │                      │ PhaseSpec[]           │ RuleEngineClass    │
│  │                      │ ComponentSpec[]        │ ActionHandler[]    │
│  ├ multiplayer-arc     │ GameStateClass        │ SyncProtocol       │
│  │                      │ InteractionFlow       │ RoomManagerSpec    │
│  ├ ai-opponent-dev      │ GameMechanics[]       │ AIEngineClass      │
│  │                      │ StrategyProfiles      │ DifficultyConfig   │
│  ├ social-features-dev  │ ParsedGame            │ SocialFeatureSpec[]│
│  │                      │                       │ ChatSystemSpec     │
│  └ data-engineer        │ GameStateClass        │ AnalyticsSchema    │
│                         │ EventLogSpec          │ DashboardSpec      │
├─────────────────────────┼────────────────────────┼────────────────────┤
│  🔧 测试运维团队        │                        │                    │
│  ├ qa-engineer          │ TestSuite             │ TestReport         │
│  │                      │ BuildArtifact         │ BugReport          │
│  ├ automation-qa        │ TestSuite             │ TestFramework      │
│  │                      │ AcceptanceCriteria    │ CI/CDPipeline      │
│  └ devops-engineer      │ BuildArtifact         │ DeploymentSpec     │
│                         │ TestReport            │ MonitorConfig      │
└─────────────────────────┴────────────────────────┴────────────────────┘
```

---

## 二、详细映射定义

### 2.1 规则分析团队

#### rule-analyst — 规则解析专家

```typescript
// 输入
interface RuleAnalyst_Input {
  ruleBook: RuleBook;              // 原始规则书（PDF/文本/URL）
  referenceMaterials?: Reference[]; // 参考资料（BGG页面、视频、论坛）
}

// 输出
interface RuleAnalyst_Output {
  // META-MODEL 类型
  parsedGame: ParsedGame;          // 解析后的游戏对象 ⭐OWNER
  
  // 报告
  ruleCoverageReport: RuleCoverageReport;  // 规则覆盖率报告
  ambiguityList: AmbiguityList;    // 歧义列表 ⭐OWNER
  
  // 元数据
  complexityAssessment: ComplexityTier;   // 复杂度分级
  estimatedHours: number;          // 预计工时
}

// 所有权声明
const RULE_ANALYST_OWNERSHIP = {
  modelsOwned: ['ParsedGame', 'AmbiguityList'],
  modelsConsumed: [],
  modelsValidated: ['RuleBook']
};
```

#### mechanic-extractor — 玩法提炼专家

```typescript
// 输入
interface MechanicExtractor_Input {
  parsedGame: ParsedGame;          // 来自 rule-analyst
  ambiguityList: AmbiguityList;    // 来自 rule-analyst
}

// 输出
interface MechanicExtractor_Output {
  // META-MODEL 类型
  gameMechanics: GameMechanic[];   // 核心机制列表 ⭐OWNER
  mechanicGraph: MechanicGraph;    // 机制依赖图 ⭐OWNER
  
  // 模式匹配结果
  matchedPatterns: PatternMatch[];  // 匹配到的模式库模式
  reusableModules: ReuseCandidate[]; // 可复用模块
  
  // 阶段结构
  phaseSpec: PhaseSpec[];          // 阶段规格 ⭐OWNER
  componentSpec: ComponentSpec[];  // 组件规格 ⭐OWNER
}

// 所有权声明
const MECHANIC_EXTRACTOR_OWNERSHIP = {
  modelsOwned: ['GameMechanic', 'MechanicGraph', 'PhaseSpec', 'ComponentSpec'],
  modelsConsumed: ['ParsedGame', 'AmbiguityList'],
  modelsValidated: []
};
```

#### balance-evaluator — 平衡性评估专家

```typescript
// 输入
interface BalanceEvaluator_Input {
  gameMechanics: GameMechanic[];   // 来自 mechanic-extractor
  phaseSpec: PhaseSpec[];
  componentSpec: ComponentSpec[];
}

// 输出
interface BalanceEvaluator_Output {
  // META-MODEL 类型
  balanceReport: BalanceReport;    // 平衡性报告 ⭐OWNER
  winRateAnalysis: WinRateAnalysis; // 胜率分析 ⭐OWNER
  strategyProfiles: StrategyProfile[]; // 策略画像 ⭐OWNER
  
  // 建议
  balanceAdjustments: Adjustment[]; // 调整建议
  riskAssessment: BalanceRisk[];   // 风险评估
}

// 所有权声明
const BALANCE_EVALUATOR_OWNERSHIP = {
  modelsOwned: ['BalanceReport', 'WinRateAnalysis', 'StrategyProfile'],
  modelsConsumed: ['GameMechanic', 'PhaseSpec', 'ComponentSpec'],
  modelsValidated: []
};
```

#### test-generator — 测试生成专家

```typescript
// 输入
interface TestGenerator_Input {
  parsedGame: ParsedGame;          // 来自 rule-analyst
  gameMechanics: GameMechanic[];   // 来自 mechanic-extractor
  balanceReport: BalanceReport;    // 来自 balance-evaluator
  componentSpec: ComponentSpec[];
}

// 输出
interface TestGenerator_Output {
  // META-MODEL 类型
  testSuite: TestSuite;            // 测试套件 ⭐OWNER
  acceptanceCriteria: AcceptanceCriteria; // 验收标准 ⭐OWNER
  
  // 测试数据
  testCaseLibrary: TestCase[];    // 测试用例库
  boundaryConditions: EdgeCase[];   // 边界条件
  stochasticTests: StochasticTest[]; // 随机性测试
}

// 所有权声明
const TEST_GENERATOR_OWNERSHIP = {
  modelsOwned: ['TestSuite', 'AcceptanceCriteria'],
  modelsConsumed: ['ParsedGame', 'GameMechanic', 'BalanceReport', 'ComponentSpec'],
  modelsValidated: []
};
```

---

## 三、后端游戏团队映射

#### game-engine-dev — 游戏引擎开发

```typescript
// 输入
interface GameEngineDev_Input {
  gameMechanics: GameMechanic[];  // 来自 mechanic-extractor
  phaseSpec: PhaseSpec[];         // 来自 mechanic-extractor
  componentSpec: ComponentSpec[];  // 来自 mechanic-extractor
  interactionFlow: InteractionFlow; // 来自 interaction-designer
}

// 输出
interface GameEngineDev_Output {
  // META-MODEL 类型
  gameStateClass: GameStateClass; // 游戏状态类 ⭐OWNER
  ruleEngineClass: RuleEngineClass; // 规则引擎类 ⭐OWNER
  actionHandlerClass: ActionHandlerClass[]; // 动作处理器 ⭐OWNER
  
  // 运行时类型
  stateTransition: StateTransition[]; // 状态转移定义 ⭐OWNER
  componentRuntime: ComponentRuntime[]; // 运行时组件 ⭐OWNER
  
  // 代码产出
  sourceCode: SourceFile[];
  apiSpec: APISpec;
}

// 所有权声明
const GAME_ENGINE_DEV_OWNERSHIP = {
  modelsOwned: ['GameStateClass', 'RuleEngineClass', 'ActionHandler', 'StateTransition', 'ComponentRuntime'],
  modelsConsumed: ['GameMechanic', 'PhaseSpec', 'ComponentSpec', 'InteractionFlow'],
  modelsValidated: ['TestSuite']  // 用 TestSuite 验证实现
};
```

#### multiplayer-architect — 多人架构专家

```typescript
// 输入
interface MultiplayerArchitect_Input {
  gameStateClass: GameStateClass;  // 来自 game-engine-dev
  interactionFlow: InteractionFlow; // 来自 interaction-designer
  phaseSpec: PhaseSpec[];          // 来自 mechanic-extractor
}

// 输出
interface MultiplayerArchitect_Output {
  // META-MODEL 类型
  syncProtocol: SyncProtocol;       // 同步协议 ⭐OWNER
  roomManagerSpec: RoomManagerSpec; // 房间管理规格 ⭐OWNER
  
  // 多人专用类型
  reconnectSpec: ReconnectSpec;     // 断线重连规格 ⭐OWNER
  spectatorSpec: SpectatorSpec;    // 观战系统规格 ⭐OWNER
  antiCheatSpec: AntiCheatSpec;    // 防作弊规格 ⭐OWNER
  
  // 代码产出
  sourceCode: SourceFile[];
}

// 所有权声明
const MULTIPLAYER_ARCHITECT_OWNERSHIP = {
  modelsOwned: ['SyncProtocol', 'RoomManagerSpec', 'ReconnectSpec', 'SpectatorSpec', 'AntiCheatSpec'],
  modelsConsumed: ['GameStateClass', 'InteractionFlow', 'PhaseSpec'],
  modelsValidated: []
};
```

#### ai-opponent-dev — AI对手开发

```typescript
// 输入
interface AIOpponentDev_Input {
  gameMechanics: GameMechanic[];   // 来自 mechanic-extractor
  strategyProfiles: StrategyProfile[]; // 来自 balance-evaluator
  gameStateClass: GameStateClass;  // 来自 game-engine-dev
  phaseSpec: PhaseSpec[];
}

// 输出
interface AIOpponentDev_Output {
  // META-MODEL 类型
  aiEngineClass: AIEngineClass;   // AI引擎类 ⭐OWNER
  difficultyConfig: DifficultyConfig; // 难度配置 ⭐OWNER
  
  // AI专用类型
  evaluationFunction: EvalFunctionSpec; // 评估函数 ⭐OWNER
  searchStrategy: SearchStrategySpec;   // 搜索策略 ⭐OWNER
  learningModule: LearningModuleSpec;    // 学习模块 ⭐OWNER
  
  // 代码产出
  sourceCode: SourceFile[];
}

// 所有权声明
const AI_OPPONENT_DEV_OWNERSHIP = {
  modelsOwned: ['AIEngineClass', 'DifficultyConfig', 'EvaluationFunction', 'SearchStrategy', 'LearningModule'],
  modelsConsumed: ['GameMechanic', 'StrategyProfile', 'GameStateClass', 'PhaseSpec'],
  modelsValidated: ['TestSuite', 'WinRateAnalysis']  // 用测试验证AI强度
};
```

---

## 四、设计团队映射

#### ui-designer — UI架构师

```typescript
// 输入
interface UIDesigner_Input {
  parsedGame: ParsedGame;         // 来自 rule-analyst
  gameMechanics: GameMechanic[];   // 来自 mechanic-extractor
  componentSpec: ComponentSpec[];  // 来自 mechanic-extractor
}

// 输出
interface UIDesigner_Output {
  // META-MODEL 类型
  uiComponentSpec: UIComponentSpec[]; // UI组件规格 ⭐OWNER
  layoutSpec: LayoutSpec;         // 布局规格 ⭐OWNER
  
  // 设计产出
  wireframeFiles: File[];
  componentLibrary: ComponentLibrarySpec;
  responsiveSpec: ResponsiveSpec;
}

// 所有权声明
const UI_DESIGNER_OWNERSHIP = {
  modelsOwned: ['UIComponentSpec', 'LayoutSpec'],
  modelsConsumed: ['ParsedGame', 'GameMechanic', 'ComponentSpec'],
  modelsValidated: []
};
```

#### interaction-designer — UX交互设计专家

```typescript
// 输入
interface InteractionDesigner_Input {
  uiComponentSpec: UIComponentSpec[]; // 来自 ui-designer
  gameMechanics: GameMechanic[];       // 来自 mechanic-extractor
  phaseSpec: PhaseSpec[];              // 来自 mechanic-extractor
}

// 输出
interface InteractionDesigner_Output {
  // META-MODEL 类型
  interactionFlow: InteractionFlow;    // 交互流程 ⭐OWNER (被多人架构引用!)
  uxSpec: UXSpec;                     // UX规格 ⭐OWNER
  
  // 交互模型
  gestureMap: GestureMap;              // 手势映射 ⭐OWNER
  feedbackSpec: FeedbackSpec;          // 反馈规格 ⭐OWNER
  accessibilitySpec: AccessibilitySpec; // 无障碍规格 ⭐OWNER
  
  // Handoff 关键点：这个 output 是 game-engine-dev 和 multiplayer-architect 的输入
}

// 所有权声明
const INTERACTION_DESIGNER_OWNERSHIP = {
  modelsOwned: ['InteractionFlow', 'UXSpec', 'GestureMap', 'FeedbackSpec', 'AccessibilitySpec'],
  modelsConsumed: ['UIComponentSpec', 'GameMechanic', 'PhaseSpec'],
  modelsValidated: ['TestSuite']  // 用测试验证交互正确性
};
```

---

## 五、数据流与依赖图

### 5.1 核心数据流

```
                    ┌──────────────────┐
                    │   RuleBook       │
                    │  (原始输入)       │
                    └────────┬─────────┘
                             │
                             ▼
               ┌─────────────────────────┐
               │     rule-analyst       │
               │  输出: ParsedGame      │
               │       AmbiguityList    │
               └───────────┬────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │mechanic-     │ │balance-      │ │test-         │
   │extractor     │ │evaluator     │ │generator     │
   │              │ │              │ │              │
   │输入:         │ │输入:         │ │输入:         │
   │ParsedGame    │ │GameMechanics │ │ParsedGame    │
   │AmbiguityList │ │StrategyProf  │ │GameMechanics │
   │              │ │              │ │BalanceReport │
   │输出:         │ │输出:         │ │              │
   │GameMechanics │ │BalanceReport │ │输出:         │
   │PhaseSpec     │ │WinRateAnalysis│ │TestSuite    │
   │ComponentSpec │ │StrategyProfile│ │AcceptCriteria│
   └──────┬───────┘ └──────────────┘ └──────┬───────┘
          │                                  │
          │    ┌─────────────────────────────┤
          │    │                             │
          ▼    ▼                             ▼
   ┌──────────────────────────────────────────────────┐
   │                 game-engine-dev                   │
   │                                                  │
   │  输入: GameMechanics, PhaseSpec, ComponentSpec,   │
   │        InteractionFlow                           │
   │                                                  │
   │  输出: GameStateClass, RuleEngineClass,           │
   │        StateTransition, ComponentRuntime         │
   └─────────────────────────┬────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │multiplayer-   │ │ai-opponent-  │ │ui-designer   │
   │architect      │ │dev           │ │              │
   │              │ │              │ │输入:         │
   │输入:         │ │输入:         │ │ParsedGame    │
   │GameStateClass│ │GameMechanics │ │GameMechanics │
   │InteractionFlow│ │StrategyProfile│ │ComponentSpec │
   │PhaseSpec     │ │GameStateClass│ │              │
   │              │ │              │ │输出:         │
   │输出:         │ │输出:         │ │UIComponentSpec│
   │SyncProtocol  │ │AIEngineClass │ │LayoutSpec    │
   │RoomManager   │ │DifficultyConfig│              │
   └──────────────┘ └──────────────┘ └──────────────┘
```

### 5.2 关键依赖关系（必须按顺序）

```
RULE_ANALYST → MECHANIC_EXTRACTOR → GAME_ENGINE_DEV
    ↓                ↓                    ↓
    ↓                ↓                    ↓
TEST_GENERATOR   BALANCE_EVALUATOR   MULTIPLAYER_ARCH
    ↓                ↓                    ↓
    └────────────────┼────────────────────┘
                     ↓
              QA_ENGINEER
```

---

## 六、冲突仲裁规则

### 6.1 同一类型被多个Agent声明为Owner

**场景**：如果两个 Agent 都声称是某个 Model 的 Owner

**规则**：
1. 查找 `RULE_ANALYST > MECHANIC_EXTRACTOR > GAME_ENGINE_DEV` 主线
2. 优先给主线上最下游的 Agent
3. 上游 Agent 降级为 "Contributor"

```typescript
// 仲裁决策示例
const ownershipResolution = {
  model: 'PhaseSpec',
  claimedBy: ['mechanic-extractor', 'game-engine-dev'],
  resolution: {
    owner: 'game-engine-dev',  // 更接近实现
    contributor: 'mechanic-extractor',  // 提供输入
    reason: 'game-engine-dev是PhaseSpec的主要实现者'
  }
};
```

### 6.2 上游模型变更导致下游不兼容

**场景**：rule-analyst 修改了 ParsedGame 结构

**规则**：
1. 下游所有 Agent 收到 `model_change` 事件
2. 下游 Agent 有 3 种响应策略：
   - `ADAPT`: 立即适配（minor change）
   - `REVIEW`: 暂停审查影响（major change）
   - `ESCALATE`: 升级到项目总监（breaking change）

```typescript
interface ModelChangeEvent {
  model: string;
  version: { from: string; to: string };
  severity: 'minor' | 'major' | 'breaking';
  affectedAgents: string[];
  recommendedAction: 'ADAPT' | 'REVIEW' | 'ESCALATE';
}
```

---

## 七、版本兼容性矩阵

| 下游Agent \ 上游Model | ParsedGame | GameMechanics | PhaseSpec | ComponentSpec |
|----------------------|------------|---------------|-----------|---------------|
| mechanic-extractor | v1.0+ | - | - | - |
| test-generator | v1.0+ | v1.0+ | - | v1.0+ |
| game-engine-dev | v1.0+ | v1.1+ | v1.0+ | v1.0+ |
| multiplayer-arc | - | - | v1.0+ | - |
| ai-opponent-dev | - | v1.0+ | v1.0+ | - |

---

*Agent-Model Mapping v1.0*
