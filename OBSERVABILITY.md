# Observability Framework — 流水线的眼睛

> 让 16 个 Agent 的协作变得透明、可调试、可追溯

---

## 一、为什么需要可观测性

| 场景 | 没有可观测性 | 有可观测性 |
|------|-------------|-----------|
| Agent 12 产出错误 | 无法定位哪个上游引入 | trace ID 精确定位 |
| 下游拒绝上游 | 不清楚拒绝原因链 | 完整 rejection trace |
| 流水线变慢 | 不知道瓶颈在哪 | dashboard 显示 Agent 耗时 |
| Agent 崩溃 | 不清楚从哪个状态恢复 | 决策日志支持精确重跑 |

---

## 二、Trace 架构

### 2.1 Pipeline Trace ID

```typescript
interface PipelineTrace {
  // 全局唯一 trace ID
  traceId: string;           // "TRACE-20260324-CATAN-001"
  
  // 流水线元数据
  metadata: {
    gameName: string;
    tier: ComplexityTier;
    pipelineVersion: string;
    startedAt: timestamp;
    triggeredBy: string;     // "human" | "automated"
  };
  
  // Agent 执行记录
  agentExecutions: AgentExecution[];
  
  // Handoff 记录
  handoffs: HandoffRecord[];
  
  // Rejection 记录
  rejections: RejectionRecord[];
  
  // 最终结果
  result: {
    status: 'success' | 'failed' | 'escalated';
    outputArtifact?: string;
    failedAt?: string;
  };
}

interface AgentExecution {
  agentId: string;
  startedAt: timestamp;
  completedAt?: timestamp;
  duration: number;          // ms
  
  // 输入
  inputs: {
    handoffId: string;       // 来自哪个 handoff
    modelVersions: Record<string, string>;  // 各 model 的版本
  };
  
  // 决策日志
  decisions: DecisionLog[];
  
  // 产出
  output: {
    artifactPath: string;
    version: string;
    confidence: number;       // 0-1
  };
  
  // 状态
  status: 'running' | 'completed' | 'failed' | 'rejected';
  error?: string;
}

interface DecisionLog {
  id: string;               // "DEC-001"
  timestamp: string;
  
  // 决策上下文
  context: {
    task: string;
    availableOptions: string[];
    relevantModels: string[];
  };
  
  // 决策结果
  decision: string;
  rationale: string;         // 为什么要这样选
  
  // 置信度
  confidence: number;         // 0-1
  uncertainAspects?: string[];  // 自己不确定的地方
  
  // 下游可见性
  downstreamAware: boolean;  // 这个决策是否影响下游
}
```

### 2.2 Handoff Record

```typescript
interface HandoffRecord {
  id: string;               // "HND-001"
  traceId: string;
  
  // 交接双方
  fromAgent: string;
  toAgent: string;
  
  // 交接内容
  artifactType: string;      // "ParsedGame" | "GameMechanics" | ...
  artifactPath: string;      // 持久化存储路径
  
  // 版本信息
  fromVersion: string;
  toVersion: string;
  
  // 完整性检查
  validation: {
    schemaValid: boolean;
    completenessScore: number;  // 0-1
    blockingIssues: string[];
  };
  
  // 时间戳
  handoffAt: timestamp;
}
```

### 2.3 Rejection Trace

```typescript
interface RejectionRecord {
  id: string;               // "REJ-001"
  traceId: string;
  
  // 拒绝的 handoff
  handoffId: string;
  
  // 拒绝者
  rejectedBy: string;        // Agent ID
  rejectedAt: timestamp;
  
  // 拒绝原因
  reason: {
    type: 'wrong_data_format' | 'missing_requirements' | 'ambiguous_interpretation' | 'quality_gate_failed';
    description: string;
    blockingFields: string[];  // 具体哪些字段有问题
    suggestedFix: string;
  };
  
  // 处理结果
  resolution: {
    action: 'REVERT' | 'PATCH' | 'ESCALATE_TO_HUMAN';
    resolvedBy?: string;
    resolvedAt?: timestamp;
    parentVersion: string;   // 回滚时用
  };
  
  // 因果链
  causedBy?: string;         // 如果这个拒绝是由更早的拒绝引起的
  chainLength: number;        // 拒绝链长度
}
```

---

## 三、决策日志规范

### 3.1 每个 Agent 必须记录的决策

```typescript
// 每个 Agent 在处理每个任务时必须填写

const REQUIRED_DECISIONS = {
  // 1. 输入解释决策
  inputInterpretation: {
    required: true,
    template: {
      situation: "收到了什么输入",
      interpretation: "我如何理解这个输入",
      alternatives: ["其他可能的理解方式"],
      chosen: "选择了哪种理解",
      confidence: 0.0-1.0,
      uncertainty: "我不确定的地方"
    }
  },
  
  // 2. 方案选择决策
  approachSelection: {
    required: true,
    template: {
      options: ["方案A", "方案B", "方案C"],
      evaluationCriteria: ["标准1", "标准2"],
      scores: { "方案A": 8, "方案B": 6 },
      chosen: "方案A",
      rationale: "因为..."
    }
  },
  
  // 3. 不确定性标记
  uncertaintyFlag: {
    required: true,
    template: {
      ambiguousAreas: ["区域1", "区域2"],
      ambiguityLevel: "high/medium/low",
      downstreamImpact: "如果我理解错了，会影响...",
      confidenceScore: 0.0-1.0
    }
  },
  
  // 4. 质量自检
  qualitySelfCheck: {
    required: true,
    template: {
      completenessCheck: "我的产出是否覆盖了所有需要的内容",
      consistencyCheck: "我的产出一致性如何",
      knownIssues: ["问题1", "问题2"],
      selfPass: boolean
    }
  }
};
```

### 3.2 置信度评级

```typescript
const CONFIDENCE_LEVELS = {
  HIGH: {
    threshold: 0.9,
    color: "green",
    meaning: "我有充分信心这个决策是正确的",
    downstreamWarning: false
  },
  MEDIUM: {
    threshold: 0.7,
    color: "yellow",
    meaning: "我认为是正确的，但有一些不确定",
    downstreamWarning: true,
    warningMessage: "下游注意：此决策有一定不确定性"
  },
  LOW: {
    threshold: 0.0,
    color: "red",
    meaning: "我需要人工确认",
    downstreamWarning: true,
    warningMessage: "⚠️ 下游暂停：此决策需要人工审核"
  }
};
```

---

## 四、持久化存储

### 4.1 中间产物存储

```typescript
interface ArtifactStorage {
  // 每个 agent 的产出都必须持久化
  basePath: "/var/boardgame-studio/artifacts/{traceId}/{agentId}/";
  
  // 文件命名规范
  naming: {
    pattern: "{agentId}_{taskId}_{version}_{timestamp}",
    example: "rule-analyst_CATAN-001_v1.0.0_20260324T184500Z"
  };
  
  // 必须保存的内容
  requiredFiles: {
    primary: "output.{format}",      // 主要产出
    context: "context.json",          // 接收到的上下文
    decisions: "decisions.json",      // 决策日志
    validation: "validation.json",    // 自检验证
    logs: "agent.log"                // agent 执行日志
  };
}
```

### 4.2 存储策略

```typescript
// 短期存储（30天）
const SHORT_TERM_STORAGE = {
  ttl: "30d",
  scope: "all_traces",
  compression: "lz4"
};

// 中期存储（1年）
const MEDIUM_TERM_STORAGE = {
  ttl: "365d",
  scope: "successful_traces + failed_traces",
  compression: "lz4"
};

// 长期存储（永久）
const LONG_TERM_STORAGE = {
  ttl: "forever",
  scope: "final_output_artifacts_only",
  compression: "none"
};
```

---

## 五、Dashboard 设计

### 5.1 流水线状态视图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎮 Catan - Pipeline Dashboard                           TRACE-CATAN-001   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Status: RUNNING │ Tier: 2 │ Started: 18:30 │ ETA: 19:30                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [rule-analyst]  ████████████████████  COMPLETED (2m 30s)                  │
│       │                                                                    │
│       ▼                                                                    │
│  [mechanic-extractor]  ████████████████████  COMPLETED (4m 15s)          │
│       │                                                                    │
│       ▼                                                                    │
│  [balance-evaluator]  ████████████░░░░░░░░░  RUNNING (2m 10s)            │
│       │                         ▲                                         │
│       │                    ┌────┴────┐                                    │
│       ▼                    │ REJECTED │ ←── 18:42:30                      │
│  [game-engine-dev]  PENDING ──────────┴── rule-analyst v0.2.1 → REVERT   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Recent Rejections                                                          │
│  REJ-001 game-engine-dev rejected by rule-analyst (18:42:30)               │
│         Reason: PhaseSpec missing turnOrder field                          │
│         Action: REVERT to v0.2.0                                           │
│                                                                             │
│  REJ-002 balance-evaluator flagged by game-engine-dev (18:40:15)          │
│         Reason: WinRateAnalysis missing strategyProfiles                   │
│         Action: PATCH - resubmitting with fix                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Confidence Scores                                                         │
│  rule-analyst: ████████████ 0.92 HIGH                                     │
│  mechanic-extractor: █████████░░░ 0.75 MEDIUM ⚠️                          │
│  balance-evaluator: ████████████ 0.88 HIGH                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Agent 性能分析

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Agent Performance Analytics                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Agent              │ Avg Duration │ Success Rate │ Reject Rate │ Conf Avg  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  rule-analyst       │ 3m 12s      │ 95%          │ 5%          │ 0.88     │
│  mechanic-extractor │ 5m 45s      │ 88%          │ 12%         │ 0.79     │
│  balance-evaluator │ 8m 30s      │ 82%          │ 18%         │ 0.72     │
│  test-generator     │ 4m 20s      │ 90%          │ 10%         │ 0.81     │
│  game-engine-dev    │ 12m 15s     │ 75%          │ 25%         │ 0.68     │
│  ...                                                                        │
│                                                                             │
│  ⚠️ Bottleneck Detected: balance-evaluator (avg 8m 30s, highest reject)   │
│  💡 Suggestion: Consider parallelizing balance checks for Tier 2 games      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 拒绝模式分析

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Rejection Pattern Analysis (Last 30 Days)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Most Common Rejection Types:                                               │
│  1. PhaseSpec missing field (32%)                                          │
│  2. WinCondition incomplete (24%)                                           │
│  3. GameMechanics version mismatch (18%)                                    │
│  4. Component quantity mismatch (15%)                                       │
│  5. Other (11%)                                                            │
│                                                                             │
│  By Game Tier:                                                              │
│  Tier 1: 3% rejection rate (very stable)                                   │
│  Tier 2: 12% rejection rate (acceptable)                                   │
│  Tier 3: 28% rejection rate (needs attention)                              │
│  Tier 4: 45% rejection rate (significant瓶颈)                              │
│                                                                             │
│  Top Contributing Agents:                                                   │
│  1. balance-evaluator (rejects 35% of inputs)                             │
│  2. game-engine-dev (rejects 28% of inputs)                               │
│  3. mechanic-extractor (rejects 18% of inputs)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 六、日志规范

### 6.1 结构化日志格式

```typescript
// 所有 Agent 必须使用统一的日志格式

interface AgentLog {
  timestamp: string;         // ISO 8601
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  
  // 上下文
  traceId: string;
  agentId: string;
  taskId: string;
  
  // 事件类型
  event: LogEvent;
  
  // 详情
  details: Record<string, any>;
  
  // 关联
  relatedHandoffId?: string;
  relatedDecisionId?: string;
}

type LogEvent = 
  | "task_received"
  | "input_validated"
  | "decision_made"
  | "output_produced"
  | "handoff_sent"
  | "handoff_received"
  | "rejection_sent"
  | "rejection_received"
  | "escalation_triggered"
  | "task_completed"
  | "error_occurred";

// 示例
const logEntry: AgentLog = {
  timestamp: "2026-03-24T18:42:30.123Z",
  level: "WARN",
  traceId: "TRACE-CATAN-001",
  agentId: "game-engine-dev",
  taskId: "CATAN-ENG-003",
  event: "rejection_sent",
  details: {
    rejectedHandoffId: "HND-042",
    reason: "PhaseSpec missing turnOrder",
    blockingFields: ["phases[0].turnOrder", "phases[1].turnOrder"],
    suggestedFix: "Add turnOrder field to all Phase objects",
    action: "REJECT"
  },
  relatedHandoffId: "HND-042"
};
```

### 6.2 日志采集

```yaml
# 使用 Fluentd/Filebeat 采集
fluentd:
  source:
    type: tail
    path: /var/boardgame-studio/logs/*.log
    format: json
  
  filter:
    - tag: boardgame-studio
      type: record_transformer
      record:
        traceId: ${record["traceId"]}
        agentId: ${record["agentId"]}
  
  output:
    elasticsearch:
      host: elasticsearch.boardgame-studio
      index: boardgame-studio-logs-%Y%m%d
```

---

## 六、告警规则

### 7.1 关键告警

```yaml
alerts:
  # Pipeline 失败告警
  - name: pipeline_failed
    condition: pipeline.status == "failed"
    severity: critical
    notification:
      - slack: "#boardgame-alerts"
      - pagerduty: critical
  
  # Rejection 率过高
  - name: high_rejection_rate
    condition: agent.rejectionRate > 0.3
    severity: warning
    window: 1h
  
  # Agent 执行时间过长
  - name: agent_timeout
    condition: agent.duration > agent.expectedDuration * 2
    severity: warning
    notification:
      - slack: "#boardgame-warnings"
  
  # 置信度下降
  - name: low_confidence
    condition: agent.avgConfidence < 0.6
    severity: warning
    notification:
      - slack: "#boardgame-warnings"
  
  # 循环拒绝（同一 artifact 被多次拒绝）
  - name: circular_rejection
    condition: rejection.chainLength > 3
    severity: critical
    notification:
      - slack: "#boardgame-alerts"
      - escalate: true  # 自动升级
```

### 7.2 Dashboard 链接

每个告警都包含直接跳转到对应 trace 的链接：

```
🔴 ALERT: pipeline_failed
   Trace: TRACE-CATAN-047
   Failed at: game-engine-dev
   Error: PhaseSpec validation failed
   → [View Trace](dashboard.boardgame-studio/trace/TRACE-CATAN-047)
   → [View Agent Logs](dashboard.boardgame-studio/agent/game-engine-dev/logs?trace=TRACE-CATAN-047)
```

---

## 七、运行时指标规范（ P0 生产必选 ）

### 7.0 为什么需要运行时指标

**问题：** 告警规则定义了"什么时候告警"，但没有定义"监控什么指标"

**解决方案：** 定义 Top 10 运行时指标 + 告警阈值

### 7.1 Top 10 运行时指标

```typescript
// 指标定义
interface RuntimeMetrics {
  // === 核心业务指标 ===
  
  // 1. 游戏完成率
  gameCompletionRate: {
    type: "ratio";           // 完成数 / 开始数
    window: "1h";
    alertThreshold: "< 0.8"; // 80% 以下告警
  };
  
  // 2. 每回合平均耗时
  moveLatency: {
    type: "histogram";       // P50/P95/P99
    buckets: [100, 500, 1000, 2000, 5000, 10000]; // ms
    alertThreshold: "P99 > 5000ms";
  };
  
  // 3. 规则引擎验证延迟
  validationLatency: {
    type: "histogram";
    buckets: [50, 100, 200, 500, 1000, 2000, 5000];
    alertThreshold: "P99 > 2000ms";
  };
  
  // 4. 规则引擎拒绝率
  validationRejectionRate: {
    type: "ratio";
    window: "5m";
    alertThreshold: "> 0.15";  // 15% 以上告警
    breakBy: "failureType";     // 按失败类型分类
  };
  
  // 5. 熔断器触发率
  circuitBreakerTripRate: {
    type: "counter";
    window: "5m";
    alertThreshold: "> 3 trips / 5m";
    breakBy: "agent";          // 按 Agent 分类
  };
  
  // === 基础设施指标 ===
  
  // 6. Agent 健康状态
  agentHealthStatus: {
    type: "gauge";            // 1=healthy, 0.5=degraded, 0=down
    alertThreshold: "any agent < 0.5";
    breakBy: "agent", "tier";
  };
  
  // 7. 队列深度（待处理任务）
  queueDepth: {
    type: "gauge";
    alertThreshold: "> 100";
    breakBy: "priority";       // P0/P1/P2/P3
  };
  
  // 8. AI API 调用失败率
  aiApiFailureRate: {
    type: "ratio";
    window: "5m";
    alertThreshold: "> 0.05";  // 5% 以上告警
    breakBy: "model", "provider";
  };
  
  // 9. 断线重连成功率
  reconnectionSuccessRate: {
    type: "ratio";
    window: "1h";
    alertThreshold: "< 0.95";   // 95% 以下告警
  };
  
  // 10. 用户满意度（游戏后）
  userSatisfaction: {
    type: "gauge";             // 1-5 分
    window: "24h";
    alertThreshold: "< 3.5";
    sampleRate: "0.1";         // 10% 用户抽样
  };
}
```

### 7.2 指标采集规范

```yaml
# Prometheus 指标格式
metrics:
  # 游戏完成率
  - name: game_completion_total
    type: counter
    labels: [game_type, tier]
    
  - name: game_started_total
    type: counter
    labels: [game_type, tier]
    
  # 延迟直方图
  - name: move_duration_seconds
    type: histogram
    buckets: [0.1, 0.5, 1, 2, 5, 10]
    labels: [game_type, agent, phase]
    
  - name: validation_duration_seconds
    type: histogram
    buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5]
    labels: [game_type, move_type]
    
  # 熔断器状态
  - name: circuit_breaker_trips_total
    type: counter
    labels: [agent, tier, state_from, state_to]
    
  # 拒绝率
  - name: validation_rejections_total
    type: counter
    labels: [game_type, failure_type]
```

### 7.3 Dashboard 面板布局

```
┌─────────────────────────────────────────────────────────────────┐
│                    Boardgame Studio Dashboard                     │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Game Completion│  Move Latency   │  Validation Rejection Rate  │
│      Rate       │    P50/P95/P99  │         by Failure Type     │
│   [Gauge]       │   [Line Chart]  │        [Stacked Bar]       │
│   87.3% ✅      │  245ms/1.2s/3s  │  illegal: 3%               │
│                 │                 │  timeout: 1%                 │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ Circuit Breaker │   Agent Health  │      Queue Depth           │
│   Trip History  │    Status Grid   │     by Priority           │
│   [Timeline]    │   [Heatmap]      │     [Area Chart]          │
│   ⚠️ 3 trips    │  All: ✅         │  P0: 12  P1: 45           │
├─────────────────┴─────────────────┴─────────────────────────────┤
│                      AI API Failure Rate                         │
│                    by Model / Provider                           │
│                  [Multi-line Chart]                             │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 告警阈值配置

```yaml
# alertmanager.yaml
groups:
  - name: boardgame_critical
    interval: 30s
    rules:
      # P0: 游戏完成率过低
      - alert: GameCompletionRateLow
        expr: game_completed_total / game_started_total < 0.8
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "游戏完成率低于 80%"
          description: "过去 1 小时完成率 {{ $value | humanizePercentage }}"
          
      # P0: 规则引擎 P99 延迟过高
      - alert: ValidationLatencyHigh
        expr: histogram_quantile(0.99, validation_duration_seconds) > 2
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "规则引擎 P99 延迟超过 2 秒"
          
      # P1: 熔断器频繁触发
      - alert: CircuitBreakerFlapping
        expr: rate(circuit_breaker_trips_total[5m]) > 0.6  # > 3 trips / 5m
        for: 5m
        labels:
          severity: warning
          
      # P1: 验证拒绝率上升
      - alert: ValidationRejectionRateHigh
        expr: rate(validation_rejections_total[5m]) / rate(validation_total[5m]) > 0.15
        for: 5m
        labels:
          severity: warning
```

---

## 八、故障排查流程

### 8.1 常见问题处理

| 问题 | 排查步骤 |
|------|---------|
| 流水线卡住 | 1. 查看 dashboard 确定哪个 Agent 是瓶颈<br>2. 检查 Agent 日志<br>3. 检查 handoff 是否完成 |
| 下游报上游产出错误 | 1. 查看 rejection trace<br>2. 确定是 REVERT/PATCH/ESCALATE<br>3. 如果是 REVERT，检查 parent version |
| 产出质量差 | 1. 查看决策日志的 confidence<br>2. 检查 uncertaintyFlag<br>3. 如果 LOW confidence → 需要人工审核 |
| Agent 崩溃 | 1. 查看 error 日志<br>2. 根据 decision log 恢复状态<br>3. 从最后一个成功的 handoff 重新开始 |

### 8.2 调试命令

```bash
# 查看 trace 详情
boardgame-cli trace get TRACE-CATAN-001

# 查看 agent 执行记录
boardgame-cli trace agent rule-analyst --trace TRACE-CATAN-001

# 查看 rejection 链
boardgame-cli trace rejection --trace TRACE-CATAN-001

# 重放 trace（用于调试）
boardgame-cli trace replay TRACE-CATAN-001 --from agentId

# 检查 agent 健康状态
boardgame-cli agent health --all
```

---

## 九、与现有系统的集成

### 9.1 与 PROTOCOLS.md 的集成

```typescript
// HandoffPackage 必须包含 trace 信息

interface HandoffPackageV3<Output, Input> {
  // ... 现有字段 ...
  
  // 新增：trace 信息
  trace: {
    traceId: string;
    handoffId: string;
    
    // 上游 agent 执行记录引用
    fromExecution: {
      agentId: string;
      executionId: string;
      confidence: number;
      decisionLogId: string;
    };
  };
}
```

### 9.2 与 QUALITY.md 的集成

```typescript
// 质量门禁检查时，需要查看 trace

const PRE_RELEASE_GATES = {
  // ... 现有门禁 ...
  
  // 新增：trace 相关门禁
  traceability: {
    decisionLogComplete: { threshold: 1.0, measure: 'trace_coverage' },
    handoffRecordComplete: { threshold: 1.0, measure: 'handoff_coverage' },
    confidenceAboveThreshold: { threshold: 0.7, measure: 'avg_confidence' }
  }
};
```

---

*Observability Framework v1.0*

---

## 十、日志回放协议 (Replay Protocol)

> 从日志重建精确游戏状态，fork分支运行反事实模拟

### 10.1 回放数据模型

```typescript
interface ReplayData {
  // 完整游戏重放所需的数据
  traceId: string;
  
  // 初始状态（FEN格式）
  initialState: string;  // FEN格式
  
  // 动作序列
  moves: ReplayMove[];
  
  // 元数据
  metadata: {
    gameType: GameType;
    startTime: timestamp;
    endTime: timestamp;
    players: PlayerId[];
  };
}

interface ReplayMove {
  moveNumber: number;
  timestamp: timestamp;
  player: PlayerId;
  
  // 动作信息
  move: Move;
  
  // 验证信息
  validation: {
    validatedBy: 'rules-engine';
    result: 'legal' | 'illegal';
  };
  
  // 状态变更
  stateDiff: StateDiff;
}
```

### 10.2 状态快照格式

```typescript
// 每个关键点保存状态快照

interface StateSnapshot {
  id: string;
  traceId: string;
  
  // 快照时机
  trigger: 'phase_change' | 'turn_end' | 'milestone' | 'manual';
  
  // FEN格式的状态
  fen: string;
  
  // 完整性验证
  checksum: string;  // SHA-256
  
  // 关联的决策点
  associatedDecisions: string[];  // DecisionLog IDs
}
```

### 10.3 回放操作

```typescript
// 从 Trace 重建完整游戏
async function replayFromTrace(traceId: string): Promise<ReplayData> {
  // 1. 获取所有相关日志
  const logs = await queryLogs({ traceId });
  
  // 2. 解析初始状态
  const initialState = parseFEN(logs[0].initialState);
  
  // 3. 重建动作序列
  const moves = logs
    .filter(log => log.event === 'move_executed')
    .map(log => parseReplayMove(log));
  
  // 4. 返回完整的回放数据
  return { traceId, initialState, moves, metadata };
}

// Fork：从某个点创建分支游戏
async function forkFromSnapshot(
  snapshotId: string,
  alternativeMoves: Move[]
): Promise<ForkResult> {
  // 1. 获取快照状态
  const snapshot = await getSnapshot(snapshotId);
  
  // 2. 从快照状态应用新的动作序列
  let state = parseFEN(snapshot.fen);
  
  for (const move of alternativeMoves) {
    const validation = rulesEngine.validateMove(state, move);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }
    state = applyMove(state, move);
  }
  
  // 3. 返回分支结果
  return {
    success: true,
    originalTraceId: snapshot.traceId,
    forkPoint: snapshotId,
    resultingState: encodeFEN(state),
    alternativeMovesApplied: alternativeMoves.length
  };
}
```

### 10.4 回放用例

```typescript
const REPLAY_USE_CASES = {
  // 1. 调试：重现问题
  debugging: {
    description: '从特定状态重现问题',
    command: 'boardgame-cli replay --trace=TRACE-XXX --from=move:50'
  },
  
  // 2. 反事实模拟：测试替代方案
  counterfactual: {
    description: '测试如果当初选择不同会怎样',
    command: 'boardgame-cli fork --snapshot=SNAP-XXX --moves=ALT-MOVE-1,ALT-MOVE-2'
  },
  
  // 3. AI训练：生成训练数据
  aiTraining: {
    description: '从回放生成AI训练数据',
    command: 'boardgame-cli generate-training-data --games=100 --from-trace'
  },
  
  // 4. 平衡性测试：重复模拟
  balanceTesting: {
    description: '多次回放同一游戏测试平衡性',
    command: 'boardgame-cli simulate --games=1000 --ai=random --from-trace=TRACE-XXX'
  },
  
  // 5. 合规审计：验证规则遵守
  complianceAudit: {
    description: '验证所有动作都经过规则引擎验证',
    command: 'boardgame-cli audit --trace=TRACE-XXX --verify-rules'
  }
};
```

### 10.5 回放与Trace的集成

```typescript
// 回放数据是Trace的一部分

interface PipelineTraceV2 {
  traceId: string;
  
  // ... 现有字段 ...
  
  // 新增：回放相关
  replay: {
    initialState: string;  // FEN
    snapshots: StateSnapshot[];
    moves: ReplayMove[];
    
    // 可用性
    replayable: boolean;
    replayStartTime?: timestamp;
    replayEndTime?: timestamp;
  };
}
```

---

*Observability Framework v1.1 — 包含日志回放协议*
