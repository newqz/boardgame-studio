---
name: multiplayer-sync
description: "多人游戏同步技能 — 设计多人在线桌游的实时同步架构。Use when: 需要实现多人在线功能、解决同步问题、选择同步策略、实现观战/录像功能。NOT for: 单人游戏。"
metadata:
  {
    "openclaw": { "emoji": "👥", "requires": {} }
  }
---

# Skill: multiplayer-sync

> 多人游戏同步技能 — 设计多人在线桌游的实时同步架构

## 触发条件

- 需要实现多人在线功能时
- 遇到同步问题（延迟、掉线）
- 需要选择同步策略时
- 实现观战、录像功能时

## 同步策略选择

### 策略对比

| 策略 | 适用场景 | 延迟感知 | 复杂度 | 反作弊 |
|------|---------|---------|--------|--------|
| Lockstep | 回合制卡牌/策略 | 高（需等所有玩家） | 低 | 弱 |
| Client-Prediction | 动作类即时游戏 | 低 | 高 | 中 |
| Server-Authoritative | 竞技游戏 | 中 | 高 | 强 |
| Snapshot Interpolation | 实时策略 | 低 | 中 | 中 |

## 实现方案

### 1. Lockstep（回合制推荐）

```typescript
class LockstepSynchronizer {
  private currentTurn: number = 0;
  private pendingInputs: Map<number, PlayerInput[]> = new Map();
  private confirmedInputs: PlayerInput[] = [];
  
  // 玩家提交输入
  submitInput(playerId: string, input: GameInput): void {
    const turnInputs = this.pendingInputs.get(this.currentTurn) || [];
    turnInputs.push({
      playerId,
      input,
      timestamp: Date.now()
    });
    this.pendingInputs.set(this.currentTurn, turnInputs);
    
    // 广播确认
    this.broadcast('input_received', { playerId, turn: this.currentTurn });
    
    // 所有玩家都提交后，执行回合
    if (turnInputs.length === this.playerCount) {
      this.executeTurn(this.currentTurn);
      this.currentTurn++;
    }
  }
  
  // 等待超时处理
  handleTimeout(playerId: string): void {
    // 超时玩家使用默认动作或随机动作
    const defaultInput = this.getDefaultInput(playerId);
    this.submitInput(playerId, defaultInput);
  }
  
  // 执行回合（确定性）
  private executeTurn(turn: number): void {
    const inputs = this.pendingInputs.get(turn) || [];
    // 按固定顺序执行（消除顺序依赖）
    inputs.sort((a, b) => a.playerId.localeCompare(b.playerId));
    
    for (const { input } of inputs) {
      this.gameState = this.applyInput(this.gameState, input);
    }
    
    // 广播新状态
    this.broadcast('turn_executed', {
      turn,
      state: this.gameState,
      inputs: inputs.map(i => i.input)
    });
  }
}
```

### 2. 断线处理

```typescript
class DisconnectHandler {
  private readonly RECONNECT_WINDOW = 60000; // 60秒
  private pendingDisconnects: Map<string, NodeJS.Timeout>;
  
  onPlayerDisconnect(playerId: string): void {
    // 通知其他玩家
    this.broadcast('player_disconnected', { playerId });
    
    // 启动重连计时器
    const timeout = setTimeout(() => {
      this.handlePermanentDisconnect(playerId);
    }, this.RECONNECT_WINDOW);
    
    this.pendingDisconnects.set(playerId, timeout);
  }
  
  onPlayerReconnect(playerId: string, connection: WebSocket): void {
    // 清除计时器
    const timeout = this.pendingDisconnects.get(playerId);
    if (timeout) {
      clearTimeout(timeout);
      this.pendingDisconnects.delete(playerId);
    }
    
    // 发送当前状态
    connection.send(JSON.stringify({
      type: 'sync_state',
      state: this.gameState,
      pendingActions: this.getPendingActions(playerId)
    }));
  }
  
  private handlePermanentDisconnect(playerId: string): void {
    // 替换为 AI 或结束游戏
    const room = this.roomManager.getRoom(this.gameId);
    
    if (room.canContinueWithAI()) {
      this.replaceWithAI(playerId);
      this.broadcast('player_replaced_with_ai', { playerId });
    } else {
      this.endGame(GameEndReason.PLAYER_LEFT);
    }
  }
}
```

### 3. 状态同步

```typescript
class StateSynchronizer {
  // 完整状态同步（初始连接、游戏恢复）
  sendFullState(connection: WebSocket): void {
    connection.send(JSON.stringify({
      type: 'full_state',
      state: this.compressState(this.gameState),
      history: this.getRecentHistory(10),
      timestamp: Date.now()
    }));
  }
  
  // 增量同步（游戏中）
  sendDelta(connection: WebSocket, lastAckedTurn: number): void {
    const deltas = this.getDeltasSince(lastAckedTurn);
    connection.send(JSON.stringify({
      type: 'delta',
      deltas,
      currentTurn: this.currentTurn
    }));
  }
  
  // 压缩状态（减少带宽）
  private compressState(state: GameState): CompressedState {
    return {
      // 只发送必要字段
      // 使用数字枚举替代字符串
      // 省略默认值的字段
    };
  }
}
```

### 4. 防作弊

```typescript
class AntiCheat {
  // 服务端验证所有输入
  validateInput(playerId: string, input: GameInput): ValidationResult {
    // 1. 验证时机
    if (!this.isPlayerTurn(playerId)) {
      return { valid: false, reason: 'not_your_turn' };
    }
    
    // 2. 验证资源
    if (!this.hasResources(playerId, input.requiredResources)) {
      return { valid: false, reason: 'insufficient_resources' };
    }
    
    // 3. 验证位置
    if (input.position && !this.isValidPosition(input.position)) {
      return { valid: false, reason: 'invalid_position' };
    }
    
    // 4. 验证随机数种子（如果使用确定性随机）
    if (input.randomSeed && !this.validateSeed(input.randomSeed)) {
      return { valid: false, reason: 'invalid_seed' };
    }
    
    return { valid: true };
  }
  
  // 检测异常模式
  detectAnomalies(playerId: string): AnomalyReport {
    return {
      actionsPerMinute: this.calculate APM(playerId),
      unusualPatterns: this.findPatterns(playerId),
      consistency: this.checkConsistency(playerId)
    };
  }
}
```

## 网络优化

### 消息压缩

```typescript
// 差分编码
const prevState = { wood: 5, brick: 3, sheep: 2, wheat: 1, ore: 0 };
const currState = { wood: 7, brick: 3, sheep: 2, wheat: 2, ore: 1 };

// 发送差分
const delta = {
  wood: +2,  // 变化量
  brick: 0,  // 无变化可省略或用特殊标记
  wheat: +1,
  ore: +1
};

// 二进制压缩示例
function compressState(state: GameState): Buffer {
  const buffer = Buffer.alloc(32);
  buffer.writeUInt8(state.wood, 0);
  buffer.writeUInt8(state.brick, 1);
  buffer.writeUInt8(state.sheep, 2);
  buffer.writeUInt8(state.wheat, 3);
  buffer.writeUInt8(state.ore, 4);
  // ... 其他字段
  return buffer;
}
```

### 消息优先级

```typescript
enum MessagePriority {
  CRITICAL = 0,   // 游戏结束、重连状态
  HIGH = 1,       // 玩家动作确认
  NORMAL = 2,     // 常规状态更新
  LOW = 3         // 聊天、表情
}

class MessageQueue {
  private queues: Map<Priority, Message[]> = new Map();
  
  enqueue(message: Message, priority: Priority): void {
    const queue = this.queues.get(priority) || [];
    queue.push(message);
    this.queues.set(priority, queue);
  }
  
  // 高优先级消息先发送
  flush(): void {
    for (const [priority, queue] of this.queues) {
      for (const message of queue) {
        this.send(message);
      }
      this.queues.set(priority, []);
    }
  }
}
```

## 观战系统

```typescript
class SpectatorSystem {
  private spectators: Map<string, WebSocket[]> = new Map();
  
  joinSpectator(gameId: string, connection: WebSocket): void {
    const game = this.games.get(gameId);
    
    // 发送完整状态
    this.sendFullState(connection);
    
    // 添加到观战列表
    const gameSpectators = this.spectators.get(gameId) || [];
    gameSpectators.push(connection);
    this.spectators.set(gameId, gameSpectators);
    
    // 广播观战人数
    this.broadcastGameState(gameId, {
      spectatorCount: gameSpectators.length
    });
  }
  
  // 延迟播放（让观战者看到完整回合）
  broadcastToSpectators(gameId: string, event: GameEvent): void {
    const spectators = this.spectators.get(gameId);
    if (!spectators) return;
    
    for (const spectator of spectators) {
      // 添加小延迟让游戏节奏更清晰
      setTimeout(() => {
        spectator.send(JSON.stringify(event));
      }, 500);
    }
  }
}
```

## 测试要点

```typescript
describe('Multiplayer Sync', () => {
  it('should sync state across all players', async () => {
    const game = await createMultiplayerGame(4);
    const states: GameState[] = [];
    
    // 监听所有状态更新
    for (const player of game.players) {
      player.on('state_update', (state) => states.push(state));
    }
    
    // 执行动作
    await game.executeAction({ type: 'roll_dice', player: 'player1' });
    
    // 等待同步
    await waitForSync();
    
    // 验证所有玩家收到相同状态
    const uniqueStates = new Set(states.map(s => JSON.stringify(s)));
    expect(uniqueStates.size).toBe(1);
  });
  
  it('should handle reconnection correctly', async () => {
    const game = await createMultiplayerGame(4);
    const player2 = game.players[1];
    
    // 模拟断线
    player2.disconnect();
    
    // 执行多个动作
    for (let i = 0; i < 5; i++) {
      await game.executeAction({ type: 'roll_dice' });
    }
    
    // 重连
    await player2.reconnect();
    
    // 验证状态同步
    expect(player2.getState()).toEqual(game.getState());
  });
});
```

---

*Skill: multiplayer-sync v1.0*
