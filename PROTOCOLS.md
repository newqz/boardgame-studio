# Handoff Protocol — Agent 交接协议标准

> 所有 Agent 之间的交接必须遵循此标准格式

---

## 交接数据包结构

每个交接必须包含以下四个部分：

```typescript
interface HandoffPackage<Output, Input> {
  // 1. 产出物 - 本 Agent 完成的工作
  artifacts: {
    primary: Output;           // 主要交付物
    supplementary: Artifact[]; // 辅助文件（文档、截图、日志）
    version: string;           // 语义版本 "主.次.修订"
    qualitySignoff: boolean;   // 是否通过质量门禁
  };
  
  // 2. 上下文传递 - 下一个 Agent 需要知道的信息
  context: {
    summary: string;          // 50字以内的任务总结
    keyDecisions: Decision[]; // 关键决策及理由
    constraints: Constraint[];  // 必须遵守的约束
    assumptions: Assumption[]; // 基于的假设（如有）
  };
  
  // 3. 状态标记 - 当前任务的完整状态
  status: {
    completed: string[];       // 已完成项
    blocked: Blocker[];       // 阻塞项（需上游解决）
    deferred: string[];      // 延期项（下游需接手）
    knownRisks: Risk[];      // 已识别风险
  };
  
  // 4. 下游准备 - 为下一个 Agent 做好准备
  downstream: {
    nextAgent: string;        // 期望的下一个 Agent
    readySignals: Signal[];   # 就绪信号（下游需验证）
    rejectCriteria: string[]; // 拒绝标准（下游可据此打回）
  };
}
```

---

## 标准化类型定义

### Decision（决策）

```typescript
interface Decision {
  id: string;           // "DEC-001"
  decision: string;     // "选择方案A而非方案B"
  rationale: string;    // "因为方案A在性能测试中快30%"
  alternatives: string[]; // ["方案B: ...", "方案C: ..."]
  approvedBy: string;   // 审批者
  timestamp: string;    // ISO 8601
}
```

### Blocker（阻塞）

```typescript
interface Blocker {
  id: string;          // "BLK-001"
  description: string; // 阻塞描述
  severity: 'critical' | 'blocking' | 'warning';
  causedBy: string;    // 原因
  requiresAgent: string; // 需要哪个 Agent 解决
  suggestedResolution?: string;
  escalateAfter?: string; // 超时后升级
}
```

### Risk（风险）

```typescript
interface Risk {
  id: string;          // "RSK-001"
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;   // 应对策略
  contingency: string;  // 备选方案
}
```

### Artifact（产出物）

```typescript
interface Artifact {
  id: string;          // "ART-001"
  type: 'document' | 'code' | 'test' | 'design' | 'data' | 'other';
  name: string;        // 文件名或描述
  path: string;        // 文件路径
  checksum: string;     // SHA256 校验
  producedBy: string;   // 哪个 Agent 生成
  validatedBy?: string; // 哪个 Agent 验证
  qualityNotes?: string;
}
```

---

## 交接流程

### 标准五步交接

```
┌─────────────────────────────────────────────────────────┐
│  交接流程                                                  │
│                                                          │
│  1. 产出确认   ──→ 2. 上下文整理   ──→ 3. 数据校验       │
│       │                    │                   │          │
│       ▼                    ▼                   ▼          │
│  [完成所有产出]      [填充 Handoff ]      [验证完整性]    │
│                          Package                        │
│                                                          │
│       │                    │                   │          │
│       ▼                    ▼                   ▼          │
│  4. 正式交接   ──→ 5. 接收确认                               │
│       │                    │                              │
│       ▼                    ▼                              │
│  [发送 Package]       [下游 Agent                         │
│   给下游 Agent]        确认接收并                          │
│                       验证后开始]                         │
└─────────────────────────────────────────────────────────┘
```

### 交接检查清单

```markdown
## 交接前检查清单

- [ ] 主要产出物已完成
- [ ] 产出物已保存到标准路径
- [ ] 版本号已更新
- [ ] HandoffPackage 已填充完整
- [ ] 关键决策已记录理由
- [ ] 阻塞项已标记并分配
- [ ] 下游 Agent 已知晓任务
- [ ] 交接 Package 已发送给下游 Agent
- [ ] 收到下游 Agent 的接收确认
```

---

## 版本控制规范

### 语义版本

```
版本格式：主版本.次版本.修订

- 主版本 (Major): 重大架构变更，不兼容的接口变化
- 次版本 (Minor): 新增功能，向后兼容
- 修订 (Patch):  bug修复，向后兼容

示例：
- v1.0.0 → v1.1.0 (新增 AI 对手难度等级)
- v1.1.0 → v1.1.1 (修复骰子概率bug)
- v1.1.1 → v2.0.0 (更换游戏引擎架构)
```

### 状态文件

每个项目维护一个 `STATUS.md`：

```markdown
# [游戏名] 项目状态

## 当前阶段
Phase: 3/5 (开发阶段)

## 版本历史
| 版本 | 日期 | Agent | 变更 |
|------|------|-------|------|
| v0.1.0 | 2026-03-24 | rule-analyst | 初始规则分析完成 |
| v0.2.0 | 2026-03-24 | mechanic-extractor | 玩法提炼完成 |
| v1.0.0 | 2026-03-24 | project-director | 架构设计通过 |

## 当前阻塞
- BLK-001: 规则歧义（卡坦岛道路建造距离）→ rule-analyst

## 待处理
- [ ] design-phase 开始 (前置: 规则分析通过)
- [ ] 等待 UI 设计稿
```

---

## 冲突解决

### 优先级规则

当不同 Agent 的决策冲突时：

```
优先级高：
1. 安全相关决策
2. 核心规则实现
3. 质量门禁标准
4. 性能要求

优先级低：
- UI/UX 美观偏好
- 代码风格选择
- 文档格式规范
```

### 冲突升级流程

```
1. 同一阶段内的冲突 → 由 project-director 裁决
2. 跨阶段冲突 → 由 project-director + 双方 Agent 协商
3. 无法共识 → 保留两个方案，标注分歧，待 human-in-the-loop 决定
```

---

## Human-in-the-Loop 节点

以下节点必须有人类审核：

| 节点 | 审核内容 | 审核者 |
|------|---------|--------|
| 规则分析完成 | 规则理解是否正确 | 产品负责人 |
| 架构设计完成 | 技术方案是否合理 | 技术负责人 |
| 平衡性测试通过 | 游戏是否平衡 | 游戏策划 |
| 上线前 | 整体质量是否达标 | 项目经理 |

---

*Protocol v1.0 — 标准化 Agent 交接流程*

---

# 附录：Handoff Protocol v2 — 反向流控与版本控制

> v2 版本增加了反向流控机制，解决"下游发现上游问题"时的处理流程

---

## v2 主要变更

| 变更项 | v1 | v2 |
|--------|-----|-----|
| 版本追踪 | 简单版本号 | 完整版本历史链 |
| 回滚语义 | 无 | 明确的回滚策略 |
| 拒绝处理 | 简单打回 | 结构化拒绝协议 |
| 上游反馈 | 无 | 问题溯源机制 |

---

## v2 HandoffPackage 结构

```typescript
interface HandoffPackageV2<Output, Input> {
  // 基础信息
  id: string;                    // "HND-20260324-001"
  version: string;               // "1.0.0"
  parentVersion?: string;        // "0.9.0" — 溯源链
  
  // 1. 产出物
  artifacts: {
    primary: Output;
    supplementary: Artifact[];
    version: string;
    qualitySignoff: boolean;
  };
  
  // 2. 上下文传递
  context: {
    summary: string;
    keyDecisions: Decision[];
    constraints: Constraint[];
    assumptions: Assumption[];
  };
  
  // 3. 状态标记
  status: {
    completed: string[];
    blocked: Blocker[];
    deferred: string[];
    knownRisks: Risk[];
  };
  
  // 4. 下游准备
  downstream: {
    nextAgent: string;
    readySignals: Signal[];
    rejectCriteria: string[];
  };
  
  // ============ v2 新增 ============
  
  // 5. 版本信息（新增）
  versionInfo: {
    createdAt: string;
    modifiedAt: string;
    changelog: string[];         // 本版本的变更列表
    breakingChanges: boolean;     // 是否有破坏性变更
  };
  
  // 6. 下游拒绝记录（新增）
  rejection?: {
    rejectedBy: string;          // 哪个 Agent 拒绝
    reason: string;
    blockingFields: string[];    // 具体哪些字段有问题
    suggestedFix: string;        // 建议的修复方向
    rejectionCount: number;      // 被拒绝次数
    previousRejections: RejectionRecord[];  // 历史拒绝
  };
  
  // 7. 回滚策略（新增）
  rollbackPolicy: RollbackPolicy;
}

interface RejectionRecord {
  rejectedAt: string;
  rejectedBy: string;
  reason: string;
  resolution: string;  // 如何解决的
}

type RollbackPolicy = 
  | 'REVERT';        // 完全回滚到 parentVersion
  | 'PATCH';         // 保留产出，仅修复问题字段
  | 'ESCALATE_TO_HUMAN';  // 升级到人工处理
  | 'CONTINUE';      // 继续，标记为 conditional
```

---

## v2 拒绝与回滚流程

### 完整流程图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Handoff v2 流程                              │
│                                                                      │
│  上游 Agent          交接包           下游 Agent                    │
│       │                │                  │                          │
│       │─── send ──────>│                  │                          │
│       │                │                  │                          │
│       │                │    validate & test                          │
│       │                │                  │                          │
│       │                │    ┌─────────────┴────────────┐            │
│       │                │    │                          │            │
│       │                │    │   验证通过？              │            │
│       │                │    └─────────────┬────────────┘            │
│       │                │              YES │                          │
│       │                │                ▼                          │
│       │                │          接受，继续流程                       │
│       │                │                  │                          │
│       │                │    NO ▼                                    │
│       │                │    ┌─────────────┴────────────┐            │
│       │                │    │                          │            │
│       │                │    │   拒绝原因分析              │            │
│       │                │    │   Is blocking?            │            │
│       │                │    └─────────────┬────────────┘            │
│       │                │              YES │                          │
│       │                │                ▼                          │
│       │                │    ┌─────────────────────────┐              │
│       │                │    │  填写 rejection 记录     │              │
│       │                │    │  确定 rollbackPolicy     │              │
│       │                │    └─────────────┬───────────┘              │
│       │                │                  │                          │
│       │                │   send rejection ─┤                          │
│       │                │<─────────────────┘                          │
│       │                │                  │                          │
│       ◄─── fix ────────│                  │                          │
│       │                │                  │                          │
│       │  ┌─────────────┴─────────────┐    │                          │
│       │  │  rollbackPolicy 执行       │    │                          │
│       │  │  REVERT: 回到 parentVer  │    │                          │
│       │  │  PATCH: 修复后重新交接    │    │                          │
│       │  │  ESCALATE: 升级人工      │    │                          │
│       │  └─────────────────────────┘    │                          │
│       │                │                  │                          │
└───────┴────────────────┴──────────────────┴──────────────────────────┘
```

### 拒绝处理决策树

```typescript
function handleRejection(
  package: HandoffPackage,
  rejection: Rejection
): Resolution {
  
  // 1. 分析拒绝原因
  const severity = assessSeverity(rejection);
  
  // 2. 确定是否 blocking
  if (!rejection.blocking) {
    // 非阻塞性问题：记录但继续
    return {
      action: 'CONTINUE_WITH_WARNING',
      logReason: rejection.reason
    };
  }
  
  // 3. 分析是否需要回滚
  if (rejection.type === 'wrong_data_format') {
    // 数据格式错误：PATCH 修复
    return {
      action: 'PATCH',
      targetVersion: package.version,
      fixScope: rejection.blockingFields
    };
  }
  
  if (rejection.type === 'missing_requirements') {
    // 需求遗漏：检查 parentVersion 是否有
    if (package.parentVersion) {
      return { action: 'REVERT', targetVersion: package.parentVersion };
    }
    return { action: 'ESCALATE_TO_HUMAN' };
  }
  
  if (rejection.type === 'ambiguous_interpretation') {
    // 歧义解释：升级人工
    return { action: 'ESCALATE_TO_HUMAN' };
  }
  
  // 4. 默认：PATCH 修复
  return {
    action: 'PATCH',
    targetVersion: package.version,
    fixScope: 'all'
  };
}
```

---

## 模型变更协议

当上游 Model 发生变更时：

```typescript
interface ModelChangeEvent {
  model: string;           // e.g., "GameMechanics"
  version: { from: string; to: string };
  severity: 'minor' | 'major' | 'breaking';
  
  // 影响分析
  affectedAgents: string[];
  affectedArtifacts: string[];
  
  // 建议行动
  recommendedAction: 'ADAPT' | 'REVIEW' | 'ESCALATE';
  
  // 截止日期
  deadline: string;
}

// 模型变更处理流程
function handleModelChange(event: ModelChangeEvent): void {
  // 1. 广播变更通知
  broadcastToAgents(event.affectedAgents, {
    type: 'MODEL_CHANGE',
    event
  });
  
  // 2. 评估影响
  for (const agentId of event.affectedAgents) {
    const impact = assessImpact(agentId, event);
    
    if (impact === 'BREAKING') {
      // 破坏性变更：暂停所有受影响 Agent
      pauseAgent(agentId);
      
      // 触发人工审核
      escalateToHuman({
        type: 'MODEL_BREAKING_CHANGE',
        model: event.model,
        affectedAgents: event.affectedAgents
      });
    } else if (impact === 'MAJOR') {
      // 重大变更：Agent 审查自己的依赖
      notifyAgent(agentId, {
        type: 'REVIEW_REQUIRED',
        deadline: event.deadline
      });
    } else {
      // 轻微变更：Agent 自行适配
      notifyAgent(agentId, { type: 'ADAPT_REQUIRED' });
    }
  }
}
```

---

## 版本历史追踪

每个项目维护版本历史：

```markdown
# 版本历史追踪

## Catan 项目

| 版本 | 日期 | Agent | 变更类型 | 描述 |
|------|------|-------|---------|------|
| v0.1.0 | 03-24 | rule-analyst | INITIAL | 初始规则分析 |
| v0.2.0 | 03-24 | mechanic-extractor | MINOR | 玩法提炼完成 |
| v0.2.1 | 03-24 | mechanic-extractor | PATCH | 修复阶段定义错误 |
| v0.3.0 | 03-24 | balance-evaluator | MAJOR | 平衡性分析完成 |
| v0.3.1 | 03-24 | balance-evaluator | PATCH | 修复胜率计算bug |
| **REJECTED** | 03-24 | game-engine-dev | REJECTED | 规则引擎版本v0.3.0被拒绝 |
| v0.3.2 | 03-24 | rule-analyst | PATCH | 重新交接，修复歧义 |
| v1.0.0 | 03-24 | project-director | MAJOR | 架构设计通过 |

## 拒绝记录

### REJECTED-001: rule-engine v0.3.0
- **拒绝者**: game-engine-dev
- **原因**: GameMechanics 版本不兼容，PhaseSpec 缺少 turnOrder
- **解决方案**: REVERT to v0.2.0, mechanic-extractor 重新交接
- **教训**: 跨 Agent 依赖需要明确的 Schema 验证
```

---

# 附录：Handoff Protocol v3 — 人类审核与升级协议

> v3 版本解决"升级后怎么办"的问题

---

## v3 核心问题

Opus 4.6 指出：
> "ESCALATE 存在，但没有结构化的升级后处理协议"

**核心问题：**
- 什么时候必须升级人工？
- 人工需要做什么决策？
- 人工的响应 SLA 是什么？
- 人工决策如何反馈到流水线？

---

## 一、强制人工审核节点（Human Checkpoints）

### 1.1 Tier 1-2 游戏

| 节点 | 时机 | 审核内容 | 审核者 | SLA |
|------|------|---------|--------|-----|
| 规则分析完成 | rule-analyst 完成后 | 规则理解是否正确 | 产品负责人 | 4h |
| 架构设计完成 | 项目总监规划完成后 | 技术方案是否合理 | 技术负责人 | 4h |
| 上线前 | 发布前 | 整体质量是否达标 | 项目经理 | 24h |

### 1.2 Tier 3-4 游戏（额外检查点）

| 节点 | 时机 | 审核内容 | 审核者 | SLA |
|------|------|---------|--------|-----|
| 玩法提炼完成 | mechanic-extractor 完成后 | 机制理解是否正确 | 游戏策划 | 8h |
| AI 策略设计 | ai-opponent-dev 完成后 | AI 策略是否合理 | 游戏策划 | 8h |
| UI/UX 设计 | ui-designer + interaction-designer 完成后 | 交互体验是否流畅 | 产品负责人 | 8h |
| 平衡性验证 | balance-evaluator 完成后 | 策略多样性是否足够 | 游戏策划 | 24h |
| 发布前 | 上线前 | 整体质量 + 规则争议 | 项目经理 | 24h |

### 1.3 触发额外审核的条件

```typescript
const MANDATORY_REVIEW_TRIGGERS = {
  // 规则歧义
  ruleAmbiguity: {
    condition: 'rule-analyst 标记 confidence < 0.7',
    action: '触发规则审核'
  },
  
  // 架构变更
  architectureChange: {
    condition: 'game-engine-dev 提议架构重大变更',
    action: '触发技术评审'
  },
  
  // 平衡性问题
  balanceIssue: {
    condition: 'balance-evaluator 发现胜率偏差 > 20%',
    action: '触发平衡性审核'
  },
  
  // 循环拒绝
  circularRejection: {
    condition: '同一 artifact 被拒绝 3 次以上',
    action: '触发人工介入'
  },
  
  // 高复杂度特性
  complexFeature: {
    condition: '遇到 Tier 4 独有机制（战役、遗产等）',
    action: '触发专家审核'
  }
};
```

---

## 二、升级工单 Schema

```typescript
interface EscalationTicket {
  // 工单标识
  id: string;                 // "ESC-20260324-001"
  traceId: string;            // 关联的 trace
  priority: 'critical' | 'high' | 'medium' | 'low';
  
  // 问题分类
  category: EscalationCategory;
  
  // 问题描述
  problem: {
    summary: string;           // 50字以内
    description: string;      // 详细描述
    affectedAgents: string[]; // 受影响的 Agent
    blockingProgress: boolean; // 是否阻塞流水线
  };
  
  // 上下文传递
  context: {
    // Agent 已尝试的解决方案
    attemptedSolutions: string[];
    
    // 各方观点/争议点
    viewpoints: {
      [agentId: string]: {
        position: string;
        rationale: string;
        confidence: number;
      };
    };
    
    // 相关文档/规则引用
    references: {
      type: 'rulebook' | 'faq' | 'bgg' | 'designer' | 'other';
      content: string;
      url?: string;
    }[];
  };
  
  // 需要的决策
  decision: {
    question: string;          // 需要回答的核心问题
    options: {
      id: string;
      description: string;
      pros: string[];
      cons: string[];
      recommendedBy?: string; // 推荐此方案的 Agent
    }[];
    recommendedOption?: string; // Agent 推荐的方案
    decisionCriteria: string[]; // 决策标准
  };
  
  // SLA
  sla: {
    responseDeadline: timestamp;
    resolutionDeadline: timestamp;
    currentStatus: 'pending_review' | 'in_review' | 'resolved' | 'expired';
  };
  
  // 决策记录
  resolution?: {
    decidedBy: string;
    decidedOption: string;
    rationale: string;
    decidedAt: timestamp;
    feedbackToAgents: string;  // 给 Agent 的反馈
  };
}

type EscalationCategory = 
  | 'rule_ambiguity'
  | 'architecture_decision'
  | 'balance_dispute'
  | 'ux_design_conflict'
  | 'ai_difficulty'
  | 'resource_constraint'
  | 'timeline_conflict'
  | 'scope_change';
```

---

## 三、升级处理流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Escalation 处理流程                                 │
│                                                                         │
│  触发条件                                                                │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  1. Agent 标记 ESCALATE_TO_HUMAN                             │     │
│  │  2. 循环拒绝达到阈值 (≥3次)                                 │     │
│  │  3. 人工审核触发器被激活                                     │     │
│  │  4. confidence < 0.5                                        │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                              │                                         │
│                              ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  Step 1: 创建 EscalationTicket                              │     │
│  │  - 填充问题描述、上下文、已尝试方案                          │     │
│  │  - 确定优先级和 SLA                                          │     │
│  │  - 分配审核者                                                │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                              │                                         │
│                              ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  Step 2: 通知审核者                                          │     │
│  │  - 发送通知（Slack/Email/In-app）                            │     │
│  │  - 包含工单链接和上下文摘要                                  │     │
│  │  - 启动 SLA 计时器                                          │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                              │                                         │
│                              ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  Step 3: 人工审核                                            │     │
│  │  - 审核者查看完整上下文（trace、decision log、争议点）         │     │
│  │  - 选择方案或提出新方案                                      │     │
│  │  - 填写决策理由                                              │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                              │                                         │
│                              ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  Step 4: 记录决策并反馈                                      │     │
│  │  - 填写 resolution 字段                                     │     │
│  │  - 生成给 Agent 的 feedbackToAgents                          │     │
│  │  - 更新 ticket status                                        │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                              │                                         │
│                              ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  Step 5: Agent 恢复执行                                       │     │
│  │  - 读取 feedbackToAgents                                     │     │
│  │  - 根据决策更新产出                                          │     │
│  │  - 继续流水线                                                │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                              │                                         │
│                              ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  Step 6: 决策入库（反馈循环）                                  │     │
│  │  - 将决策记录存入知识库                                       │     │
│  │  - 更新 AGENT-MODEL-MAPPING 中的规则                          │     │
│  │  - 下次遇到类似问题可自动处理                                  │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 四、SLA 定义

```typescript
const ESCALATION_SLA = {
  // Tier 1-2 游戏
  tier12: {
    critical: {
      responseTime: '1h',      // 1小时内响应
      resolutionTime: '4h',     // 4小时内解决
      example: '游戏完全无法运行'
    },
    high: {
      responseTime: '4h',
      resolutionTime: '24h',
      example: '规则理解有重大分歧'
    },
    medium: {
      responseTime: '24h',
      resolutionTime: '72h',
      example: 'UI 细节争议'
    }
  },
  
  // Tier 3-4 游戏
  tier34: {
    critical: {
      responseTime: '2h',
      resolutionTime: '8h',
      example: 'AI 策略完全不合理'
    },
    high: {
      responseTime: '8h',
      resolutionTime: '24h',
      example: '平衡性偏差 > 25%'
    },
    medium: {
      responseTime: '24h',
      resolutionTime: '72h',
      example: '机制理解差异'
    }
  },
  
  // SLA 违约处理
  breach: {
    autoEscalate: true,  // SLA 超时自动升级
    notify: ['project_owner', 'engineering_lead'],
    fallbackAction: 'use_default_conservative_option'
  }
};
```

---

## 五、决策知识库

```typescript
// 人工决策积累成知识库，用于类似问题的自动处理

interface DecisionKnowledgeBase {
  // 问题模式
  problemPatterns: {
    id: string;
    pattern: string;           // e.g., "规则冲突: 同时声称 X 和 not-X"
    category: EscalationCategory;
    frequency: number;         // 出现次数
  }[];
  
  // 决策记录
  decisions: {
    id: string;
    problemPatternId: string;
    context: string;          // 简化上下文
    decision: string;
    rationale: string;
    outcome: 'success' | 'failed' | 'needs_improvement';
    feedback?: string;
  }[];
  
  // 学习建议
  learnings: {
    ruleId: string;           // 更新的规则 ID
    update: string;           // 更新的内容
    reason: string;           // 为什么更新
    confidence: number;       // 学习置信度
  }[];
}

// 当新问题与已有模式匹配时，可以自动处理
function autoHandleSimilar(
  newProblem: string,
  kb: DecisionKnowledgeBase
): 'auto_resolve' | 'suggest_option' | 'force_human_review' {
  
  // 1. 查找相似问题
  const similar = findSimilar(newProblem, kb.problemPatterns);
  
  if (similar.length === 0) {
    return 'force_human_review';
  }
  
  // 2. 查找相似问题的历史决策
  const history = findHistoryDecisions(similar[0].id, kb.decisions);
  
  if (history.length >= 3 && history.every(h => h.outcome === 'success')) {
    // 3. 如果历史决策一致且成功，自动处理
    return 'auto_resolve';
  }
  
  // 4. 否则提供建议但强制人工审核
  return 'suggest_option';
}
```

---

## 六、审核者仪表盘

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎯 Human Review Dashboard                          Reviewer: @product    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Pending Reviews (3)                         Overdue (1)                   │
│  ┌────────────────────────────────────────┐                               │
│  │ 🔴 ESC-20260324-001                    │ ← Overdue! (4h 20m)          │
│  │    规则歧义: 卡坦岛道路长度定义         │                               │
│  │    Game: Catan (Tier 2)                │                               │
│  │    Assigned to: @product               │                               │
│  │    [Review Now]                         │                               │
│  └────────────────────────────────────────┘                               │
│  ┌────────────────────────────────────────┐                               │
│  │ 🟡 ESC-20260324-002                    │                               │
│  │    平衡性: 士兵vs商船胜率偏差28%       │                               │
│  │    Game: Catan (Tier 2)                │                               │
│  │    Assigned to: @game_designer         │                               │
│  │    [Review Now]                         │                               │
│  └────────────────────────────────────────┘                               │
│                                                                             │
│  Recently Resolved (5)                                                      │
│  ┌────────────────────────────────────────┐                               │
│  │ ✅ ESC-20260324-000                    │  Resolved 2h ago              │
│  │    UI争议: 交易窗口位置                 │                               │
│  │    Decision: 右侧面板                  │                               │
│  │    [View Details]                       │                               │
│  └────────────────────────────────────────┘                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  SLA Compliance                                                            │
│  Response: ████████████████████░░░  87% (target: 95%)                     │
│  Resolution: ██████████████░░░░░░░░  72% (target: 90%)                    │
│                                                                             │
│  💡 Tip: 4 critical tickets are stuck waiting for @game_designer          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*Protocol v3.0 — 增加人类审核与升级协议*


