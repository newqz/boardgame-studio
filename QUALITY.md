# Quality Metrics — 质量度量标准

> 定义桌游电子化项目的质量衡量指标体系

---

## 一、质量维度

```
                    ┌─────────────────────┐
                    │   质量度量体系       │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   游戏正确性   │    │   玩家体验    │    │   技术质量    │
│               │    │               │    │               │
│ • 规则覆盖    │    │ • 上手难度    │    │ • 性能指标    │
│ • 边界条件    │    │ • 流畅度      │    │ • 稳定性      │
│ • 异常处理    │    │ • 反馈满意度  │    │ • 安全性      │
│ • 平衡性      │    │ • 留存率      │    │ • 可维护性    │
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## 二、游戏正确性指标

### 2.1 规则覆盖率

```typescript
interface RuleCoverageMetrics {
  // 规则项覆盖率
  totalRules: number;
  implementedRules: number;
  coverageRate: number;  // implementedRules / totalRules
  
  // 歧义解决率
  totalAmbiguities: number;
  resolvedAmbiguities: number;
  resolutionRate: number;
  
  // 边缘情况覆盖
  edgeCases: number;
  testedEdgeCases: number;
  edgeCaseCoverage: number;
}

// 验收标准
const RULE_COVERAGE_THRESHOLDS = {
  coverageRate: 1.0,        // 100% 规则覆盖
  resolutionRate: 1.0,      // 100% 歧义解决
  edgeCaseCoverage: 0.9     // 90% 边缘情况
};
```

### 2.2 测试用例指标

```typescript
interface TestMetrics {
  // 数量指标
  unitTests: number;
  integrationTests: number;
  e2eTests: number;
  
  // 覆盖率指标
  codeCoverage: number;       // 代码覆盖率
  branchCoverage: number;     // 分支覆盖率
  pathCoverage: number;       // 路径覆盖率
  
  // 通过率
  passRate: number;
  flakyTests: number;         // 不稳定测试
  
  // 性能测试
  performanceTests: PerformanceTestResult[];
}

const TEST_THRESHOLDS = {
  codeCoverage: 0.80,        // 80% 代码覆盖
  branchCoverage: 0.75,      // 75% 分支覆盖
  passRate: 1.0,            // 100% 通过
  flakyRate: 0.0           // 0% 不稳定测试
};
```

### 2.3 平衡性指标

```typescript
interface BalanceMetrics {
  // 胜率分布
  playerWinRates: Map<PlayerId, number>;
  winRateDeviation: number;   // 最大偏差
  
  // 策略多样性
  uniqueStrategies: number;
  strategyDistribution: Map<Strategy, number>;
  
  // 游戏时长
  averageDuration: number;    // 分钟
  durationVariance: number;
  
  // 崩溃率
  crashRate: number;          // 每千场游戏
  hangRate: number;           // 每千场游戏
}

const BALANCE_THRESHOLDS = {
  winRateDeviation: 0.15,     // 胜率偏差 < 15%
  uniqueStrategies: 3,        // 至少3种可行策略
  durationVariance: 0.2       // 时长波动 < 20%
};
```

---

## 三、玩家体验指标

### 3.1 新手引导指标

```typescript
interface OnboardingMetrics {
  // 首次体验
  timeToFirstAction: number;     // 秒，到达首次行动
  tutorialCompletionRate: number; // 教程完成率
  tutorialDropoutPoints: string[]; // 放弃点
  
  // 学习曲线
  actionsToCompetency: number;    // 达到Competency所需行动数
  avgActionsNewPlayer: number;     // 新玩家平均行动数
  avgActionsExperienced: number;   // 老玩家平均行动数
  
  // 误解率
  ruleMisunderstandings: number;  // 每场游戏的规则误解次数
  clarificationRequests: number;   // 每场游戏的澄清请求
}

const ONBOARDING_THRESHOLDS = {
  timeToFirstAction: 30,         // < 30秒
  tutorialCompletionRate: 0.9,    // 90% 完成率
  actionsToCompetency: 20,       // < 20次行动
  ruleMisunderstandings: 0.5      // < 0.5次/场
};
```

### 3.2 交互体验指标

```typescript
interface InteractionMetrics {
  // 响应性
  avgResponseTime: number;        // 毫秒
  p95ResponseTime: number;        // 毫秒
  maxResponseTime: number;         // 毫秒
  
  // 可用性
  misclickRate: number;           // 误点击率
  undoRequests: number;            // 撤销请求数/场
  helpRequests: number;            // 帮助请求数/场
  
  // 满意度
  nps: number;                    // Net Promoter Score
  avgRating: number;              // 应用商店评分
  reviews: Review[];
}

const INTERACTION_THRESHOLDS = {
  avgResponseTime: 100,           // < 100ms
  p95ResponseTime: 200,           // < 200ms
  misclickRate: 0.05,             // < 5%
  nps: 50                         // NPS > 50
};
```

### 3.3 留存指标

```typescript
interface RetentionMetrics {
  // 留存率
  d1Retention: number;   // 次日留存
  d7Retention: number;   // 7日留存
  d30Retention: number;  // 30日留存
  
  // 游戏完成率
  gameCompletionRate: number;    // 完整完成率
  earlyQuitRate: number;          // 提前退出率
  
  // 重玩意愿
  replayRate: number;             // 重玩率
  avgGamesPerUser: number;        // 人均游戏数
}

const RETENTION_THRESHOLDS = {
  d1Retention: 0.4,               // > 40%
  d7Retention: 0.2,                // > 20%
  gameCompletionRate: 0.85,        // > 85%
  replayRate: 0.5                  // > 50% 重玩
};
```

---

## 四、技术质量指标

### 4.1 性能指标

```typescript
interface PerformanceMetrics {
  // 延迟（毫秒）
  actionLatency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  
  // 帧率
  fps: {
    avg: number;
    min: number;
  };
  
  // 资源
  memory: {
    avgMB: number;
    peakMB: number;
  };
  
  // 网络
  networkEfficiency: {
    bytesPerGame: number;
    syncFrequency: number;  // 同步次数/分钟
  };
}

const PERFORMANCE_THRESHOLDS = {
  actionLatency: {
    avg: 100,
    p95: 200,
    p99: 500
  },
  fps: {
    avg: 60,
    min: 30
  },
  memory: {
    avgMB: 200,
    peakMB: 500
  }
};
```

### 4.2 稳定性指标

```typescript
interface StabilityMetrics {
  // 崩溃
  crashRate: number;              // 每千场
  anrRate: number;                // 每千场
  errorRate: number;              // 每千场
  
  // 可用性
  uptime: number;                 // 百分比
  incidentsPerMonth: number;
  
  // 错误类型分布
  errorDistribution: Map<ErrorType, number>;
}

const STABILITY_THRESHOLDS = {
  crashRate: 0.1,                 // < 0.1%
  anrRate: 0.05,                  // < 0.05%
  uptime: 0.999,                  // 99.9%
  incidentsPerMonth: 2
};
```

### 4.3 安全性指标

```typescript
interface SecurityMetrics {
  // 漏洞
  criticalVulnerabilities: number;
  highVulnerabilities: number;
  
  // 合规
  dataPrivacyCompliance: boolean;
  antiCheatPassRate: number;
  
  // 渗透测试
  penetrationTestsPassed: number;
  lastPenTestDate: string;
}

const SECURITY_THRESHOLDS = {
  criticalVulnerabilities: 0,
  highVulnerabilities: 0,
  antiCheatPassRate: 0.99
};
```

---

## 五、质量仪表盘

### 5.1 质量评分计算

```typescript
class QualityScore {
  static calculate(metrics: AllMetrics): QualityScoreBreakdown {
    const correctness = this.weightedAverage([
      { metric: metrics.ruleCoverage, weight: 0.4 },
      { metric: metrics.testCoverage, weight: 0.3 },
      { metric: metrics.balanceMetrics, weight: 0.3 }
    ]);
    
    const experience = this.weightedAverage([
      { metric: metrics.onboarding, weight: 0.3 },
      { metric: metrics.interaction, weight: 0.4 },
      { metric: metrics.retention, weight: 0.3 }
    ]);
    
    const technical = this.weightedAverage([
      { metric: metrics.performance, weight: 0.4 },
      { metric: metrics.stability, weight: 0.4 },
      { metric: metrics.security, weight: 0.2 }
    ]);
    
    return {
      overall: correctness * 0.35 + experience * 0.35 + technical * 0.30,
      correctness,
      experience,
      technical,
      grade: this.toGrade(correctness * 0.35 + experience * 0.35 + technical * 0.30)
    };
  }
  
  static toGrade(score: number): string {
    if (score >= 0.9) return 'A+';
    if (score >= 0.8) return 'A';
    if (score >= 0.7) return 'B';
    if (score >= 0.6) return 'C';
    return 'D';
  }
}
```

### 5.2 质量报告模板

```markdown
# 卡坦岛质量报告
## 日期：2026-03-24

## 综合评分
| 维度 | 得分 | 等级 |
|------|------|------|
| 游戏正确性 | 92/100 | A |
| 玩家体验 | 88/100 | B+ |
| 技术质量 | 95/100 | A |
| **综合** | **91.6/100** | **A** |

## 详细指标

### 游戏正确性
- [x] 规则覆盖率：100% (19/19)
- [x] 歧义解决率：100% (3/3)
- [x] 边缘情况：92% (12/13)
- [x] 测试覆盖率：87%

### 玩家体验
- [x] 首次行动时间：22秒
- [x] 教程完成率：94%
- [x] 响应时间P95：145ms
- [x] NPS：62

### 技术质量
- [x] 帧率：60fps avg
- [x] 内存峰值：180MB
- [x] 崩溃率：0.05%

## 风险项
⚠️ 强盗逻辑复杂度高，需持续监控
⚠️ AI对手难度需进一步调优

## 结论
✅ **可以上线** — 所有关键指标达标
```

---

## 六、质量关卡

### 上线前必须满足

```yaml
must_have:
  correctness:
    rule_coverage: 1.0           # 100%
    test_pass_rate: 1.0          # 100%
    critical_bugs: 0            # 0
    
  experience:
    avg_response_time: 200       # < 200ms
    crash_rate: 0.1             # < 0.1%
    d1_retention: 0.3           # > 30%
    
  technical:
    uptime: 0.999               # 99.9%
    critical_vulnerabilities: 0
    code_coverage: 0.70         # > 70%
```

### 上线后监控

```yaml
monitoring:
  daily:
    - active_users
    - game_completion_rate
    - crash_rate
    
  weekly:
    - nps_score
    - retention_curve
    - top_bugs
    
  monthly:
    - quality_score_trend
    - technical_debt_report
    - security_audit
```

---

*Quality Metrics v1.0*

---

## 七、质量门禁 vs 运营监控（v2 改进）

> **Opus 4.6 指出**：D1>40% 等留存率是运营指标，不应混入上线前质量门禁

### 7.1 核心区别

| 维度 | 质量门禁 (Pre-Release) | 运营监控 (Post-Release) |
|------|------------------------|------------------------|
| **测量时机** | 上线前 | 上线后 |
| **测量手段** | AI模拟 + 自动化测试 | 真实用户数据 |
| **失败响应** | 阻塞上线 | 触发告警 |
| **责任方** | QA Engineer + DevOps | Data Engineer + PM |

### 7.2 Pre-Release 质量门禁

```typescript
const PRE_RELEASE_GATES = {
  correctness: {
    rule_coverage: { threshold: 1.0 },
    test_pass_rate: { threshold: 1.0 },
    critical_bugs: { threshold: 0 }
  },
  balance: {
    ai_win_rate_deviation: { threshold: 0.15 },
    strategy_viability: { threshold: 3 }
  },
  experience: {
    avg_response_time_p95: { threshold: 200 },
    crash_rate: { threshold: 0.001 }
  },
  technical: {
    uptime: { threshold: 0.999 },
    code_coverage: { threshold: 0.70 },
    critical_vulnerabilities: { threshold: 0 }
  }
};
```

### 7.3 Post-Release 运营监控

```typescript
const POST_RELEASE_MONITORS = {
  retention: {
    d1_retention: { target: 0.4 },
    d7_retention: { target: 0.2 }
  },
  satisfaction: {
    nps: { target: 50 },
    app_store_rating: { target: 4.5 }
  },
  ecosystem: {
    avg_games_per_user: { target: 5 },
    ai_vs_human_win_rate: { target: 0.4 }
  }
};
```

*Quality Metrics v1.1*
