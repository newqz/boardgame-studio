---
name: ai-difficulty-tuner
description: "AI 难度动态调优技能 — 调整 AI 对手难度以匹配玩家水平。Use when: 需要动态调整AI难度、匹配玩家水平、分析玩家表现。NOT for: 非AI难度调整。"
metadata:
  {
    "openclaw": { "emoji": "🎯", "requires": {} }
  }
---

# Skill: ai-difficulty-tuner

> AI 难度动态调优技能 — 调整 AI 对手难度以匹配玩家水平

## 触发条件

- 玩家连续失败或获胜时
- 玩家反馈 AI 太难/太简单时
- 新玩家首次游戏时
- 需要动态调整游戏难度时

## 核心概念

### 难度等级定义

```typescript
enum DifficultyLevel {
  TUTORIAL = 0,    // 新手教程，AI 故意犯错
  EASY = 1,        // 简单，AI 有明显弱点
  MEDIUM = 2,      // 中等，AI 有攻有守
  HARD = 3,        // 困难，AI 策略性强
  EXPERT = 4,      // 专家，几乎无失误
  UNBEATABLE = 5   // 不可战胜，超越人类极限
}

interface DifficultyConfig {
  level: DifficultyLevel;
  
  // AI 思考时间 (ms)
  thinkTime: {
    min: number;
    max: number;
    average: number;
  };
  
  // 决策参数
  decisionParams: {
    // 探索概率 (epsilon-greedy)
    explorationRate: number;
    
    // 随机行动概率
    randomActionRate: number;
    
    // 错误决策概率 (故意犯错)
    mistakeRate: number;
    
    // 看到威胁的概率 (漏看)
    blindSpotRate: number;
  };
  
  // 能力上限
  capabilities: {
    maxLookAhead: number;      // 最大前瞻步数
    memoryDepth: number;        // 记忆深度
    patternRecognition: boolean; // 模式识别
    adaptToPlayer: boolean;     // 适应玩家风格
  };
}
```

### 难度参数表

```typescript
const DIFFICULTY_PRESETS: Record<DifficultyLevel, DifficultyConfig> = {
  [DifficultyLevel.TUTORIAL]: {
    level: DifficultyLevel.TUTORIAL,
    thinkTime: { min: 500, max: 2000, average: 1000 },
    decisionParams: {
      explorationRate: 0.5,
      randomActionRate: 0.4,
      mistakeRate: 0.3,
      blindSpotRate: 0.5
    },
    capabilities: {
      maxLookAhead: 1,
      memoryDepth: 0,
      patternRecognition: false,
      adaptToPlayer: false
    }
  },
  
  [DifficultyLevel.EASY]: {
    level: DifficultyLevel.EASY,
    thinkTime: { min: 1000, max: 3000, average: 2000 },
    decisionParams: {
      explorationRate: 0.3,
      randomActionRate: 0.2,
      mistakeRate: 0.15,
      blindSpotRate: 0.3
    },
    capabilities: {
      maxLookAhead: 2,
      memoryDepth: 1,
      patternRecognition: false,
      adaptToPlayer: false
    }
  },
  
  [DifficultyLevel.MEDIUM]: {
    level: DifficultyLevel.MEDIUM,
    thinkTime: { min: 2000, max: 5000, average: 3000 },
    decisionParams: {
      explorationRate: 0.15,
      randomActionRate: 0.05,
      mistakeRate: 0.03,
      blindSpotRate: 0.1
    },
    capabilities: {
      maxLookAhead: 3,
      memoryDepth: 3,
      patternRecognition: true,
      adaptToPlayer: false
    }
  },
  
  [DifficultyLevel.HARD]: {
    level: DifficultyLevel.HARD,
    thinkTime: { min: 3000, max: 8000, average: 5000 },
    decisionParams: {
      explorationRate: 0.05,
      randomActionRate: 0.01,
      mistakeRate: 0.005,
      blindSpotRate: 0.02
    },
    capabilities: {
      maxLookAhead: 5,
      memoryDepth: 5,
      patternRecognition: true,
      adaptToPlayer: true
    }
  },
  
  [DifficultyLevel.EXPERT]: {
    level: DifficultyLevel.EXPERT,
    thinkTime: { min: 5000, max: 15000, average: 10000 },
    decisionParams: {
      explorationRate: 0.01,
      randomActionRate: 0,
      mistakeRate: 0,
      blindSpotRate: 0
    },
    capabilities: {
      maxLookAhead: 8,
      memoryDepth: 10,
      patternRecognition: true,
      adaptToPlayer: true
    }
  },
  
  [DifficultyLevel.UNBEATABLE]: {
    level: DifficultyLevel.UNBEATABLE,
    thinkTime: { min: 10000, max: 60000, average: 30000 },
    decisionParams: {
      explorationRate: 0,
      randomActionRate: 0,
      mistakeRate: 0,
      blindSpotRate: 0
    },
    capabilities: {
      maxLookAhead: 999,  // 几乎完整搜索
      memoryDepth: 999,
      patternRecognition: true,
      adaptToPlayer: true
    }
  }
};
```

## 动态调优算法

### Elo 评分系统

```typescript
class PlayerEloTracker {
  private readonly K_FACTOR = 32;  // 新手快速调整
  private readonly INITIAL_RATING = 1200;
  
  // 计算期望胜率
  expectedScore(playerRating: number, opponentRating: number): number {
    return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  }
  
  // 更新评分
  updateRating(
    playerRating: number,
    opponentRating: number,
    actualScore: number  // 1=胜, 0.5=平, 0=负
  ): number {
    const expected = this.expectedScore(playerRating, opponentRating);
    const newRating = playerRating + this.K_FACTOR * (actualScore - expected);
    return Math.round(newRating);
  }
  
  // 获取对应难度
  ratingToDifficulty(rating: number): DifficultyLevel {
    if (rating < 1000) return DifficultyLevel.TUTORIAL;
    if (rating < 1100) return DifficultyLevel.EASY;
    if (rating < 1300) return DifficultyLevel.MEDIUM;
    if (rating < 1500) return DifficultyLevel.HARD;
    if (rating < 1700) return DifficultyLevel.EXPERT;
    return DifficultyLevel.UNBEATABLE;
  }
}
```

### 自适应难度调整

```typescript
class AdaptiveDifficultyTuner {
  private playerModel: PlayerModel;
  private adjustmentHistory: Adjustment[] = [];
  
  // 分析玩家表现
  analyzePerformance(recentGames: GameResult[]): PerformanceMetrics {
    const winRate = this.calculateWinRate(recentGames);
    const avgTurnQuality = this.calculateAvgTurnQuality(recentGames);
    const mistakesPerGame = this.calculateMistakes(recentGames);
    
    return {
      winRate,
      avgTurnQuality,
      mistakesPerGame,
      trend: this.calculateTrend(recentGames)
    };
  }
  
  // 决定是否调整难度
  shouldAdjustDifficulty(metrics: PerformanceMetrics): AdjustmentDecision {
    const { winRate, trend } = metrics;
    
    // 连续失败 → 降低难度
    if (winRate < 0.2 && trend === 'declining') {
      return { adjust: true, direction: 'down', magnitude: 1 };
    }
    
    // 连续胜利 → 提高难度
    if (winRate > 0.8 && trend === 'improving') {
      return { adjust: true, direction: 'up', magnitude: 1 };
    }
    
    // 稳定表现 → 小幅微调
    if (winRate > 0.4 && winRate < 0.6) {
      return { adjust: true, direction: 'none', magnitude: 0 };
    }
    
    return { adjust: false };
  }
  
  // 计算最优难度
  calculateOptimalDifficulty(playerRating: number, targetWinRate: number): DifficultyLevel {
    // 目标胜率 40-60% = 难度匹配
    // 目标胜率 30-40% = 略高难度
    // 目标胜率 60-70% = 略低难度
    
    const targetEloDiff = this.winRateToEloDiff(targetWinRate);
    const optimalRating = playerRating + targetEloDiff;
    
    return this.ratingToDifficulty(optimalRating);
  }
}
```

### 玩家风格识别

```typescript
interface PlayerStyle {
  aggressiveness: number;      // 0-1, 激进程度
  riskTolerance: number;       // 0-1, 风险承受
  strategicDepth: number;       // 0-1, 策略深度
  adaptationSpeed: number;       // 0-1, 学习速度
  preferredStrategies: string[];  // 常使用的策略
}

class PlayerStyleAnalyzer {
  analyze(gameHistory: GameResult[]): PlayerStyle {
    return {
      aggressiveness: this.calculateAggressiveness(gameHistory),
      riskTolerance: this.calculateRiskTolerance(gameHistory),
      strategicDepth: this.calculateStrategicDepth(gameHistory),
      adaptationSpeed: this.calculateAdaptationSpeed(gameHistory),
      preferredStrategies: this.extractStrategies(gameHistory)
    };
  }
  
  // AI 根据玩家风格调整策略
  adaptAItoPlayer(style: PlayerStyle, baseDifficulty: DifficultyConfig): DifficultyConfig {
    const adapted = { ...baseDifficulty };
    
    // 对激进玩家，AI 更保守
    if (style.aggressiveness > 0.7) {
      adapted.decisionParams.mistakeRate *= 1.5; // AI 多犯错
      adapted.capabilities.maxLookAhead = Math.max(1, adapted.capabilities.maxLookAhead - 1);
    }
    
    // 对谨慎玩家，AI 可以更强
    if (style.riskTolerance < 0.3) {
      adapted.decisionParams.mistakeRate *= 0.5;
    }
    
    return adapted;
  }
}
```

## 难度平滑过渡

```typescript
class DifficultyTransition {
  // 避免难度突变（让玩家察觉不到AI在"放水"）
  smoothTransition(
    currentLevel: DifficultyLevel,
    targetLevel: DifficultyLevel,
    transitionSpeed: number = 0.1  // 每次调整幅度
  ): DifficultyLevel {
    const diff = targetLevel - currentLevel;
    
    if (Math.abs(diff) <= 1) {
      return targetLevel; // 小变化，直接跳
    }
    
    // 大变化需要渐进过渡
    if (diff > 1) {
      return currentLevel + Math.ceil(diff * transitionSpeed);
    } else {
      return currentLevel - Math.ceil(Math.abs(diff) * transitionSpeed);
    }
  }
  
  // 隐藏调整 (让AI"看起来"自然)
  hideAdjustment(
    decision: AIDecision,
    playerWouldNotice: boolean
  ): AIDecision {
    if (!playerWouldNotice) {
      return decision; // 不容易被注意到的调整，直接用
    }
    
    // 选择一个玩家能接受的次优决策
    return this.findPlausibleSuboptimalMove(decision);
  }
}
```

## 使用示例

```typescript
// 游戏初始化
const tuner = new AdaptiveDifficultyTuner();
const playerRating = await tuner.getPlayerRating(playerId);

// 设置初始难度
const difficulty = tuner.calculateOptimalDifficulty(playerRating, 0.5); // 目标50%胜率
game.setAIDifficulty(difficulty);

// 游戏过程中监控
game.on('turnComplete', (turn) => {
  tuner.recordTurn({
    playerId,
    turnQuality: evaluateTurnQuality(turn),
    mistakes: detectMistakes(turn),
    strategy: identifyStrategy(turn)
  });
});

// 游戏结束
game.on('gameOver', async (result) => {
  await tuner.recordResult({
    playerId,
    won: result.winner === playerId,
    eloChange: result.eloChange
  });
  
  // 评估是否需要调整
  const shouldAdjust = tuner.shouldAdjustDifficulty(
    tuner.analyzePerformance(await tuner.getRecentGames(playerId, 10))
  );
  
  if (shouldAdjust.adjust) {
    const newDifficulty = tuner.smoothTransition(
      game.currentDifficulty,
      shouldAdjust.direction === 'up' 
        ? game.currentDifficulty + 1 
        : game.currentDifficulty - 1
    );
    game.setAIDifficulty(newDifficulty);
  }
});
```

## 测试要点

```typescript
describe('AdaptiveDifficultyTuner', () => {
  it('should increase difficulty after winning streak', () => {
    const tuner = new AdaptiveDifficultyTuner();
    
    // 模拟玩家连胜
    const results = Array(5).fill({ won: true });
    tuner.updateRatingBatch(results);
    
    const difficulty = tuner.calculateOptimalDifficulty(
      tuner.getPlayerRating(playerId), 
      0.5
    );
    
    expect(difficulty).toBeGreaterThanOrEqual(DifficultyLevel.MEDIUM);
  });
  
  it('should decrease difficulty after losing streak', () => {
    const tuner = new AdaptiveDifficultyTuner();
    
    // 模拟玩家连败
    const results = Array(5).fill({ won: false });
    tuner.updateRatingBatch(results);
    
    const difficulty = tuner.calculateOptimalDifficulty(
      tuner.getPlayerRating(playerId), 
      0.5
    );
    
    expect(difficulty).toBeLessThanOrEqual(DifficultyLevel.MEDIUM);
  });
  
  it('should smoothly transition difficulty', () => {
    const transition = new DifficultyTransition();
    
    const smooth = transition.smoothTransition(
      DifficultyLevel.EASY,
      DifficultyLevel.HARD,
      0.5
    );
    
    expect(smooth).toBe(DifficultyLevel.MEDIUM); // 渐进过渡
  });
});
```

---

*Skill: ai-difficulty-tuner v1.0*
