# Resilience Framework — Agent Ensemble 降级与故障处理

> 16个Agent中任何一个故障都不应导致整个系统崩溃

---

## 一、为什么需要降级模型

```
问题：16个Agent构成大片故障区域

Agent1 ──┬──> Agent3 ──┬──> Agent5 ──> 下游
          │            │
Agent2 ───┘            │
                        │
          Agent4 ───────┘

如果 Agent3 故障：
- Agent1, Agent2 继续工作
- Agent3 的下游（Agent5）收不到输入
- Agent5 可能hang或产生垃圾
- 级联失败开始
```

---

## 二、Agent 分类与关键路径

### 2.1 Agent 关键性分级

```typescript
type AgentCriticality = 
  | 'critical'    // 系统核心，无则无法运行
  | 'important'  // 重要功能，降级可接受
  | 'optional'   // 增强功能，可完全跳过
  | 'advisory';  // 建议功能，仅锦上添花

interface AgentClassification {
  agentId: string;
  criticality: AgentCriticality;
  
  // 如果此Agent故障，系统能降级到什么程度
  degradedMode: DegradedMode;
  
  // 降级后的替代方案
  fallback?: FallbackStrategy;
}

type DegradedMode =
  | 'full'           // 100% 功能（正常）
  | 'reduced'        // 降级运行（部分功能）
  | 'minimal'        // 最小功能（核心功能）
  | 'emergency';     // 只读/只写紧急模式
```

### 2.2 Board Game Studio Agent 分类

```typescript
const AGENT_CRITICALITY: Record<string, AgentClassification> = {
  // Critical: 无则系统无法运行
  'project-director': {
    criticality: 'critical',
    degradedMode: 'emergency',  // 只能终止项目
    fallback: null  // 无法替代
  },
  
  'game-engine-dev': {
    criticality: 'critical',
    degradedMode: 'minimal',
    fallback: {
      // 使用预构建的通用游戏引擎模板
      template: 'generic-board-game-engine',
      supportedMechanics: ['dice', 'cards', 'turn-based', 'simple-strategy']
    }
  },
  
  'multiplayer-architect': {
    criticality: 'critical',
    degradedMode: 'minimal',
    fallback: {
      // 使用保守的轮询同步模式
      mode: 'turn-based-polling',
      maxPlayers: 4
    }
  },
  
  // Important: 重要但可降级
  'rule-analyst': {
    criticality: 'important',
    degradedMode: 'reduced',
    fallback: {
      // 使用预定义的规则模板
      template: 'standard-rules-template',
      coverage: ['basic-moves', 'scoring', 'turn-structure']
    }
  },
  
  'balance-evaluator': {
    criticality: 'important',
    degradedMode: 'reduced',
    fallback: {
      // 使用基础胜率计算
      mode: 'basic-winrate',
      checks: ['obvious-imbalance']
    }
  },
  
  'ai-opponent-dev': {
    criticality: 'important',
    degradedMode: 'reduced',
    fallback: {
      // 使用随机AI
      mode: 'random-ai',
      difficulty: 'easy'
    }
  },
  
  // Optional: 可完全跳过
  'visual-designer': {
    criticality: 'optional',
    degradedMode: 'emergency',
    fallback: {
      // 使用纯文本UI
      mode: 'text-only-ui'
    }
  },
  
  'animation-effects': {
    criticality: 'optional',
    degradedMode: 'emergency',
    fallback: null  // 直接跳过动画
  },
  
  // Advisory: 仅锦上添花
  'social-features-dev': {
    criticality: 'advisory',
    degradedMode: 'emergency',
    fallback: null
  }
};
```

### 2.3 关键路径图

```
┌─────────────────────────────────────────────────────────────────┐
│                    CRITICAL PATH (关键路径)                       │
│                                                                 │
│  rule-analyst ──> mechanic-extractor ──> game-engine-dev        │
│        │                  │                    │                   │
│        │                  │                    ▼                   │
│        │                  │            multiplayer-architect      │
│        │                  │                    │                   │
│        │                  ▼                    ▼                   │
│        │            balance-evaluator     test-generator          │
│        │                  │                    │                   │
│        └──────────────────┴────────────────────┘                   │
│                           │                                       │
│                           ▼                                       │
│                    project-director (协调)                        │
│                           │                                       │
│                           ▼                                       │
│                      游戏上线                                     │
└─────────────────────────────────────────────────────────────────┘

降级规则：
- 任意 Critical Agent 故障 → 系统停止
- 任意 Important Agent 故障 → 降级模式运行
- 任意 Optional Agent 故障 → 跳过该功能
- Advisory Agent 可随时关闭
```

---

## 三、熔断器模式 (Circuit Breaker)

### 3.1 熔断器状态机

```typescript
type CircuitState = 
  | 'closed'    // 正常：所有请求通过
  | 'open'      // 断开：请求被拒绝，使用fallback
  | 'half-open'; // 半开：允许有限请求，测试恢复

interface CircuitBreaker {
  // 配置
  config: {
    failureThreshold: number;      // 失败多少次后断开
    successThreshold: number;     // 成功多少次后闭合
    timeout: number;              // 断开后多久尝试半开(ms)
    requestVolume: number;        // 最小请求量才触发熔断
  };
  
  // 状态
  state: CircuitState;
  
  // 统计
  stats: {
    failures: number;
    successes: number;
    lastFailureTime?: timestamp;
    lastStateChange: timestamp;
  };
  
  // 事件
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

// 熔断器工作流程
function handleRequest(cb: CircuitBreaker, request: () => Promise<Result>): Result {
  switch (cb.state) {
    case 'closed':
      try {
        const result = request();
        recordSuccess(cb);
        return result;
      } catch (e) {
        recordFailure(cb);
        if (shouldTrip(cb)) {
          tripCircuit(cb);
        }
        throw e;
      }
      
    case 'open':
      // 检查是否应该进入半开状态
      if (isTimeoutExpired(cb)) {
        cb.state = 'half-open';
        return handleRequest(cb, request);  // 递归
      }
      // 返回fallback
      return cb.fallback!();
      
    case 'half-open':
      // 允许有限请求
      const result = request();
      recordSuccess(cb);
      if (cb.stats.successes >= cb.config.successThreshold) {
        closeCircuit(cb);
      }
      return result;
  }
}
```

### 3.2 Agent 熔断器配置

```typescript
const AGENT_CIRCUIT_BREAKERS: Record<string, CircuitBreakerConfig> = {
  'rule-analyst': {
    failureThreshold: 3,      // 3次失败后断开
    successThreshold: 2,      // 2次成功后闭合
    timeout: 60000,          // 60秒后尝试恢复
    requestVolume: 5,         // 至少5个请求才触发
    fallback: 'use-standard-rule-template'
  },
  
  'balance-evaluator': {
    failureThreshold: 2,      // 2次失败后断开（更敏感）
    successThreshold: 3,
    timeout: 120000,
    requestVolume: 3,
    fallback: 'basic-winrate-analysis'
  },
  
  'game-engine-dev': {
    failureThreshold: 1,      // 立即断开（核心组件）
    successThreshold: 1,
    timeout: 300000,         // 5分钟后尝试
    requestVolume: 1,
    fallback: 'generic-engine-template'
  },
  
  'ai-opponent-dev': {
    failureThreshold: 2,
    successThreshold: 2,
    timeout: 180000,
    requestVolume: 2,
    fallback: 'random-ai'
  }
};
```

### 3.3 熔断器与流水线集成

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Agent 流水线 + 熔断器                             │
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐           │
│  │ rule-analyst │────▶│ mechanic-    │────▶│balance-      │           │
│  │              │     │ extractor    │     │evaluator     │           │
│  │ [CB: closed] │     │ [CB: closed] │     │ [CB: OPEN]   │           │
│  └──────────────┘     └──────────────┘     └──────┬───────┘           │
│                                                  │                    │
│                                                  │ Fallback           │
│                                                  ▼                    │
│                                           ┌──────────────┐           │
│                                           │ basic-       │           │
│                                           │ winrate-check│           │
│                                           └──────────────┘           │
│                                                                         │
│  🔴 balance-evaluator 熔断打开                                         │
│     → 使用基础胜率检查替代                                                │
│     → 通知 project-director                                             │
│     → 60秒后尝试半开恢复                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 四、优雅降级策略

### 4.1 降级决策矩阵

```typescript
// 根据故障Agent和游戏Tier决定降级策略

const DEGRADATION_MATRIX = {
  // Tier 1-2 游戏
  tier12: {
    'rule-analyst': {
      action: 'USE_TEMPLATE',
      template: 'standard-rules-template'
    },
    'balance-evaluator': {
      action: 'USE_SAMPLE',
      sampleSize: 100
    },
    'ai-opponent-dev': {
      action: 'RANDOM_AI',
      difficulty: 'medium'
    },
    'animation-effects': {
      action: 'SKIP'
    }
  },
  
  // Tier 3-4 游戏
  tier34: {
    'rule-analyst': {
      action: 'BLOCK',  // 规则分析失败则阻塞
      reason: 'complexity too high for templates'
    },
    'balance-evaluator': {
      action: 'REDUCED_SCOPE',
      checks: ['basic-winrate', 'obvious-imbalance']
    },
    'ai-opponent-dev': {
      action: 'MONTE_CARLO_AI',
      iterations: 1000
    },
    'animation-effects': {
      action: 'BASIC_ANIMATION'
    }
  }
};
```

### 4.2 降级执行流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      降级执行流程                                       │
│                                                                         │
│  检测到 Agent 故障                                                      │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────┐                                                   │
│  │ Agent 熔断器    │                                                   │
│  │ 打开?           │                                                   │
│  └────────┬────────┘                                                   │
│           │ YES                                                        │
│           ▼                                                            │
│  ┌─────────────────┐                                                   │
│  │ 查询降级矩阵    │                                                   │
│  │ (Agent + Tier) │                                                   │
│  └────────┬────────┘                                                   │
│           │                                                            │
│           ▼                                                            │
│  ┌─────────────────┐                                                   │
│  │ 执行降级策略    │                                                   │
│  │ - SKIP          │                                                   │
│  │ - USE_TEMPLATE  │                                                   │
│  │ - USE_SAMPLE    │                                                   │
│  │ - RANDOM_AI     │                                                   │
│  └────────┬────────┘                                                   │
│           │                                                            │
│           ▼                                                            │
│  ┌─────────────────┐                                                   │
│  │ 通知 Project     │                                                   │
│  │ Director         │                                                   │
│  └────────┬────────┘                                                   │
│           │                                                            │
│           ▼                                                            │
│  ┌─────────────────┐                                                   │
│  │ 记录降级日志    │                                                   │
│  │ 继续流水线      │                                                   │
│  └─────────────────┘                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 五、故障恢复

### 5.1 Agent 故障恢复协议

```typescript
// 当 Agent 从故障中恢复时

interface AgentRecoveryProtocol {
  // 1. 检查点保存
  checkpoints: {
    frequency: 'per-handoff' | 'per-task' | 'manual';
    storagePath: string;
    retention: number;  // 保留多少个检查点
  };
  
  // 2. 恢复流程
  recoverySteps: [
    {
      step: 1,
      action: 'RECONNECT',
      verify: 'agent-healthy'
    },
    {
      step: 2,
      action: 'LOAD_CHECKPOINT',
      verify: 'checkpoint-valid'
    },
    {
      step: 3,
      action: 'RESUME_FROM_CHECKPOINT',
      verify: 'state-consistent'
    },
    {
      step: 4,
      action: 'REPLAY_PENDING_HANDOVERS',
      verify: 'no-duplicate-processing'
    }
  ];
  
  // 3. 幂等性保证
  idempotency: {
    // 每个任务有唯一ID，重复执行会被忽略
    taskIdempotency: true;
    
    // Handoff有版本号，重复接收会被忽略
    handoffVersioning: true;
    
    // 状态变更有CAS（Compare-And-Swap）
    stateCAS: true;
  };
}
```

### 5.2 状态恢复示例

```typescript
// Agent 8 (game-engine-dev) 崩溃后的恢复

const RECOVERY_SCENARIO = `
1. Agent 8 崩溃
   - 熔断器打开
   - 下游 agent 收到错误

2. Project Director 收到通知
   - 检查点保存完好（每5分钟一次）
   - 最后检查点: handoff_id=HND-042, task_id=TASK-123

3. Agent 8 重启
   - 加载检查点
   - 验证状态一致性

4. 重放 pending handoffs
   - HND-042 → 重新验证
   - HND-043 → 重新验证
   
5. 继续流水线
   - 熔断器变为 half-open
   - 2个成功请求后闭合
`;
```

---

## 六、负荷管理

### 6.1 优先级队列

```typescript
// 不同类型的任务有不同的优先级

const TASK_PRIORITIES = {
  // P0: 系统关键任务
  critical: {
    level: 0,
    examples: ['game-state-update', 'rule-validation'],
    maxQueueTime: 1000,  // ms
    retryPolicy: 'immediate'
  },
  
  // P1: 核心功能任务
  core: {
    level: 1,
    examples: ['balance-analysis', 'ai-decision'],
    maxQueueTime: 10000,
    retryPolicy: 'exponential-backoff'
  },
  
  // P2: 增强功能任务
  enhancement: {
    level: 2,
    examples: ['animation-generation', 'social-feature'],
    maxQueueTime: 60000,
    retryPolicy: 'delayed'
  },
  
  // P3: 低优先级任务
  low: {
    level: 3,
    examples: ['analytics', 'logging'],
    maxQueueTime: 300000,
    retryPolicy: 'batch'
  }
};
```

### 6.2 负荷降级规则

```typescript
// 当系统负载过高时的降级策略

const LOAD_SHEDDING = {
  // CPU/内存过高时
  highLoad: {
    threshold: 0.8,  // 80%
    actions: [
      { type: 'QUEUE_P2', reason: 'defer enhancement tasks' },
      { type: 'INCREASE_BATCH_SIZE', target: 'analytics' },
      { type: 'DISABLE_NON_CRITICAL_LOGGING' }
    ]
  },
  
  // 队列积压时
  queueBacklog: {
    threshold: 100,  // 100个待处理任务
    actions: [
      { type: 'REJECT_P3', reason: 'lowest priority' },
      { type: 'DEGRADE_AI_QUALITY', target: 'ai-opponent-dev' },
      { type: 'SPREAD_LOAD', method: 'delayed-processing' }
    ]
  },
  
  // 超时率过高时
  highTimeoutRate: {
    threshold: 0.1,  // 10%
    actions: [
      { type: 'INCREASE_TIMEOUT', agents: ['balance-evaluator'] },
      { type: 'TRIP_CIRCUIT_BREAKER', agent: 'rule-analyst' },
      { type: 'ALERT_MONITORING' }
    ]
  }
};
```

---

## 七、与 OBSERVABILITY.md 的集成

```typescript
// Resilience events 必须记录到 Trace

interface ResilienceTrace {
  // 熔断器状态变更
  circuitBreakerEvents: {
    agentId: string;
    fromState: CircuitState;
    toState: CircuitState;
    reason: string;
    timestamp: timestamp;
  }[];
  
  // 降级事件
  degradationEvents: {
    agentId: string;
    originalMode: DegradedMode;
    degradedMode: DegradedMode;
    reason: string;
    timestamp: timestamp;
  }[];
  
  // 恢复事件
  recoveryEvents: {
    agentId: string;
    recoveryDuration: number;  // ms
    checkpointRestored: string;
    tasksResumed: number;
    timestamp: timestamp;
  }[];
  
  // 系统健康度
  systemHealth: {
    overallStatus: 'healthy' | 'degraded' | 'critical';
    criticalAgentsUp: number;
    totalAgents: number;
    activeCircuitBreakers: number;
  };
}

// Dashboard 显示
const RESILIENCE_DASHBOARD = `
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔧 Resilience Dashboard                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  System Health: 🟡 DEGRADED                                              │
│                                                                             │
│  Agent Status:                                                             │
│  ┌─────────────┬──────────┬────────┬─────────┐                          │
│  │ Agent       │ Status   │ CB     │ Mode    │                          │
│  ├─────────────┼──────────┼────────┼─────────┤                          │
│  │ rule-analyst│ ✅ UP     │ closed │ full    │                          │
│  │ balance-eval│ ⚠️ DEG   │ OPEN   │ reduced │ ← fallback active        │
│  │ game-engine │ ✅ UP     │ closed │ full    │                          │
│  │ animation   │ ⏭️ SKIPPED│ N/A    │ N/A     │                          │
│  └─────────────┴──────────┴────────┴─────────┘                          │
│                                                                             │
│  Active Circuit Breakers: 1                                               │
│  Degraded Modes: 1                                                         │
│                                                                             │
│  Recent Events:                                                            │
│  18:45:02 - balance-evaluator CB opened (2 failures)                     │
│  18:45:02 - fallback activated: basic-winrate-analysis                    │
│  18:45:03 - project-director notified                                     │
│  18:47:30 - auto-recovery scheduled                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
`;
```

---

## 八、与 PROTOCOLS.md 的集成

```typescript
// PROTOCOLS.md 中的 Handoff 协议增加降级感知

interface HandoffPackageV4<Output, Input> {
  // ... 现有字段 ...
  
  // 新增：降级信息
  degradation?: {
    sourceAgent: string;        // 哪个 agent 被降级
    degradedBy?: string;        // 谁在替代它
    fallbackStrategy: string;   // 使用的降级策略
    pipelineImpact: 'none' | 'reduced' | 'significant';
  };
  
  // 新增：熔断器状态
  circuitBreakerState?: {
    agentId: string;
    state: CircuitState;
    failureCount: number;
  };
}

// 交接时的降级检查
const HANDOVER_WITH_RESILIENCE = `
1. 上游 Agent 产出完成
2. 检查下游 Agent 的熔断器状态
   - 如果 OPEN → 使用 fallback
   - 如果 closed → 正常交接
3. 记录降级信息到 handoff
4. 通知 Project Director（如果是 Critical Agent）
`;
```

---

*Resilience Framework v1.0 — Agent Ensemble 降级与故障处理*
