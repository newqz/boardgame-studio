---
name: test-case-generator
description: "测试用例生成技能 — 为桌游电子化项目生成全面的测试用例。Use when: 需要生成测试用例、补充回归测试、验证游戏逻辑。NOT for: 非桌游测试。"
metadata:
  {
    "openclaw": { "emoji": "🧪", "requires": {} }
  }
---

# Skill: test-case-generator

> 测试用例生成技能 — 为桌游电子化项目生成全面的测试用例

## 触发条件

- 规则分析完成后
- 游戏逻辑实现后
- 需要补充回归测试时
- 发现 bug 需要添加测试用例时

## 测试用例类型

### 1. 单元测试 (Unit Tests)

针对最小可测试单元：

```typescript
describe('ResourceManager', () => {
  describe('addResource', () => {
    it('should add resources correctly', () => {
      const manager = new ResourceManager();
      manager.addResource('player1', ResourceType.WOOD, 5);
      expect(manager.getResource('player1', ResourceType.WOOD)).toBe(5);
    });
    
    it('should accumulate resources', () => {
      const manager = new ResourceManager();
      manager.addResource('player1', ResourceType.WOOD, 5);
      manager.addResource('player1', ResourceType.WOOD, 3);
      expect(manager.getResource('player1', ResourceType.WOOD)).toBe(8);
    });
    
    it('should handle multiple resource types', () => {
      const manager = new ResourceManager();
      manager.addResource('player1', ResourceType.WOOD, 2);
      manager.addResource('player1', ResourceType.BRICK, 3);
      expect(manager.getTotalResources('player1')).toBe(5);
    });
  });
  
  describe('removeResource', () => {
    it('should throw on insufficient resources', () => {
      const manager = new ResourceManager();
      expect(() => manager.removeResource('player1', ResourceType.WOOD, 5))
        .toThrow(InsufficientResourcesError);
    });
  });
});
```

### 2. 边界测试 (Boundary Tests)

```typescript
describe('Boundary Conditions', () => {
  describe('Resource Limits', () => {
    it('should handle 0 resources', () => {
      const player = new Player();
      expect(player.getResource(ResourceType.WOOD)).toBe(0);
    });
    
    it('should handle maximum resources', () => {
      const player = new Player();
      player.addResource(ResourceType.WOOD, MAX_RESOURCES);
      expect(player.getResource(ResourceType.WOOD)).toBe(MAX_RESOURCES);
    });
    
    it('should reject exceeding maximum', () => {
      const player = new Player();
      expect(() => player.addResource(ResourceType.WOOD, MAX_RESOURCES + 1))
        .toThrow(ResourceOverflowError);
    });
  });
  
  describe('Turn Limits', () => {
    it('should handle first turn', () => {
      const game = new Game({ playerCount: 4 });
      expect(game.getCurrentTurn()).toBe(1);
    });
    
    it('should handle maximum turns (timeout)', () => {
      const game = new Game({ playerCount: 4, maxTurns: 1000 });
      // Simulate 1000 turns
      for (let i = 0; i < 999; i++) game.nextTurn();
      expect(game.isGameOver()).toBe(true);
    });
  });
});
```

### 3. 集成测试 (Integration Tests)

```typescript
describe('Game Flow Integration', () => {
  it('should complete full game from start to finish', async () => {
    const game = await Game.create({
      players: ['Alice', 'Bob', 'Carol', 'Dave'],
      type: 'catan'
    });
    
    // Setup phase
    await game.setup();
    expect(game.getPhase()).toBe(GamePhase.SETUP);
    
    // Play until someone wins
    while (!game.isGameOver()) {
      const actions = game.getValidActions();
      const action = await game.chooseBestAction(actions);
      await game.executeAction(action);
    }
    
    // Verify winner
    const winner = game.getWinner();
    expect(winner).toBeDefined();
    expect(winner.victoryPoints).toBeGreaterThanOrEqual(10);
  });
  
  it('should handle 4 players completing trades', async () => {
    const game = await Game.create({ players: 4 });
    
    // Set up trade
    const trade = {
      from: 'player1',
      to: 'player2',
      offer: { wood: 1 },
      request: { brick: 1 }
    };
    
    const result = await game.executeTrade(trade);
    expect(result.success).toBe(true);
    expect(game.getResource('player1', 'wood')).toBeLessThan(initial.wood);
    expect(game.getResource('player2', 'brick')).toBeLessThan(initial.brick);
  });
});
```

### 4. 随机性测试 (Stochastic Tests)

```typescript
describe('Randomness', () => {
  describe('Dice Distribution', () => {
    it('should produce uniform distribution over many rolls', () => {
      const dice = new DiceRoller();
      const rolls = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };
      const n = 60000; // Large sample
      
      for (let i = 0; i < n; i++) {
        const result = dice.roll2D6();
        rolls[result]++;
      }
      
      // Expected: each number appears ~1/36 of the time
      // Allow 5% deviation
      for (const [sum, count] of Object.entries(rolls)) {
        const expected = n / 36;
        const deviation = Math.abs(count - expected) / expected;
        expect(deviation).toBeLessThan(0.05);
      }
    });
  });
});
```

### 5. 性能测试 (Performance Tests)

```typescript
describe('Performance', () => {
  it('should handle 1000 concurrent games', async () => {
    const games = await Promise.all(
      Array(1000).map(() => Game.create({ players: 4 }))
    );
    
    // All games should initialize in < 10 seconds
    const start = Date.now();
    await Promise.all(games.map(g => g.initialize()));
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(10000);
  });
  
  it('should execute 100 game actions per second', async () => {
    const game = await Game.create({ players: 4 });
    
    const start = Date.now();
    let actions = 0;
    
    while (Date.now() - start < 1000) {
      const validActions = game.getValidActions();
      await game.executeAction(validActions[0]);
      actions++;
    }
    
    expect(actions).toBeGreaterThan(100);
  });
});
```

## 测试用例生成模板

```markdown
## 测试用例：[功能名称]

### 用例编号
TC-[模块]-[序号]

### 测试目标
[简述测试目的]

### 前置条件
- [条件1]
- [条件2]

### 测试步骤
1. [步骤1]
2. [步骤2]
3. [步骤3]

### 预期结果
[期望的结果]

### 实际结果
（测试后填写）

### 状态
- [ ] 未执行
- [ ] 通过
- [ ] 失败
- [ ] 阻塞

### 优先级
- P0：核心功能
- P1：重要功能
- P2：一般功能
- P3：边缘功能
```

## 覆盖率目标

| 模块 | 覆盖率目标 |
|------|-----------|
| 游戏引擎 | 95%+ |
| 规则验证 | 100% |
| UI组件 | 80%+ |
| 网络同步 | 90%+ |
| AI决策 | 85%+ |

## 测试数据生成

```typescript
class TestDataGenerator {
  // 生成随机但有效的游戏状态
  generateRandomGameState(complexity: 'simple' | 'medium' | 'full'): GameState;
  
  // 生成边界条件测试数据
  generateBoundaryCases(): BoundaryCase[];
  
  // 生成玩家组合
  generatePlayerCombinations(count: number): PlayerCombination[];
}
```

---

*Skill: test-case-generator v1.0*
