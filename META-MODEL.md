# Board Game Meta-Model — 桌游规则元模型

> 桌游电子化的核心抽象层，让 AI Agent 能够基于模式推理而非从零构建

---

## 一、为什么需要元模型

| 传统方式 | 元模型方式 |
|---------|-----------|
| AI 从自然语言规则自由生成 | AI 基于已有模式填充/适配 |
| 规则遗漏风险高 | 模式覆盖保障完整性 |
| 每款游戏独立设计 | 70%+ 可复用已有组件 |
| 难以验证正确性 | 模式即规范，可自动检查 |

---

## 二、游戏基础元模型

### 2.1 游戏基类

```typescript
interface BoardGame {
  // 标识
  id: string;
  name: string;
  version: string;
  
  // 玩家配置
  players: PlayerConfig;
  
  // 游戏组件
  components: Component[];
  
  // 游戏阶段
  phases: Phase[];
  
  // 胜负条件
  winConditions: WinCondition[];
  
  // 随机源
  randomness: RandomSource[];
  
  // 社交交互
  socialMechanics: SocialMechanic[];
}

interface PlayerConfig {
  minPlayers: number;
  maxPlayers: number;
  optimalPlayers?: number[];
  soloMode?: boolean;
  teamMode?: boolean;
  teams?: Team[];
}

interface Team {
  id: string;
  name: string;
  playerIds: string[];
}
```

### 2.2 组件模型

```typescript
type ComponentType = 
  | 'deck'           // 卡牌堆
  | 'board'          // 游戏板
  | 'tile'           // 瓦片/板块
  | 'token'          // 指示物
  | 'cube'           // 正方体资源
  | 'meeple'         // 玩家指示物
  | 'card'           // 单张卡牌
  | 'dice'           // 骰子
  | 'token_stack'    // 叠放的token
  | 'hand'           // 手牌区
  | 'score_pad'      // 记分表
  | 'token_pool';   // 公共资源池

interface Component {
  type: ComponentType;
  id: string;
  name: string;
  
  // 数量配置
  quantity: number | { min: number; max: number };
  
  // 状态（运行时）
  state?: ComponentState;
  
  // 特殊属性
  attributes?: Record<string, any>;
}

interface Deck extends Component {
  type: 'deck';
  drawRules: DrawRule;
  shuffleRules: ShuffleRule;
  resetRules?: ResetRule;
}

interface DrawRule {
  count: number;           // 每次抽牌数
  visible: boolean;         // 是否明牌
  discardAfterDraw: boolean;
  toZone: 'hand' | 'play' | 'discard' | 'custom';
}

interface ShuffleRule {
  timing: 'on_create' | 'on_empty' | 'manual' | 'never';
  algorithm: 'fisher_yates' | 'riffle' | 'pile';
}
```

### 2.3 阶段模型

```typescript
interface Phase {
  id: string;
  name: string;
  order: number;
  
  // 阶段类型
  type: PhaseType;
  
  // 适用玩家
  players: PlayerScope;
  
  // 阶段内的动作序列
  actions: GameAction[];
  
  // 进入/退出条件
  entryCondition?: Condition;
  exitCondition?: Condition;
  
  // 超时配置
  timeout?: TimeoutConfig;
  
  // 能否跳过
  skippable: boolean;
  skipCondition?: Condition;
}

type PhaseType = 
  | 'setup'           // 初始设置
  | 'resource_gen'    // 资源生成（如掷骰）
  | 'action'          // 玩家行动
  | 'resolution'      // 结果结算
  | 'scoring'         // 计分
  | 'cleanup'         // 清理
  | 'turn_end'        // 回合结束
  | 'game_end';       // 游戏结束

interface PlayerScope {
  type: 'all' | 'active' | 'specific' | 'team' | 'none';
  playerIds?: string[];
}

interface TimeoutConfig {
  duration: number;        // 毫秒
  warningAt?: number;      // 警告时间
  onTimeout: 'skip' | 'auto_play' | 'ai_takeover' | 'end_game';
  extendedBy?: 'user_action';
}
```

---

## 三、动作系统

### 3.1 动作基类

```typescript
interface GameAction {
  id: string;
  name: string;
  type: ActionType;
  
  // 谁可以执行
  actor: PlayerScope;
  
  // 动作参数
  parameters?: ActionParameter[];
  
  // 前置条件
  preconditions: Condition[];
  
  // 效果
  effects: Effect[];
  
  // 能否取消
  cancelable: boolean;
  
  // 动画类型
  animation?: AnimationConfig;
}

type ActionType =
  | 'play_card'
  | 'discard_card'
  | 'roll_dice'
  | 'move_token'
  | 'trade'
  | 'build'
  | 'purchase'
  | 'attack'
  | 'defend'
  | 'use_ability'
  | 'vote'
  | 'reveal'
  | 'pass'
  | 'special';
```

### 3.2 条件系统

```typescript
interface Condition {
  type: 'resource' | 'card' | 'position' | 'phase' | 'player' | 'custom';
  check: (state: GameState, context: ActionContext) => boolean;
  errorMessage?: string;  // 条件不满足时的提示
}

interface ResourceCondition extends Condition {
  type: 'resource';
  player: string;
  resource: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
}

interface CardCondition extends Condition {
  type: 'card';
  zone: 'hand' | 'deck' | 'discard' | 'play';
  cardType?: string;
  owner?: string;
  minCount?: number;
}

// 示例：检查玩家是否有足够的木头
const canBuildRoad: Condition = {
  type: 'resource',
  player: 'current',
  resource: 'wood',
  operator: '>=',
  value: 1,
  errorMessage: '需要1个木头来建造道路'
};
```

### 3.3 效果系统

```typescript
interface Effect {
  id: string;
  type: EffectType;
  
  // 效果目标
  target: EffectTarget;
  
  // 效果值
  value?: number | Card | Position | any;
  
  // 条件触发
  trigger?: TriggerConfig;
}

type EffectType =
  | 'modify_resource'    // 资源变化
  | 'move_component'     // 移动组件
  | 'transfer_ownership' // 所有权转移
  | 'flip_card'         // 翻牌
  | 'reveal_card'       // 展示
  | 'add_action'        // 增加行动点
  | 'modify_score'      // 修改分数
  | 'draw_card'         // 抽牌
  | 'discard_card'      // 弃牌
  | 'apply_status'      // 施加状态
  | 'trigger_event'     // 触发事件
  | 'gain_vp';          // 获得胜利点

interface ModifyResourceEffect extends Effect {
  type: 'modify_resource';
  resource: string;
  amount: number;       // 正数增加，负数减少
  reason: string;
}

// 示例：建造道路消耗木头
const roadBuildingEffect: Effect[] = [
  {
    id: 'road_cost_wood',
    type: 'modify_resource',
    target: { player: 'current' },
    resource: 'wood',
    amount: -1,
    reason: '建造道路消耗'
  },
  {
    id: 'road_cost_brick', 
    type: 'modify_resource',
    target: { player: 'current' },
    resource: 'brick',
    amount: -1,
    reason: '建造道路消耗'
  },
  {
    id: 'place_road',
    type: 'move_component',
    target: { type: 'road', from: 'pool', to: 'board' },
    position: 'specified'
  }
];
```

---

## 四、胜负条件模型

```typescript
interface WinCondition {
  id: string;
  name: string;
  type: WinConditionType;
  
  // 检查函数
  check: (state: GameState) => WinResult;
  
  // 是否为主要胜利条件
  primary: boolean;
  
  // 显示优先级
  displayPriority: number;
}

type WinConditionType =
  | 'points'           // 分数最高获胜
  | 'elimination'      // 淘汰所有对手
  | 'objective'        // 完成特定目标
  | 'control'          // 控制特定区域/资源
  | 'survival';        // 存活到最后

interface PointsWinCondition extends WinCondition {
  type: 'points';
  scoring: ScoreConfig[];
  ties: 'tie' | 'continue' | 'specified_player';
}

interface ScoreConfig {
  source: string;        // 分源标识
  calculate: (state: GameState) => number;
  perUnit?: number;      // 每个单位多少分
}

// 示例：卡坦岛分数计算
const settlementPoints: ScoreConfig = {
  source: 'settlement',
  calculate: (state) => state.buildings.settlements.length,
  perUnit: 1
};

const largestArmy: ScoreConfig = {
  source: 'largest_army',
  calculate: (state) => state.特殊卡片.largestArmy?.owner ? 2 : 0
};
```

---

## 五、随机性模型

```typescript
interface RandomSource {
  id: string;
  type: RandomType;
  
  // 分布配置
  distribution: DistributionConfig;
  
  // 记录结果
  recordHistory: boolean;
}

type RandomType = 'dice' | 'deck_draw' | 'coin_flip' | 'spinner' | 'custom';

interface DistributionConfig {
  type: 'uniform' | 'weighted' | 'normal' | 'custom';
  outcomes?: Outcome[];
  weights?: number[];
}

interface Outcome {
  value: any;           // 结果值（数字、卡牌、事件等）
  weight: number;        // 权重
  probability?: number;  // 计算后的概率
}

// 示例：六面骰
const d6: RandomSource = {
  id: 'standard_d6',
  type: 'dice',
  distribution: {
    type: 'uniform',
    outcomes: [
      { value: 1, weight: 1 },
      { value: 2, weight: 1 },
      { value: 3, weight: 1 },
      { value: 4, weight: 1 },
      { value: 5, weight: 1 },
      { value: 6, weight: 1 }
    ]
  },
  recordHistory: true
};

// 示例：卡牌堆（特定抽卡概率）
const villageDeck: RandomSource = {
  id: 'village_deck',
  type: 'deck_draw',
  distribution: {
    type: 'weighted',
    outcomes: [
      { value: 'woodcutter', weight: 3 },
      { value: 'quarry', weight: 3 },
      { value: 'standard', weight: 10 }
    ]
  },
  recordHistory: true
};
```

---

## 六、社交机制模型

```typescript
interface SocialMechanic {
  id: string;
  type: SocialMechanicType;
  
  // 触发条件
  trigger: Condition;
  
  // 效果
  effects: SocialEffect[];
}

type SocialMechanicType =
  | 'trade'           // 交易
  | 'vote'            // 投票
  | 'negotiation'     // 谈判
  | 'betrayal'        // 背叛
  | 'alliance'        // 结盟
  | 'bluff';          // 虚张声势

interface TradeMechanic extends SocialMechanic {
  type: 'trade';
  
  rules: {
    allowedPlayers: 'any' | 'specific' | 'none';
    autoAccept: boolean;
    counterOffer: boolean;
    timeLimit?: number;
    resourceConstraints?: ResourceConstraint[];
  };
  
  // 交易限制
  restrictions: {
    blockedPlayers?: string[];  // 不能和谁交易
    blockedResources?: string[];
    maxTradesPerTurn?: number;
  };
}

// 示例：卡坦岛交易规则
const catanTrade: TradeMechanic = {
  id: 'catan_trade',
  type: 'trade',
  trigger: { type: 'phase', phase: 'trade' },
  rules: {
    allowedPlayers: 'any',
    autoAccept: false,
    counterOffer: true,
    timeLimit: 30000
  },
  restrictions: {
    maxTradesPerTurn: 99  // 无限制
  }
};
```

---

## 七、复杂度分级

```typescript
type ComplexityTier = 'simple' | 'moderate' | 'complex' | 'expert';

interface ComplexityAssessment {
  tier: ComplexityTier;
  
  // 各项复杂度指标
  metrics: {
    strategicDepth: number;      // 1-10
    ruleComplexity: number;      // 1-10
    componentComplexity: number;  // 1-10
    interactionComplexity: number; // 1-10
    randomness: number;          // 1-10
  };
  
  // 综合评分
  overallScore: number;  // 平均分
  
  // 建议的 Agent 配置
  recommendedAgents: string[];
  
  // 预计开发时间
  estimatedHours: number;
}

// 复杂度判定函数
function assessComplexity(game: BoardGame): ComplexityAssessment {
  const scores = calculateMetrics(game);
  const overall = average(scores);
  
  let tier: ComplexityTier;
  if (overall < 3) tier = 'simple';
  else if (overall < 5) tier = 'moderate';
  else if (overall < 7) tier = 'complex';
  else tier = 'expert';
  
  return {
    tier,
    metrics: scores,
    overallScore: overall,
    recommendedAgents: getRecommendedAgents(tier),
    estimatedHours: getEstimatedHours(tier)
  };
}

// 示例：UNO vs 卡坦岛 vs Gloomhaven
const unoComplexity = assessComplexity(unoGame); 
// → { tier: 'simple', overallScore: 2.1, estimatedHours: 40 }

const catanComplexity = assessComplexity(catanGame);
// → { tier: 'moderate', overallScore: 4.8, estimatedHours: 120 }

const gloomhavenComplexity = assessComplexity(gloomhavenGame);
// → { tier: 'expert', overallScore: 8.5, estimatedHours: 600+ }
```

---

## 八、模式库

### 8.1 常见游戏模式

```typescript
// 回合结构模式库
const TURNN_STRUCTURE_PATTERNS = {
  // 行动点模式（典型：卡坦岛、阿尔罕布拉）
  action_point: {
    name: '行动点模式',
    description: '玩家每回合获得固定行动点，可自由分配',
    phases: ['resource', 'action', 'cleanup'],
    typicalActions: ['build', 'trade', 'play_card'],
    implementTemplate: 'ActionPointGame'
  },
  
  // 工放模式（典型：巴厘岛、工放岛）
  worker_placement: {
    name: '工人摆放模式',
    description: '玩家将工人放到公共位置，执行动作并消耗工人',
    phases: ['worker_placement', 'resolution', 'cleanup'],
    uniqueConstraint: '同一位置不能重复放置',
    implementTemplate: 'WorkerPlacementGame'
  },
  
  // 手牌管理模式（典型：UNO、烧烤）
  hand_management: {
    name: '手牌管理模式',
    description: '玩家通过打出手牌来行动，手牌管理是核心策略',
    phases: ['draw', 'action', 'discard', 'scoring'],
    typicalActions: ['play_card', 'draw_card', 'discard_card'],
    implementTemplate: 'HandManagementGame'
  },
  
  // 区域控制模式（典型：卡坦岛通行费、Small World）
  area_control: {
    name: '区域控制模式',
    description: '玩家通过单位控制区域，获得区域奖励',
    phases: ['move', 'resolve_control', 'score'],
    trackControl: true,
    implementTemplate: 'AreaControlGame'
  }
};

// 资源系统模式库
const RESOURCE_PATTERNS = {
  // 固定资源池（典型：卡坦岛）
  fixed_pool: {
    name: '固定资源池',
    description: '所有资源在一个公共池中，获取时从池中扣除',
    trackTotal: true
  },
  
  // 产资模式（典型：文明系列）
  income: {
    name: '产资模式',
    description: '资源定期自动产出，玩家可积累和消耗',
    incomeInterval: 'turn' | 'phase' | 'custom'
  },
  
  // 变产资源（典型：阿尔罕布拉记分牌）
  vanity: {
    name: '变产资源',
    description: '资源本身即分数，分数即资源'
  }
};
```

### 8.2 模式匹配引擎

```typescript
class PatternMatcher {
  // 根据游戏描述匹配最佳模式
  matchPatterns(gameDescription: string): PatternMatch[] {
    const embeddings = this.getEmbeddings(gameDescription);
    const scores: PatternMatch[] = [];
    
    for (const [patternId, pattern] of Object.entries(PATTERNS)) {
      const similarity = cosineSimilarity(
        embeddings.game,
        embeddings.pattern
      );
      
      scores.push({
        patternId,
        confidence: similarity,
        reasoning: this.explainMatch(gameDescription, pattern)
      });
    }
    
    return scores.sort((a, b) => b.confidence - a.confidence);
  }
  
  // 基于模式生成游戏框架
  generateFromPattern(pattern: string, overrides?: Partial<GameConfig>): GameConfig {
    const template = PATTERN_TEMPLATES[pattern];
    return {
      ...template,
      ...overrides,
      customizations: this.generateCustomizations(template, overrides)
    };
  }
}
```

---

## 九、验证与检查

### 9.1 完整性检查

```typescript
class CompletenessChecker {
  check(game: BoardGame): ValidationResult {
    const issues: ValidationIssue[] = [];
    
    // 1. 所有动作的前置条件都有定义
    for (const phase of game.phases) {
      for (const action of phase.actions) {
        if (action.preconditions.length === 0) {
          issues.push({
            severity: 'warning',
            message: `动作 ${action.name} 没有前置条件检查`
          });
        }
      }
    }
    
    // 2. 所有效果的目标都有定义
    for (const phase of game.phases) {
      for (const action of phase.actions) {
        for (const effect of action.effects) {
          if (!effect.target) {
            issues.push({
              severity: 'error',
              message: `效果 ${effect.id} 缺少目标定义`
            });
          }
        }
      }
    }
    
    // 3. 胜负条件可以达成
    if (game.winConditions.length === 0) {
      issues.push({
        severity: 'error',
        message: '游戏没有定义胜负条件'
      });
    }
    
    // 4. 组件数量配置完整
    for (const component of game.components) {
      if (component.quantity === undefined) {
        issues.push({
          severity: 'warning',
          message: `组件 ${component.name} 缺少数量配置`
        });
      }
    }
    
    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues
    };
  }
}
```

---

## 十、导出格式

```yaml
# 导出为 YAML 格式，便于阅读和修改
game:
  name: "卡坦岛基础版"
  version: "1.0"
  complexity: moderate
  
  players:
    min: 3
    max: 4
    optimal: [4]
  
  components:
    - type: hex_tile
      name: 地形板块
      quantity: 19
    - type: number_token
      name: 数字token
      quantity: 18
    - type: resource_card
      name: 资源卡
      quantity: 19
    - type: dev_card
      name: 发展卡
      quantity: 25
  
  phases:
    - name: setup
      order: 1
      type: setup
    - name: resource_generation
      order: 2
      type: resource_gen
    - name: player_turn
      order: 3
      type: action
    - name: turn_end
      order: 4
      type: turn_end
  
  rules:
    longest_road: 5
    largest_army: 3
```

---

*Meta-Model v1.0 — 桌游规则元模型*

---

## 十一、运行时架构（Runtime Architecture）

> 定义游戏状态在运行时的结构、转移机制和同步策略

### 11.1 游戏状态运行时模型

```typescript
interface GameState {
  // 游戏标识
  id: GameId;
  name: string;
  version: string;  // 状态版本，用于乐观锁
  
  // 时间维度
  turn: number;
  phase: PhaseEnum;
  subPhase?: SubPhaseEnum;
  activePlayer: PlayerId | null;  // null 表示系统自动阶段
  
  // 玩家维度
  players: Map<PlayerId, PlayerState>;
  playerOrder: PlayerId[];  // 玩家行动顺序
  
  // 组件实例（运行时）
  components: Map<ComponentInstanceId, ComponentInstance>;
  
  // 资源池
  resourceBank: ResourceBank;
  
  // 历史记录（用于回放）
  history: GameEvent[];
  
  // 决策点
  pendingDecisions: PendingDecision[];
  
  // 信息隐藏（每个玩家的可见状态）
  visibility: Map<PlayerId, VisibleState>;
  
  // 游戏结束标记
  endedAt?: timestamp;
  winner?: PlayerId;
}

interface PlayerState {
  playerId: PlayerId;
  
  // 资源/手牌
  resources: Resources;
  hand: CardInstance[];  // 手牌（对其他玩家隐藏）
  hiddenInfo: HiddenInfo[];  // 隐藏信息（如未展示的发展卡）
  
  // 建筑/单位
  buildings: BuildingInstance[];
  units: UnitInstance[];
  
  // 状态标记
  flags: Map<FlagId, FlagValue>;
  
  // 计分
  score: ScoreBreakdown;
  
  // 元数据
  metadata: {
    connected: boolean;
    lastActionAt: timestamp;
    aiControlled: boolean;
  };
}

interface ComponentInstance {
  instanceId: ComponentInstanceId;
  componentType: ComponentType;  // deck/card/tile/road...
  
  // 位置（对于棋盘类游戏）
  position?: Position;
  
  // 归属
  owner?: PlayerId;  // null 表示公共
  
  // 状态
  state: 'active' | 'discarded' | 'destroyed' | 'hidden';
  
  // 附加数据
  data: Record<string, any>;  // 卡牌类型、数字token等
}
```

### 11.2 状态转移模型

```typescript
interface StateTransition {
  // 转移标识
  id: TransitionId;
  name: string;
  
  // 触发条件
  trigger: TransitionTrigger;
  
  // 前置条件（守卫）
  guard: Precondition[];
  
  // 效果（状态变更）
  effects: StateEffect[];
  
  // 同步策略
  sync: SyncStrategy;
  
  // 动画配置
  animation?: AnimationConfig;
}

type TransitionTrigger = 
  | { type: 'action'; actionType: string }
  | { type: 'system'; event: SystemEvent }
  | { type: 'time'; timeout: number }
  | { type: 'condition'; condition: Condition };

// 效果类型
interface StateEffect {
  type: 'modify' | 'move' | 'create' | 'destroy' | 'reveal' | 'hide' | 'score' | 'trigger';
  
  target: EffectTarget;
  
  operation: {
    // 对于 modify
    field?: string;
    operator?: '+' | '-' | '=' | 'push' | 'pop' | 'toggle';
    value?: any;
    
    // 对于 move
    from?: Position | Zone;
    to?: Position | Zone;
    
    // 对于 create/destroy
    component?: ComponentInstance;
    
    // 对于 trigger
    triggerName?: string;
  };
  
  // 条件（可选）
  condition?: Condition;
}

// 示例：骰子产出效果
const diceRollEffect: StateEffect = {
  type: 'modify',
  target: { type: 'player'; selector: 'all_with_building_adjacent_to'; tile: 'dice_result' },
  operation: {
    field: 'resources',
    operator: '+',
    value: { resource: 'tile_terrain', amount: 1 }
  }
};

// 示例：打出卡牌效果
const playCardEffect: StateEffect = {
  type: 'move',
  target: { type: 'card'; from: 'hand', to: 'play' },
  operation: {
    card: 'selected_card'
  }
};
```

### 11.3 信息隐藏模型

```typescript
interface VisibilityModel {
  // 默认可见性规则
  defaultRule: 'public' | 'private' | 'partial';
  
  // 按组件类型的可见性
  componentVisibility: Map<ComponentType, ComponentVisibility>;
  
  // 按阶段的可见性
  phaseVisibility: Map<PhaseEnum, PhaseVisibility>;
}

interface ComponentVisibility {
  owner: 'visible' | 'hidden' | 'owner_only' | 'selective';
  
  // 其他玩家的可见度
  others: 'visible' | 'count_only' | 'nothing';
  
  // 可见时的信息
  visibleFields?: string[];  // 如果是选择性可见
}

interface SelectiveVisibility extends ComponentVisibility {
  owner: 'selective';
  
  // 基于条件的可见性
  rules: VisibilityRule[];
}

interface VisibilityRule {
  condition: Condition;
  fields: string[];
  visibleTo: 'owner' | 'all' | 'specific_players';
  playerFilter?: PlayerId[];
}

// 示例：手牌对其他玩家完全隐藏
const handVisibility: ComponentVisibility = {
  owner: 'hidden',  // 即使自己也要等打出才可见
  others: 'nothing'
};

// 示例：发展卡在购买回合不可见（未激活状态）
const devCardVisibility: SelectiveVisibility = {
  owner: 'selective',
  rules: [
    { condition: { phase: 'buy_development' }, fields: ['type'], visibleTo: 'owner' },
    { condition: { phase: 'played' }, fields: ['type', 'used'], visibleTo: 'all' }
  ]
};
```

### 11.4 多人同步策略

```typescript
type SyncStrategy = 
  | 'authoritative_server'   // 服务端权威
  | 'lockstep'              // 回合制锁步
  | 'optimistic'            // 乐观本地预测
  | 'snapshot_interpolation' // 快照插值
  | 'frame_lockstep';       // 帧锁定

interface SyncProtocol {
  strategy: SyncStrategy;
  
  // 策略特定配置
  config: SyncConfig;
  
  // 延迟容忍度
  maxLatency: number;  // ms
  latencyCompensation: 'none' | 'input_delay' | 'state_delay';
}

interface AuthoritativeServerConfig extends SyncConfig {
  // 服务端权威：所有逻辑在服务端执行
  tickRate: number;  // 服务器tick频率 (ms)
  clientUpdateRate: number;  // 客户端更新频率
  interpolationDelay: number;  // 插值延迟
  
  // 断线容忍
  inputTimeout: number;
  stateTimeout: number;
}

interface LockstepConfig extends SyncConfig {
  // 回合制锁步：等待所有玩家输入后执行
  turnTimeout: number;  // 单回合超时
  turnPreload: number;  // 提前准备下回合
  
  // 断线处理
  onTimeout: 'ai_takeover' | 'skip_player' | 'end_game';
  
  // 同步确认协议
  confirmPhase: 'each_action' | 'end_of_turn' | 'manual';
}

interface OptimisticConfig extends SyncConfig {
  // 乐观本地预测：先执行，回滚冲突
  predictionWindow: number;  // 预测窗口大小
  rewindOnConflict: boolean;
  conflictResolution: 'server_wins' | 'client_wins' | 'negotiate';
  
  // 预测置信度
  confidenceThreshold: number;  // 低于此值切换到保守模式
}

// 策略选择指南
const SYNC_STRATEGY_GUIDE: Record<GameType, SyncStrategy> = {
  'realtime_action': 'authoritative_server',
  'turnbased_strategy': 'lockstep',
  'card_game': 'optimistic',
  'party_game': 'lockstep',  // 简单规则，lockstep足够
  'social_deduction': 'authoritative_server'  // 防作弊重要
};

// 骡子骰子应该用 authoritative_server
const CATAN_SYNC_PROTOCOL: SyncProtocol = {
  strategy: 'lockstep',
  config: {
    turnTimeout: 60000,
    onTimeout: 'ai_takeover',
    confirmPhase: 'end_of_turn'
  } as LockstepConfig,
  maxLatency: 500,
  latencyCompensation: 'input_delay'
};
```

### 11.5 状态验证与回滚

```typescript
class StateValidator {
  // 状态完整性验证
  validate(state: GameState): ValidationResult {
    const errors: ValidationError[] = [];
    
    // 1. 资源守恒（如果定义了守恒规则）
    const resourceConservation = this.checkResourceConservation(state);
    if (!resourceConservation.valid) {
      errors.push(resourceConservation.error);
    }
    
    // 2. 合法性检查
    const legality = this.checkLegality(state);
    errors.push(...legality.errors);
    
    // 3. 组件所有权验证
    const ownership = this.checkOwnership(state);
    if (!ownership.valid) {
      errors.push(ownership.error);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  // 状态差异检测（用于断线重连）
  diff(stateA: GameState, stateB: GameState): StateDiff {
    const changes: DiffEntry[] = [];
    
    // 比较玩家资源
    for (const [pid, resA] of Object.entries(stateA.players)) {
      const resB = stateB.players[pid]?.resources;
      if (!equals(resA, resB)) {
        changes.push({
          path: `players.${pid}.resources`,
          oldValue: resA,
          newValue: resB
        });
      }
    }
    
    // 比较组件状态
    for (const [cid, compA] of stateA.components) {
      const compB = stateB.components.get(cid);
      if (!compB || !equals(compA.state, compB.state)) {
        changes.push({
          path: `components.${cid}`,
          oldValue: compA,
          newValue: compB
        });
      }
    }
    
    return { changes };
  }
  
  // 状态回滚
  rollback(state: GameState, targetEvent: GameEventId): GameState {
    // 找到目标事件
    const eventIndex = state.history.findIndex(e => e.id === targetEvent);
    if (eventIndex === -1) {
      throw new Error('Target event not found');
    }
    
    // 截断历史，重建状态
    const relevantHistory = state.history.slice(0, eventIndex);
    return this.rebuildState(state.id, relevantHistory);
  }
}

interface ReconnectSpec {
  // 断线重连规格
  reconnectWindow: number;  // 可重连的时间窗口 (ms)
  stateSyncMode: 'full' | 'delta' | 'incremental';
  
  // 错过操作的处理
  missedActions: {
    recoverable: boolean;
    resolution: 'replay' | 'ai_takeover' | 'skip';
  };
  
  // 客户端状态校正
  reconciliation: {
    enabled: boolean;
    mode: 'force_server' | 'negotiate';
    threshold: number;  // 差异超过此值强制同步
  };
}
```

---

## 十二、复杂度分级详解

### 12.1 Tier 定义

```typescript
interface ComplexityTierDefinition {
  tier: 1 | 2 | 3 | 4;
  name: string;
  
  // 规模指标
  metrics: {
    maxComponents: number;
    maxUniqueMechanics: number;
    maxPhases: number;
    maxPlayers: number;
    estimatedStateSize: number;  // KB
  };
  
  // 复杂度指标
  complexity: {
    strategicDepth: [number, number];  // 范围
    ruleComplexity: [number, number];
    interactionComplexity: [number, number];
    randomness: [number, number];
  };
  
  // 推荐Agent配置
  agentConfig: AgentConfig;
  
  // 预计工时
  estimatedHours: [number, number];
}

const TIER_DEFINITIONS: ComplexityTierDefinition[] = [
  {
    tier: 1,
    name: 'Simple',
    metrics: {
      maxComponents: 100,
      maxUniqueMechanics: 5,
      maxPhases: 3,
      maxPlayers: 6,
      estimatedStateSize: 10
    },
    complexity: {
      strategicDepth: [1, 3],
      ruleComplexity: [1, 3],
      interactionComplexity: [1, 3],
      randomness: [3, 6]
    },
    agentConfig: {
      // Tier 1 可简化：规则分析和后端可合并
      useExpandedTeam: false,
      aiTuningRequired: false
    },
    estimatedHours: [20, 40]
  },
  {
    tier: 2,
    name: 'Moderate',
    metrics: {
      maxComponents: 500,
      maxUniqueMechanics: 15,
      maxPhases: 6,
      maxPlayers: 6,
      estimatedStateSize: 50
    },
    complexity: {
      strategicDepth: [4, 6],
      ruleComplexity: [4, 6],
      interactionComplexity: [3, 5],
      randomness: [2, 5]
    },
    agentConfig: {
      useExpandedTeam: true,
      aiTuningRequired: true
    },
    estimatedHours: [80, 120]
  },
  {
    tier: 3,
    name: 'Complex',
    metrics: {
      maxComponents: 2000,
      maxUniqueMechanics: 40,
      maxPhases: 12,
      maxPlayers: 8,
      estimatedStateSize: 200
    },
    complexity: {
      strategicDepth: [6, 8],
      ruleComplexity: [6, 8],
      interactionComplexity: [5, 7],
      randomness: [1, 4]
    },
    agentConfig: {
      useExpandedTeam: true,
      aiTuningRequired: true,
      additionalSpecialists: ['economy_specialist', 'asymmetry_specialist']
    },
    estimatedHours: [200, 400]
  },
  {
    tier: 4,
    name: 'Expert',
    metrics: {
      maxComponents: 10000,
      maxUniqueMechanics: 100,
      maxPhases: 20,
      maxPlayers: 8,
      estimatedStateSize: 500
    },
    complexity: {
      strategicDepth: [8, 10],
      ruleComplexity: [8, 10],
      interactionComplexity: [7, 9],
      randomness: [1, 3]
    },
    agentConfig: {
      useExpandedTeam: true,
      aiTuningRequired: true,
      additionalSpecialists: ['narrative_specialist', 'campaign_specialist', 'legacy_specialist'],
      parallelTracks: 3  // 多轨道并行开发
    },
    estimatedHours: [600, 1200]
  }
];
```

### 12.2 Tier 判定算法

```typescript
function assessTier(game: BoardGame): ComplexityTierDefinition {
  // 计算各维度得分
  const metrics = {
    componentCount: game.components.length,
    mechanicCount: game.mechanics.length,
    phaseCount: game.phases.length,
    maxPlayers: game.players.maxPlayers,
    hasHiddenInformation: game.visibility !== 'public',
    hasAsymmetricRules: checkAsymmetry(game),
    hasNarrativeElements: game.narrative !== undefined,
    hasCampaignMode: game.campaign !== undefined
  };
  
  // 计算复杂度得分
  let score = 0;
  
  if (metrics.componentCount > 5000) score += 3;
  else if (metrics.componentCount > 1000) score += 2;
  else if (metrics.componentCount > 200) score += 1;
  
  if (metrics.mechanicCount > 50) score += 3;
  else if (metrics.mechanicCount > 20) score += 2;
  else if (metrics.mechanicCount > 5) score += 1;
  
  if (metrics.hasHiddenInformation) score += 1;
  if (metrics.hasAsymmetricRules) score += 2;
  if (metrics.hasNarrativeElements) score += 2;
  if (metrics.hasCampaignMode) score += 3;
  
  // 映射到Tier
  if (score <= 4) return TIER_DEFINITIONS[0];  // Tier 1
  if (score <= 8) return TIER_DEFINITIONS[1];  // Tier 2
  if (score <= 12) return TIER_DEFINITIONS[2]; // Tier 3
  return TIER_DEFINITIONS[3];  // Tier 4
}
```

---

## 十一、运行时架构（Runtime Architecture）

> 定义游戏状态在运行时的结构、转移机制和同步策略

### 11.1 游戏状态运行时模型

```typescript
interface GameState {
  // 游戏标识
  id: GameId;
  name: string;
  version: string;  // 状态版本，用于乐观锁
  
  // 时间维度
  turn: number;
  phase: PhaseEnum;
  subPhase?: SubPhaseEnum;
  activePlayer: PlayerId | null;  // null 表示系统自动阶段
  
  // 玩家维度
  players: Map<PlayerId, PlayerState>;
  playerOrder: PlayerId[];  // 玩家行动顺序
  
  // 组件实例（运行时）
  components: Map<ComponentInstanceId, ComponentInstance>;
  
  // 资源池
  resourceBank: ResourceBank;
  
  // 历史记录（用于回放）
  history: GameEvent[];
  
  // 决策点
  pendingDecisions: PendingDecision[];
  
  // 信息隐藏（每个玩家的可见状态）
  visibility: Map<PlayerId, VisibleState>;
  
  // 游戏结束标记
  endedAt?: timestamp;
  winner?: PlayerId;
}

interface PlayerState {
  playerId: PlayerId;
  
  // 资源/手牌
  resources: Resources;
  hand: CardInstance[];  // 手牌（对其他玩家隐藏）
  hiddenInfo: HiddenInfo[];  // 隐藏信息
  
  // 建筑/单位
  buildings: BuildingInstance[];
  units: UnitInstance[];
  
  // 状态标记
  flags: Map<FlagId, FlagValue>;
  
  // 计分
  score: ScoreBreakdown;
  
  // 元数据
  metadata: {
    connected: boolean;
    lastActionAt: timestamp;
    aiControlled: boolean;
  };
}

interface ComponentInstance {
  instanceId: ComponentInstanceId;
  componentType: ComponentType;
  
  // 位置
  position?: Position;
  
  // 归属
  owner?: PlayerId;
  
  // 状态
  state: 'active' | 'discarded' | 'destroyed' | 'hidden';
  
  // 附加数据
  data: Record<string, any>;
}
```

### 11.2 状态转移模型

```typescript
interface StateTransition {
  id: TransitionId;
  name: string;
  
  // 触发条件
  trigger: TransitionTrigger;
  
  // 前置条件
  guard: Precondition[];
  
  // 效果
  effects: StateEffect[];
  
  // 同步策略
  sync: SyncStrategy;
  
  // 动画配置
  animation?: AnimationConfig;
}

type TransitionTrigger = 
  | { type: 'action'; actionType: string }
  | { type: 'system'; event: SystemEvent }
  | { type: 'time'; timeout: number }
  | { type: 'condition'; condition: Condition };

interface StateEffect {
  type: 'modify' | 'move' | 'create' | 'destroy' | 'reveal' | 'hide' | 'score' | 'trigger';
  target: EffectTarget;
  operation: {
    field?: string;
    operator?: '+' | '-' | '=' | 'push' | 'pop' | 'toggle';
    value?: any;
    from?: Position | Zone;
    to?: Position | Zone;
    card?: string;
    triggerName?: string;
  };
  condition?: Condition;
}
```

### 11.3 信息隐藏模型

```typescript
interface VisibilityModel {
  defaultRule: 'public' | 'private' | 'partial';
  componentVisibility: Map<ComponentType, ComponentVisibility>;
  phaseVisibility: Map<PhaseEnum, PhaseVisibility>;
}

interface ComponentVisibility {
  owner: 'visible' | 'hidden' | 'owner_only' | 'selective';
  others: 'visible' | 'count_only' | 'nothing';
  visibleFields?: string[];
}

// 示例：手牌完全隐藏
const handVisibility: ComponentVisibility = {
  owner: 'hidden',
  others: 'nothing'
};
```

### 11.4 多人同步策略

```typescript
type SyncStrategy = 
  | 'authoritative_server'
  | 'lockstep'
  | 'optimistic'
  | 'snapshot_interpolation'
  | 'frame_lockstep';

interface SyncProtocol {
  strategy: SyncStrategy;
  config: SyncConfig;
  maxLatency: number;
  latencyCompensation: 'none' | 'input_delay' | 'state_delay';
}

// 策略选择指南
const SYNC_STRATEGY_GUIDE: Record<GameType, SyncStrategy> = {
  'realtime_action': 'authoritative_server',
  'turnbased_strategy': 'lockstep',
  'card_game': 'optimistic',
  'party_game': 'lockstep',
  'social_deduction': 'authoritative_server'
};

// 卡坦岛用 Lockstep
const CATAN_SYNC_PROTOCOL: SyncProtocol = {
  strategy: 'lockstep',
  config: { turnTimeout: 60000, onTimeout: 'ai_takeover' },
  maxLatency: 500,
  latencyCompensation: 'input_delay'
};
```

### 11.5 状态验证与回滚

```typescript
class StateValidator {
  validate(state: GameState): ValidationResult {
    const errors: ValidationError[] = [];
    
    // 1. 资源守恒检查
    const resourceConservation = this.checkResourceConservation(state);
    if (!resourceConservation.valid) {
      errors.push(resourceConservation.error);
    }
    
    // 2. 合法性检查
    const legality = this.checkLegality(state);
    errors.push(...legality.errors);
    
    return { valid: errors.length === 0, errors };
  }
  
  diff(stateA: GameState, stateB: GameState): StateDiff {
    // 比较两个状态的差异
    const changes: DiffEntry[] = [];
    // ...
    return { changes };
  }
}

interface ReconnectSpec {
  reconnectWindow: number;
  stateSyncMode: 'full' | 'delta' | 'incremental';
  missedActions: { recoverable: boolean; resolution: 'replay' | 'ai_takeover' | 'skip' };
  reconciliation: { enabled: boolean; mode: 'force_server' | 'negotiate'; threshold: number };
}
```

---

## 十三、随机性与确定性模型（Randomness & Determinism）

> Opus 4.6 指出：几乎每个桌游都有随机性，但缺乏第一-class的模型支持

### 13.1 随机性来源枚举

```typescript
type RandomSourceType = 
  | 'dice'              // 骰子（d4/d6/d8/d10/d12/d20）
  | 'deck_draw'         // 卡牌抽牌
  | 'shuffle'           // 洗牌
  | 'coin_flip'         // 掷硬币
  | 'spinner'           // 转盘
  | 'bag_draw'          // 袋子里摸token
  | 'tile_placement'    // 随机板块放置
  | 'card_hand'         // 发手牌（随机分配）
  | 'event_deck'        // 事件牌堆
  | 'custom';           // 自定义随机源

// 每个随机源必须标记
interface RandomSourceSpec {
  id: string;
  type: RandomSourceType;
  
  // 名称（用于日志和UI）
  name: string;  // "战斗骰", "资源产出骰", "卡牌堆"
  
  // 分发配置
  distribution: DistributionConfig;
  
  // 确定性需求
  determinism: DeterminismRequirement;
  
  // 多人游戏同步模式
  multiplayerSync: MultiplayerRandomSync;
  
  // 记录历史
  recordHistory: boolean;
  
  // AI可见性（AI是否知道随机结果）
  aiVisibility: 'revealed' | 'hidden' | 'probabilistic';
}
```

### 13.2 确定性需求

```typescript
type DeterminismRequirement = 
  | 'strong'     // 必须完全确定：相同输入 → 相同输出
  | 'probabilistic'  // 概率确定：相同分布，但具体结果不确定
  | 'seeded'     // 种子确定：相同种子 → 相同结果（用于重放）
  | 'irreversible';  // 不可逆：结果不能回滚（如战斗骰）

interface DeterminismConfig {
  requirement: DeterminismRequirement;
  
  // 如果是 seeded，需要指定种子管理
  seedManagement?: SeedManagement;
  
  // 重放支持
  replaySupport: {
    enabled: boolean;
    maxReplayLength: number;  // 最大重放步数
    snapshotInterval: number;  // 快照间隔
  };
}

interface SeedManagement {
  // 种子来源
  seedSource: 'server' | 'client' | 'shared_secret' | 'commit_reveal';
  
  // 种子生成算法
  algorithm: 'mersenne_twister' | 'xorshift' | 'chacha20' | 'hardware';
  
  // 种子存储
  storage: {
    recordInHistory: boolean;
    encryptBeforeHistory: boolean;  // 防止玩家查看未来随机数
  };
  
  // 种子轮换
  seedReseeding: {
    frequency: 'never' | 'per_game' | 'per_round' | 'per_action';
    method: 'deterministic_hash' | 'fresh_random';
  };
}
```

### 13.3 多人游戏随机同步

```typescript
type MultiplayerRandomSync = 
  | 'server_authoritative'   // 所有随机在服务端生成
  | 'client_shared_seed'     // 客户端和服务端共享种子
  | 'commit_reveal'          // 承诺-揭示协议（防作弊）
  | 'turn_based'             // 回合制不需要同步
  | 'simultaneous';          // 同时行动，需要特殊处理

interface ServerAuthoritativeConfig {
  sync: 'server_authoritative';
  
  // 服务端tick
  tickRate: number;  // ms
  
  // 客户端预测
  optimisticRoll: {
    enabled: boolean;
    window: number;  // 预测窗口 ms
    conflictResolution: 'server_wins' | 'reroll' | 'revert';
  };
}

interface CommitRevealConfig {
  sync: 'commit_reveal';
  
  // 承诺阶段
  commitPhase: {
    timeout: number;
    hashAlgorithm: 'sha256' | 'blake3';
  };
  
  // 揭示阶段
  revealPhase: {
    timeout: number;
    orderReveal: boolean;  // 是否按顺序揭示
  };
  
  // 冲突处理
  disputes: {
    resolution: 'server_log' | 'majority_vote' | 'forfeit';
  };
}

// 示例：卡坦岛骰子用服务端权威
const CATAN_DICE_SYNC: MultiplayerRandomSync = {
  sync: 'server_authoritative',
  optimisticRoll: {
    enabled: true,
    window: 100,  // 100ms窗口
    conflictResolution: 'server_wins'
  }
};

// 示例：德州扑克用承诺-揭示
const POKER_DICE_SYNC: MultiplayerRandomSync = {
  sync: 'commit_reveal',
  commitPhase: {
    timeout: 5000,
    hashAlgorithm: 'sha256'
  },
  revealPhase: {
    timeout: 5000,
    orderReveal: false
  }
};
```

### 13.4 随机结果验证

```typescript
interface RandomValidator {
  // 验证随机结果是否符合分布
  validateDistribution(
    results: RandomResult[],
    expected: DistributionConfig
  ): ValidationResult;
  
  // 验证重放确定性
  validateDeterminism(
    seed: string,
    sequence: RandomResult[]
  ): boolean;
  
  // 检测异常
  detectAnomaly(
    recentResults: RandomResult[],
    expectedProb: number,
    threshold: number  // e.g., 3个标准差
  ): AnomalyAlert | null;
}

interface RandomResult {
  timestamp: timestamp;
  source: string;  // RandomSourceSpec.id
  value: any;     // 实际结果
  seed?: string;  // 如果是 seeded
  
  // 用于验证的元数据
  metadata: {
    playerId?: PlayerId;  // 触发者
    phase: string;
    context: string;  // "resource_generation", "combat", etc.
  };
}
```

### 13.5 AI 随机性处理

```typescript
interface AIRandomnessHandling {
  // AI 如何处理随机性
  approach: 'perfect_information' | 'probabilistic' | 'sampling';
  
  // 如果是 probabilistic
  probabilistic?: {
    // AI 考虑的样本数
    sampleCount: number;  // e.g., 1000
    
    // 置信区间
    confidenceInterval: number;  // e.g., 0.95
    
    // 决策阈值
    decisionThreshold: number;  // e.g., 0.7 (70%胜率才行动)
  };
  
  // 如果是 sampling
  sampling?: {
    method: 'monte_carlo' | 'stratified' | 'latin_hypercube';
    iterations: number;
    cutoffThreshold: number;  // 超过多少样本后停止
  };
}

// 示例：简单游戏的AI用概率模型
const SIMPLE_AI_RANDOM: AIRandomnessHandling = {
  approach: 'probabilistic',
  probabilistic: {
    sampleCount: 100,
    confidenceInterval: 0.9,
    decisionThreshold: 0.65
  }
};

// 示例：复杂游戏用蒙特卡洛
const COMPLEX_AI_RANDOM: AIRandomnessHandling = {
  approach: 'sampling',
  sampling: {
    method: 'monte_carlo',
    iterations: 10000,
    cutoffThreshold: 0.01  // 1%精度
  }
};
```

### 13.6 随机性测试套件

```typescript
// test-generator 必须生成的随机性测试

const RANDOMNESS_TESTS = {
  // 1. 分布验证测试
  distributionValidation: {
    description: '验证随机结果是否符合预期分布',
    method: 'chi_square_test',
    sampleSize: 1000,
    passThreshold: 0.05  // p > 0.05 认为符合分布
  },
  
  // 2. 确定性测试
  determinismTest: {
    description: '验证相同种子产生相同结果',
    method: 'seeded_replay',
    iterations: 100,
    passThreshold: 1.0  // 必须100%一致
  },
  
  // 3. 公平性测试
  fairnessTest: {
    description: '验证没有系统性偏差',
    method: ' kolmogorov_smirnov_test',
    passThreshold: 0.05
  },
  
  // 4. 并发安全测试
  concurrencyTest: {
    description: '验证多人同时随机不会冲突',
    method: 'stress_test',
    concurrentPlayers: 8,
    actionsPerPlayer: 100
  },
  
  // 5. 重放完整性测试
  replayIntegrityTest: {
    description: '验证完整游戏可以精确重放',
    method: 'full_game_replay',
    iterations: 10,
    passThreshold: 1.0
  }
};
```

### 13.7 随机性与规则歧义

```typescript
// 随机性常常与规则歧义相关

interface RandomRuleAmbiguity {
  // 常见的歧义类型
  type: 'timing' | 'resolution_order' | 'reroll_policy' | 'hidden_information';
  
  description: string;
  
  // 示例
  examples: string[];
  
  // 建议的处理方式
  recommendedHandling: {
    defaultInterpretation: string;
    alternativeInterpretations: string[];
    communityConsensus?: string;
    officialRuling?: string;
  };
  
  // 置信度
  confidence: number;  // 我们对推荐处理方式的信心
}

// 示例：卡坦岛强盗重掷规则
const ROBBER_REROLL_AMBIGUITY: RandomRuleAmbiguity = {
  type: 'reroll_policy',
  description: '7点时如果无人超过7张牌，是否仍然移动强盗',
  examples: [
    '玩家A有3张牌，玩家B有8张牌，7点出现',
    '是否移动强盗？'
  ],
  recommendedHandling: {
    defaultInterpretation: '仍然移动强盗（移动是独立事件）',
    alternativeInterpretations: [
      '不移动强盗（没有弃牌就不移动）',
      '只有超过7张的玩家需要弃牌，强盗总是移动'
    ]
  },
  confidence: 0.8
};
```

---

*Meta-Model v1.2 — 包含随机性与确定性模型*


