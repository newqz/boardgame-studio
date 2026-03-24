# Skill: game-state-manager

> 游戏状态管理技能 — 序列化和恢复游戏状态

## 触发条件

- 需要保存/加载游戏进度时
- 实现游戏回放功能时
- 处理断线重连时
- 需要在客户端与服务端同步状态时

## 核心接口

```typescript
interface GameStateManager<State extends BaseGameState> {
  // 序列化状态
  serialize(state: State): SerializedState;
  
  // 反序列化
  deserialize(data: SerializedState): State;
  
  // 创建快照
  createSnapshot(state: State, label?: string): Snapshot;
  
  // 恢复快照
  restoreSnapshot(snapshot: Snapshot): State;
  
  // 状态验证
  validate(state: State): ValidationResult;
  
  // 差异计算
  diff(stateA: State, stateB: State): Delta;
  
  // 应用差异
  applyDelta(state: State, delta: Delta): State;
}
```

## 序列化实现

```typescript
class GameStateSerializer {
  // 完整序列化
  serialize(state: GameState): SerializedState {
    return {
      version: this.currentVersion,
      timestamp: Date.now(),
      checksum: this.calculateChecksum(state),
      data: this.encode(state)
    };
  }
  
  // 高效编码（示例：JSON + 压缩）
  private encode(state: GameState): string {
    const json = JSON.stringify(state, this.replacer);
    return pako.deflate(json); // gzip 压缩
  }
  
  // 版本迁移（处理旧版本存档）
  migrate(data: SerializedState): SerializedState {
    if (data.version === this.currentVersion) {
      return data;
    }
    
    // 按版本逐步升级
    let current = data;
    for (const migrator of this.migrators) {
      if (this.needsMigration(current, migrator.fromVersion)) {
        current = migrator.upgrade(current);
      }
    }
    
    return current;
  }
  
  // 校验和验证
  validate(data: SerializedState): boolean {
    const computed = this.calculateChecksum(data.data);
    return computed === data.checksum;
  }
}
```

## 快照管理

```typescript
class SnapshotManager {
  private snapshots: Map<string, Snapshot> = new Map();
  
  createSnapshot(state: GameState, label?: string): Snapshot {
    const snapshot: Snapshot = {
      id: generateUUID(),
      label: label || `Snapshot ${Date.now()}`,
      timestamp: Date.now(),
      state: this.serialize(state),
      size: this.estimateSize(state),
      parentId: this.currentSnapshotId
    };
    
    this.snapshots.set(snapshot.id, snapshot);
    this.currentSnapshotId = snapshot.id;
    
    // 自动清理（保留最近 N 个）
    this.cleanupOldSnapshots();
    
    return snapshot;
  }
  
  restoreSnapshot(snapshotId: string): GameState {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    
    return this.deserialize(snapshot.state);
  }
  
  // 获取状态历史（用于回放）
  getStateHistory(fromSnapshot: string, toSnapshot: string): GameState[] {
    const states: GameState[] = [];
    let currentId = fromSnapshot;
    
    while (currentId !== toSnapshot) {
      const snapshot = this.snapshots.get(currentId);
      states.push(this.deserialize(snapshot.state));
      currentId = snapshot.parentId;
      if (!currentId) break;
    }
    
    return states;
  }
}
```

## 差异同步 (Delta Sync)

```typescript
class DeltaSync {
  // 计算两个状态的差异
  diff(stateA: GameState, stateB: GameState): Delta {
    const changes: Change[] = [];
    
    // 比较玩家资源
    for (const [playerId, resources] of Object.entries(stateB.players)) {
      const prevResources = stateA.players[playerId]?.resources;
      if (!equals(resources, prevResources)) {
        changes.push({
          type: 'resource_change',
          path: `players.${playerId}.resources`,
          oldValue: prevResources,
          newValue: resources
        });
      }
    }
    
    // 比较棋盘状态
    if (!equals(stateA.board, stateB.board)) {
      changes.push({
        type: 'board_change',
        path: 'board',
        oldValue: stateA.board,
        newValue: stateB.board
      });
    }
    
    return {
      id: generateUUID(),
      timestamp: Date.now(),
      changes
    };
  }
  
  // 应用差异到状态
  applyDelta(baseState: GameState, delta: Delta): GameState {
    const newState = this.clone(baseState);
    
    for (const change of delta.changes) {
      this.applyChange(newState, change);
    }
    
    return newState;
  }
}
```

## 状态验证

```typescript
class StateValidator {
  validate(state: GameState): ValidationResult {
    const errors: ValidationError[] = [];
    
    // 1. 资源守恒检查
    const totalResources = this.sumResources(state);
    const expectedTotal = this.calculateExpectedResources(state);
    if (totalResources !== expectedTotal) {
      errors.push({
        type: 'resource_imbalance',
        message: `资源不守恒: 总计${totalResources}, 期望${expectedTotal}`,
        severity: 'critical'
      });
    }
    
    // 2. 合法性检查
    for (const [playerId, player] of Object.entries(state.players)) {
      if (player.resources.wood < 0 || player.resources.brick < 0) {
        errors.push({
          type: 'negative_resources',
          message: `玩家 ${playerId} 资源为负`,
          severity: 'critical'
        });
      }
    }
    
    // 3. 回合一致性
    if (state.turnNumber < 0) {
      errors.push({
        type: 'invalid_turn',
        message: '回合数无效',
        severity: 'critical'
      });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

## 断线重连

```typescript
class ReconnectionManager {
  async handleReconnect(playerId: string, connection: WebSocket): Promise<ReconnectData> {
    const gameId = this.getPlayerGame(playerId);
    const game = this.games.get(gameId);
    
    // 获取最新状态
    const latestSnapshot = this.snapshotManager.getLatest(gameId);
    
    // 获取玩家错过的操作
    const missedActions = this.actionLog.getActionsSince(
      playerId,
      latestSnapshot.timestamp
    );
    
    return {
      currentState: latestSnapshot.state,
      missedActions,
      pendingTimeouts: game.getActiveTimeouts(playerId)
    };
  }
  
  // 客户端状态校正
  reconcile(clientState: GameState, serverState: GameState): ReconcileResult {
    // 如果客户端状态较旧，应用缺失的操作
    if (clientState.turnNumber < serverState.turnNumber) {
      return {
        action: 'rewind_and_replay',
        serverState,
        missedActions: this.getMissedActions(clientState, serverState)
      };
    }
    
    // 如果状态一致，轻微调整
    if (this.statesEqual(clientState, serverState)) {
      return { action: 'confirmed' };
    }
    
    // 状态分歧，需要完全同步
    return {
      action: 'full_sync',
      serverState
    };
  }
}
```

## 回放系统

```typescript
class ReplaySystem {
  generateReplay(gameId: string): Replay {
    const snapshots = this.snapshotManager.getAll(gameId);
    const actions = this.actionLog.getAll(gameId);
    
    return {
      id: generateUUID(),
      gameId,
      duration: snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp,
      initialState: this.deserialize(snapshots[0].state),
      finalState: this.deserialize(snapshots[snapshots.length - 1].state),
      snapshots: snapshots.map(s => ({
        timestamp: s.timestamp,
        state: s.state
      })),
      actions: actions.map(a => ({
        playerId: a.playerId,
        actionType: a.type,
        timestamp: a.timestamp,
        data: a.data
      }))
    };
  }
  
  // 导出为视频
  async exportAsVideo(replay: Replay, options: ExportOptions): Promise<Buffer> {
    // 使用 canvas 逐帧渲染
    const frames: Buffer[] = [];
    
    for (const snapshot of replay.snapshots) {
      const canvas = this.renderFrame(snapshot.state);
      frames.push(await canvas.toBuffer());
    }
    
    return this.encodeVideo(frames, options);
  }
}
```

## 测试要点

```typescript
describe('GameStateManager', () => {
  it('should serialize and deserialize correctly', () => {
    const original = createTestGameState();
    const serialized = stateManager.serialize(original);
    const restored = stateManager.deserialize(serialized);
    
    expect(restored).toEqual(original);
  });
  
  it('should detect state corruption', () => {
    const state = createTestGameState();
    const serialized = stateManager.serialize(state);
    
    // 篡改数据
    serialized.data += 'tampered';
    
    expect(() => stateManager.deserialize(serialized))
      .toThrow(/checksum mismatch/);
  });
  
  it('should handle version migration', () => {
    const oldState = { version: '0.9.0', data: { /* old format */ } };
    const migrated = stateManager.migrate(oldState);
    
    expect(migrated.version).toBe('1.0.0');
  });
  
  it('should create space-efficient deltas', () => {
    const state1 = createTestGameState();
    const state2 = modifySingleResource(state1, 'player1', 'wood', +1);
    
    const delta = deltaSync.diff(state1, state2);
    
    expect(delta.changes.length).toBe(1);
    expect(delta.changes[0].path).toContain('wood');
  });
});
```

---

*Skill: game-state-manager v1.0*
