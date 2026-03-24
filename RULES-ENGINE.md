# Rules Engine — 权威游戏状态仲裁者

> 所有游戏动作必须通过此验证层才能执行

---

## 一、为什么需要独立的规则引擎

```
传统架构（有问题）:
┌─────────┐    ┌─────────┐    ┌─────────┐
│ Agent A │ -> │ Agent B │ -> │ Agent C │ -> 状态变更
└─────────┘    └─────────┘    └─────────┘
                    ↑
              Agent B可能提出非法动作
              REVERT不能替代预防

引入规则引擎后:
┌─────────┐    ┌─────────────────┐    ┌─────────┐
│ Agent A │ -> │  Rules Engine   │ -> │ Agent C │ -> 状态变更
└─────────┘    │  (验证层/仲裁者) │    └─────────┘
                    ↑
               所有动作必须先验证
               非法动作被阻止，不是回滚
```

---

## 二、核心架构

### 2.1 Rules Engine 作为独立服务

```typescript
// Rules Engine 是无状态的验证层
// 它不持有游戏状态，只验证动作的合法性

interface RulesEngine {
  // 验证单个动作
  validateMove(
    gameType: GameType,
    currentState: GameState,
    proposedMove: Move
  ): ValidationResult;
  
  // 批量验证（用于AI搜索）
  validateMoves(
    gameType: GameType,
    currentState: GameState,
    proposedMoves: Move[]
  ): BatchValidationResult;
  
  // 获取所有合法动作
  getLegalMoves(
    gameType: GameType,
    currentState: GameState,
    player: PlayerId
  ): Move[];
  
  // 验证完整游戏状态
  validateState(
    gameType: GameType,
    state: GameState
  ): StateValidationResult;
}
```

### 2.2 验证结果

```typescript
type ValidationResult = 
  | { valid: true; }
  | { 
      valid: false; 
      reason: ValidationFailure;
      context: FailureContext;
    };

interface ValidationFailure {
  type: FailureType;
  message: string;
  code: string;  // e.g., "ILLEGAL_MOVE", "WRONG_PLAYER", "OUT_OF_TURN"
}

type FailureType = 
  | 'illegal_move'           // 动作本身不合法
  | 'wrong_player'           // 不是该玩家的回合
  | 'insufficient_resources' // 资源不足
  | 'wrong_phase'            // 不在正确的阶段
  | 'not_enough_components'  // 组件数量不足
  | 'violates_invariant'     // 违反游戏不变式
  | 'timing_violation'       // 时序违规
  | 'hidden_information_access'; // 访问了隐藏信息

interface FailureContext {
  player: PlayerId;
  attemptedMove: Move;
  currentPhase: string;
  relevantState: Partial<GameState>;  // 相关的部分状态
  suggestion?: Move;  // 如果有替代方案
}
```

---

## 三、验证超时与默认拒绝（ P0 生产必选 ）

### 3.0 问题：游戏冻结

**问题描述：** 规则引擎验证过程中挂起 → 游戏冻结，无人知道动作是被接受还是拒绝

**解决方案：** 验证超时 → 默认拒绝（ fail-safe default ）

```typescript
interface ValidationConfig {
  timeoutMs: number;           // 超时阈值（毫秒），默认: 5000ms
  maxRetries: number;         // 最大重试次数，默认: 0
  retryDelayMs: number;       // 重试间隔（毫秒），默认: 0
  onTimeout: ValidationAction; // 超时默认行为，默认: DENY
}

enum ValidationAction {
  DENY    = "DENY",    // fail-safe：拒绝
  ALLOW   = "ALLOW",   // 仅在明确安全时使用
  QUEUE   = "QUEUE",   // 排队等待（引入不确定性）
}
```

**超时行为规范：**

| 场景 | 默认行为 | 可配置项 |
|------|---------|---------|
| 验证请求超时 | **DENY**（拒绝） | `onTimeout: ALLOW` 仅限明确安全的操作 |
| 规则引擎完全不可用 | **DENY**（拒绝） | 熔断器触发后保持拒绝 |
| 验证结果损坏/截断 | **DENY**（拒绝） | 日志记录，等效超时处理 |
| AI模型推理超时 | **DENY**（拒绝） | 人类审核升级选项 |

**超时实现示例：**

```typescript
async function validateWithTimeout(
  engine: RulesEngine,
  gameType: GameType,
  state: GameState,
  move: Move,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): Promise<ValidationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  
  try {
    const result = await Promise.race([
      engine.validateMove(gameType, state, move),
      new Promise<never>((_, reject) => 
        controller.signal.addEventListener('abort', () => 
          reject(new ValidationTimeoutError(config.timeoutMs))
        )
      )
    ]);
    
    clearTimeout(timeout);
    return result;
    
  } catch (error) {
    clearTimeout(timeout);
    
    if (error instanceof ValidationTimeoutError) {
      return {
        valid: false,
        failureType: "validation_timeout",
        message: `Validation exceeded ${config.timeoutMs}ms timeout`,
        recommendedAction: "RETRY_WITH_HUMAN_REVIEW",
        timestamp: Date.now()
      };
    }
    
    return {
      valid: false,
      failureType: "validation_error",
      message: error.message,
      recommendedAction: "ESCALATE_TO_HUMAN",
      timestamp: Date.now()
    };
  }
}

const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  timeoutMs: 5000,        // 5秒超时
  maxRetries: 0,          // 不重试
  retryDelayMs: 0,
  onTimeout: ValidationAction.DENY  // 默认拒绝
};
```

**超时配置建议：**

| 游戏复杂度 | 建议超时 | 说明 |
|-----------|---------|------|
| Tier 1 (UNO, 扑克) | 2000ms | 规则简单，验证快 |
| Tier 2 (卡坦岛, 卡卡颂) | 5000ms | 中等复杂度 |
| Tier 3 (神秘大地, 运转空间) | 10000ms | 复杂规则需要更多时间 |
| Tier 4 (自定义/实验) | 15000ms | 极高复杂度或AI推理 |

**游戏冻结预防流程：**

```
正常流程:
  Move → Validate(≤5s) → Accept → Execute

超时流程:
  Move → Validate(>5s) → ❌ TIMEOUT → DENY → 玩家重新提交

熔断流程:
  Move → Validate → ❌ CircuitOpen → DENY → 快速失败，不阻塞
```

---

## 四、游戏规则Schema

### 4.1 规则定义结构

```typescript
// 每个桌游必须定义其规则Schema
// 这是一个声明式的规则定义，不是代码

interface GameRulesSchema {
  id: GameType;  // "catan", "uno", "chess"
  version: string;
  
  // 游戏基本属性
  basic: {
    minPlayers: number;
    maxPlayers: number;
    typicalDuration: Duration;  // 分钟
  };
  
  // 玩家回合规则
  turnStructure: TurnStructure;
  
  // 组件约束
  componentConstraints: ComponentConstraint[];
  
  // 不变式（游戏始终保持的性质）
  invariants: Invariant[];
  
  // 动作类型定义
  moveTypes: MoveType[];
  
  // 胜负条件
  winConditions: WinCondition[];
  
  // 特殊规则
  specialRules?: SpecialRule[];
}

interface TurnStructure {
  phases: PhaseDefinition[];
  turnOrder: TurnOrderType;
  turnLimit?: number;  // 无限制时为 undefined
}

type TurnOrderType = 
  | 'simultaneous'        // 同时出牌
  | 'sequential'          // 顺序出牌
  | 'rotating'            // 轮转
  | 'action_point'         // 行动点分配
  | 'custom';

interface PhaseDefinition {
  id: string;
  name: string;
  allowedMoves: MoveType[];
  autoAdvance?: boolean;  // 是否自动进入下一阶段
  timeLimit?: number;    // 阶段时间限制(ms)
}

interface ComponentConstraint {
  componentType: ComponentType;
  constraints: {
    minQuantity?: number;
    maxQuantity?: number;
    perPlayer?: boolean;  // 是否按玩家限制
    global?: boolean;     // 是否全局限制
  };
}

interface Invariant {
  id: string;
  description: string;
  check: StatePredicate;  // 必须在任何时刻满足
}
```

### 4.2 Catan 规则 Schema 示例

```typescript
const CATAN_RULES_SCHEMA: GameRulesSchema = {
  id: 'catan',
  version: '1.0',
  
  basic: {
    minPlayers: 3,
    maxPlayers: 4,
    typicalDuration: 90
  },
  
  turnStructure: {
    phases: [
      { id: 'roll', name: '投骰', allowedMoves: ['ROLL_DICE'] },
      { id: 'trade', name: '交易', allowedMoves: ['OFFER_TRADE', 'ACCEPT_TRADE', 'DECLINE_TRADE'] },
      { id: 'build', name: '建设', allowedMoves: ['BUILD_ROAD', 'BUILD_SETTLEMENT', 'BUILD_CITY', 'BUY_CARD'] },
      { id: 'end', name: '结束', allowedMoves: ['END_TURN'] }
    ],
    turnOrder: 'sequential'
  },
  
  componentConstraints: [
    { componentType: 'road', constraints: { perPlayer: true, maxQuantity: 15 } },
    { componentType: 'settlement', constraints: { perPlayer: true, maxQuantity: 5 } },
    { componentType: 'city', constraints: { perPlayer: true, maxQuantity: 4 } },
    { componentType: 'dev_card', constraints: { perPlayer: true } }
  ],
  
  invariants: [
    {
      id: 'road_connected',
      description: '道路必须连接到己方建筑',
      check: (state) => allRoadsConnectedToSettlements(state)
    },
    {
      id: 'no_adjacent_settlements',
      description: '不能在相邻格子上建定居点',
      check: (state) => noAdjacentSettlements(state)
    },
    {
      id: 'resource_conservation',
      description: '资源总量守恒',
      check: (state) => resourceConservation(state)
    }
  ],
  
  moveTypes: [
    {
      type: 'ROLL_DICE',
      params: [],
      validation: (state) => state.phase === 'roll'
    },
    {
      type: 'BUILD_ROAD',
      params: [{ name: 'position', type: 'EdgeLocation' }],
      validation: (state, params) => 
        hasResources(state, 'road') && 
        canPlaceRoad(state, params.position)
    }
  ],
  
  winConditions: [
    {
      type: 'points',
      target: 10,
      description: '首先获得10分的玩家获胜'
    }
  ]
};
```

---

## 五、验证层集成

### 5.1 与 Agent 的集成

```typescript
// 每个 Agent 的产出必须经过 Rules Engine 验证
// 这是强制性的，不是可选的

interface AgentOutput {
  agentId: string;
  outputType: string;
  proposedMoves?: Move[];  // 如果涉及动作提案
  
  // 验证结果
  validation?: {
    passed: boolean;
    validatorVersion: string;
    checkedAt: timestamp;
    failures?: ValidationFailure[];
  };
}

// 示例：game-engine-dev 提出新动作
const agentOutput: AgentOutput = {
  agentId: 'game-engine-dev',
  outputType: 'STATE_TRANSITION',
  proposedMoves: [
    { type: 'BUILD_ROAD', position: { edge: 'E12' } }
  ]
};

// 必须调用 Rules Engine 验证
const result = rulesEngine.validateMoves(
  'catan',
  currentState,
  agentOutput.proposedMoves
);

// 如果验证失败，Agent 必须修复后重新提交
if (!result.valid) {
  return {
    status: 'REJECTED',
    reason: result.failures,
    requiredFix: result.suggestions
  };
}
```

### 5.2 与游戏引擎的集成

```typescript
// 游戏引擎在执行每个动作前必须调用 Rules Engine

class GameEngine {
  private rulesEngine: RulesEngine;
  
  async executeMove(move: Move): Promise<ExecutionResult> {
    // 1. 验证动作合法性（预防性）
    const validation = this.rulesEngine.validateMove(
      this.gameType,
      this.currentState,
      move
    );
    
    if (!validation.valid) {
      // 非法动作被阻止，不是回滚
      return {
        success: false,
        error: validation.reason
      };
    }
    
    // 2. 执行动作
    const newState = this.applyMove(this.currentState, move);
    
    // 3. 验证状态不变式（完整性检查）
    const stateValidation = this.rulesEngine.validateState(
      this.gameType,
      newState
    );
    
    if (!stateValidation.valid) {
      // 状态异常，触发错误处理
      throw new InvariantViolationError(stateValidation.errors);
    }
    
    // 4. 更新状态
    this.currentState = newState;
    
    return { success: true, newState };
  }
}
```

### 5.3 与 META-MODEL 的绑定

```typescript
// Rules Engine 的规则 Schema 必须与 META-MODEL 对齐

// META-MODEL 定义了运行时模型
// Rules Engine 定义了这些模型的约束规则

interface GameTypeBinding {
  metaModel: {
    gameStateClass: typeof BoardGame;  // META-MODEL 中的类
    componentTypes: ComponentType[];
    phases: Phase[];
    actions: GameAction[];
  };
  
  rulesSchema: GameRulesSchema;  // 对应的规则定义
  
  // 验证映射是否一致
  consistencyCheck: () => ConsistencyResult;
}
```

---

## 六、FEN — 游戏状态序列化格式

> FEN (Forsyth-Edwards Notation) 是一种简洁的游戏状态表示法
> 最初用于 Chess，现在扩展到其他游戏

### 5.1 FEN 设计原则

```typescript
// FEN 格式要求：
// 1. 人类可读
// 2. 紧凑（适合 URL、日志）
// 3. 可逆（可以从 FEN 重建完整状态）

interface FENFormat {
  // 格式版本
  version: '1.0';
  
  // 游戏标识
  gameType: GameType;
  
  // 核心字段（每个字段用 / 分隔）
  fields: {
    [fieldName: string]: string | number;
  };
  
  // 元数据
  metadata: {
    createdAt: timestamp;
    moveNumber?: number;
    ruleVersion: string;
  };
}
```

### 5.2 Catan FEN 格式

```typescript
// Catan FEN 格式
// 格式: <board>/<resources>/<devCards>/<turn>/<phase>/<currentPlayer>

// 示例:
// 14H2W1S3/player1:5W2L;player2:3W1L;player3:4W;player4:2W3L/
// player1:2K1R1M;player2:1R;player3:0;player4:1K/
// 7/roll/player1

interface CatanFEN {
  // 板块布局 (14个六边形)
  // H=荒地, W=小麦, L=木头, O=羊毛, I=铁, D=沙漠
  board: string;  // "14H2W1S3..."
  
  // 玩家资源
  // 格式: playerId:ResourceCount;...
  resources: string;  // "player1:5W2L;player2:3W1L"
  
  // 玩家发展卡
  devCards: string;  // "player1:2K1R1M;player2:1R"
  
  // 回合数
  turn: number;
  
  // 当前阶段
  phase: 'roll' | 'trade' | 'build' | 'end';
  
  // 当前玩家
  currentPlayer: PlayerId;
}

// 编码/解码
function encodeCatanFEN(state: CatanGameState): CatanFEN {
  return {
    board: encodeHexTiles(state.hexTiles),
    resources: encodePlayerResources(state.players),
    devCards: encodeDevCards(state.players),
    turn: state.turn,
    phase: state.phase,
    currentPlayer: state.activePlayer
  };
}

function decodeCatanFEN(fen: CatanFEN): CatanGameState {
  return {
    hexTiles: decodeHexTiles(fen.board),
    players: decodePlayerResources(fen.resources),
    turn: fen.turn,
    phase: fen.phase,
    activePlayer: fen.currentPlayer
  };
}
```

### 5.3 通用 FEN 格式

```typescript
// 通用游戏状态 FEN（用于不支持特定格式的游戏）

interface GenericFEN {
  // 版本
  v: string;  // "1.0"
  
  // 游戏类型
  g: GameType;
  
  // 玩家数
  n: number;
  
  // 玩家状态
  p: {
    id: PlayerId;
    resources: Record<ResourceType, number>;
    components: Record<ComponentType, number>;
    score: number;
    active: boolean;
  }[];
  
  // 公共状态
  s: {
    [key: string]: any;  // 游戏特定状态
  };
  
  // 时间戳
  t: timestamp;
  
  // 回合信息
  r: {
    number: number;
    phase: string;
    currentPlayer: PlayerId;
  };
}

// 示例：Chess FEN
// rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
```

### 5.4 FEN 用途

```typescript
const FEN_USE_CASES = {
  // 1. 状态快照/回放
  snapshot: {
    description: '保存游戏任意时刻的状态',
    example: '/save/catan/ABCDEF...',  // URL-safe
    storage: 'logs/state_snapshots/'
  },
  
  // 2. 日志回放
  replay: {
    description: '通过 FEN + MoveList 重放完整游戏',
    protocol: 'REPLAY protocol in OBSERVABILITY.md',
    tools: 'boardgame-cli replay --game=catan --from=FEN --moves=...'
  },
  
  // 3. fork/分支
  fork: {
    description: '从特定状态 fork 出新的游戏路径（反事实模拟）',
    useCase: 'AI训练、平衡性测试'
  },
  
  // 4. 调试/问题排查
  debug: {
    description: '分享特定状态给开发者调试',
    example: 'boardgame-cli debug --state=FEN'
  },
  
  // 5. 状态校验
  validation: {
    description: '验证 FEN 是否有效',
    checks: ['schema_valid', 'resource_conservation', 'invariant_check']
  }
};
```

---

## 七、防作弊验证

### 6.1 隐藏信息保护

```typescript
// Rules Engine 必须验证玩家不能访问隐藏信息

interface HiddenInformationRules {
  // 检查玩家只能看到允许看到的信息
  validateVisibility(
    state: GameState,
    player: PlayerId,
    requestedInfo: InformationRequest
  ): VisibilityResult;
}

const VISIBILITY_CHECKS = {
  // Catan 示例
  catan: {
    // 玩家看不到其他玩家的手牌
    hiddenComponents: ['dev_card_hand', 'resource_hand'],
    
    // 玩家看不到尚未翻开的板块
    hiddenBoard: ['unflipped_hex'],
    
    // 玩家看不到未来事件
    hiddenFuture: ['upcoming_event_deck', 'shuffled_cards']
  },
  
  // Poker 示例
  poker: {
    hiddenComponents: ['opponent_hand', 'deck_remaining'],
    hiddenBoard: ['burn_cards']
  }
};
```

### 6.2 防作弊规则

```typescript
// Rules Engine 必须防止常见的作弊模式

const ANTI_CHEAT_RULES = {
  // 1. 不能在回合外行动
  turnIntegrity: {
    check: (state, move) => 
      move.player === state.activePlayer || 
      move.type === 'GLOBAL_CHAT',
    violation: 'OUT_OF_TURN_ACTION'
  },
  
  // 2. 不能访问禁用信息
  informationIntegrity: {
    check: (state, move, player) => {
      const hidden = getHiddenInformation(state, player);
      return !containsHiddenInfo(move.requestedInfo, hidden);
    },
    violation: 'HIDDEN_INFO_ACCESS'
  },
  
  // 3. 资源不能为负
  resourceIntegrity: {
    check: (state) => 
      allResourcesNonNegative(state.players),
    violation: 'NEGATIVE_RESOURCES'
  },
  
  // 4. 动作必须按顺序
  sequenceIntegrity: {
    check: (state, move) => {
      const requiredPhase = getRequiredPhase(move.type);
      return state.phase === requiredPhase;
    },
    violation: 'WRONG_PHASE'
  },
  
  // 5. 状态历史一致性
  historyIntegrity: {
    check: (state, move, history) => {
      // 验证这个动作与历史一致（防重放攻击）
      return verifyMoveConsistency(history, move);
    },
    violation: 'HISTORY_INCONSISTENCY'
  }
};
```

---

## 八、与 OBSERVABILITY.md 的集成

```typescript
// Rules Engine 的验证结果必须记录到 Trace

interface RulesEngineTrace {
  // 每次验证都记录
  traceId: string;
  moveId: string;
  
  // 输入
  input: {
    gameType: GameType;
    currentState: GameState;
    proposedMove: Move;
    player: PlayerId;
  };
  
  // 验证结果
  result: ValidationResult;
  
  // 性能
  validationDuration: number;  // ms
  
  // 缓存
  cacheHit: boolean;
}

// 验证失败的 Trace
interface FailedValidationTrace extends RulesEngineTrace {
  result: { valid: false; reason: ValidationFailure };
  
  // 错误分类
  errorCategory: 'ILLEGAL_MOVE' | 'TIMING' | 'RESOURCES' | 'VISIBILITY';
  
  // 是否需要人工审核
  requiresHumanReview: boolean;
  
  // 建议
  suggestedFix?: Move;
}
```

---

## 九、与 PROTOCOLS.md 的集成

```typescript
// Rules Engine 是 Agent 交接的强制检查点

// HandoffPackage 必须包含：
interface HandoffPackageV4<Output, Input> {
  // ... 现有字段 ...
  
  // 新增：规则验证
  ruleValidation?: {
    validatedBy: 'rules-engine';
    validatedAt: timestamp;
    rulesSchemaVersion: string;
    validationResult: 'pass' | 'fail';
    failures?: ValidationFailure[];
  };
}

// 交接流程
const HANDOVER_STEPS = [
  // 1. Agent 产出
  (agent) => agent.produce(),
  
  // 2. Rules Engine 验证（NEW）
  (output) => rulesEngine.validate(output),
  
  // 3. 如果验证失败 → Agent 修复
  (result) => result.valid ? 'continue' : 'agent_fix',
  
  // 4. 验证通过 → 交接给下游
  (output) => handoff.toNextAgent(output)
];
```

---

*Rules Engine v1.0 — 权威游戏状态仲裁者*
