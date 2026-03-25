---
name: balance-calculator
description: "游戏平衡性计算技能 — 评估游戏机制和数值的平衡性。Use when: 需要分析游戏平衡性、调整AI难度、优化资源产出/消耗、检测必胜策略。NOT for: 非游戏平衡性分析。"
metadata:
  {
    "openclaw": { "emoji": "⚖️", "requires": {} }
  }
---

# Skill: balance-calculator

> 游戏平衡性计算技能 — 评估游戏机制和数值的平衡性

## 触发条件

- 游戏机制设计完成后
- AI 对手难度调整时
- 发现游戏存在"必胜策略"时
- 需要优化资源产出/消耗时

## 平衡性维度

### 1. 资源平衡

```typescript
interface ResourceBalance {
  // 资源产出率
  productionRate: {
    [resource: string]: {
      averagePerTurn: number;
      variance: number;
      distribution: 'normal' | 'uniform' | 'skewed';
    };
  };
  
  // 资源价值（相对值，假设 wood = 1.0）
  relativeValue: {
    [resource: string]: number;
  };
  
  // 稀有度
  scarcity: 'common' | 'uncommon' | 'rare';
}
```

### 2. 策略平衡

```typescript
interface StrategyBalance {
  strategies: Strategy[];
  
  // 胜率分析
  winRates: {
    [strategy: string]: {
      vsRandom: number;      // vs 随机玩家
      vsAggressive: number;  // vs 激进策略
      vsEconomic: number;    // vs 经济策略
      overall: number;       // 综合胜率
    };
  };
  
  // 相关性（策略是否过于相似）
  correlation: {
    [strategy1: string]: {
      [strategy2: string]: number; // 0-1
    };
  };
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  winRate: number;
  pickRate: number; // 玩家选择比例
  avgGameLength: number; // 使用该策略的平均游戏时长
}
```

### 3. 时间平衡

```typescript
interface TimeBalance {
  expectedGameLength: {
    min: number;
    max: number;
    average: number;
    median: number;
  };
  
  // 各阶段时长占比
  phaseDistribution: {
    [phase: string]: {
      percentageOfGame: number;
      variance: number;
    };
  };
  
  // 先手优势
  firstPlayerAdvantage: {
    winRateBonus: number; // 百分比
    significance: 'high' | 'medium' | 'low';
  };
}
```

## 计算方法

### 胜率模拟

```python
# 蒙特卡洛模拟计算胜率
def simulate_win_rates(game, n_simulations=10000):
    results = {strategy: [] for strategy in strategies}
    
    for _ in range(n_simulations):
        for strategy in strategies:
            game_state = game.clone()
            outcome = play_with_strategy(game_state, strategy)
            results[strategy].append(outcome)
    
    return {
        strategy: sum(wins) / len(wins) 
        for strategy, wins in results.items()
    }
```

### 纳什均衡检测

```python
def check_dominant_strategies(payoff_matrix):
    """
    检测是否存在优势策略
    如果没有优势策略，游戏更平衡
    """
    n_strategies = len(payoff_matrix)
    dominant = []
    
    for i in range(n_strategies):
        is_dominant = True
        for j in range(n_strategies):
            if i != j and payoff_matrix[i][j] < payoff_matrix[j][j]:
                is_dominant = False
                break
        if is_dominant:
            dominant.append(i)
    
    return dominant  # 空列表 = 无优势策略 = 好平衡
```

### 敏感性分析

```python
def sensitivity_analysis(game, parameter, range_values):
    """
    测试某个参数变化对游戏平衡的影响
    平衡的参数应该对结果影响较小
    """
    results = []
    for value in range_values:
        game.set_parameter(parameter, value)
        win_rates = simulate_win_rates(game)
        results.append({
            'value': value,
            'win_rate_std': statistics.stdev(win_rates.values()),
            'first_player_advantage': win_rates['first_player'] - 0.5
        })
    return results
```

## 平衡标准

| 指标 | 可接受范围 | 需要优化 | 严重问题 |
|------|-----------|---------|---------|
| 策略胜率标准差 | < 5% | 5-10% | > 10% |
| 先手优势 | < 5% | 5-10% | > 10% |
| 资源价值偏差 | < 20% | 20-50% | > 50% |
| 游戏时长变异系数 | < 0.3 | 0.3-0.5 | > 0.5 |
| 必胜策略 | 无 | - | 存在 |

## 输出报告

```markdown
## 平衡性分析报告

### 总体评估
- 综合得分：X/100
- 状态：[平衡 | 需要调整 | 严重不平衡]

### 资源平衡
- [资源价值表]
- [发现问题及建议]

### 策略平衡
- [策略胜率图]
- [优势策略检测]
- [策略多样性评分]

### 时间平衡
- [预期游戏时长]
- [先手优势分析]

### 风险点
1. [风险1]
2. [风险2]

### 优化建议
1. [建议1]
2. [建议2]
```

## 迭代流程

```
初始设计
    ↓
平衡性模拟 ──→ 发现问题
    ↓                  ↓
调整参数  ←──────┘
    ↓
再次模拟
    ↓
达标？ ──→ 是 → 输出最终设计
    ↓否
继续调整
```

---

*Skill: balance-calculator v1.0*
