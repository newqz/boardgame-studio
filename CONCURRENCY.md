# 并发模型 — P0 生产必选

> 定义多 Agent 环境下的线程/异步边界和一致性保证

---

## 一、为什么需要并发模型

**问题：** 多个 Agent、优先级队列、熔断器同时运行 → 没有并发模型 = 潜在竞态条件、死锁、状态不一致

**目标：** 明确什么可以并行、什么必须串行、一致性边界在哪里

---

## 二、并发架构

### 2.1 执行模型：半同步半异步

```
┌─────────────────────────────────────────────────────────────┐
│                        游戏回合周期                          │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │  Agent 执行   │ -> │  规则验证    │ -> │  状态更新    │ │
│  │  (可并行)     │    │  (串行)      │    │  (串行)      │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         ↑                                        │         │
│         └──────── 验证结果反馈 ──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 分层并发策略

| 层级 | 并发策略 | 一致性保证 | 说明 |
|------|---------|-----------|------|
| **Agent 间** | 消息队列（串行消费） | 最终一致 | 不同 Agent 处理不同游戏阶段 |
| **同 Agent 多请求** | 队列 + Worker Pool | 顺序保证 | 按 game_id 路由 |
| **规则验证** | 单一验证器（串行） | 强一致 | 唯一验证点 |
| **状态写入** | 单写者 + 事件广播 | 强一致 | 写成功后才广播 |
| **只读操作** | 多线程读取 | 读写分离 | 读取不需要锁 |

---

## 三、关键并发组件

### 3.1 验证队列（串行瓶颈）

```typescript
// 验证队列：所有移动必须串行通过验证
// 这消除了并发验证的复杂性

class ValidationQueue {
  private queue: AsyncQueue<ValidationRequest>;
  private worker: Worker;
  
  // 游戏级别的锁——同一游戏的所有验证串行执行
  private gameLocks: Map<string, Semaphore>;
  
  async validate(
    gameId: string,
    move: Move,
    state: GameState
  ): Promise<ValidationResult> {
    // 获取该游戏的锁（同一游戏串行）
    const lock = this.gameLocks.getOrCreate(gameId, new Semaphore(1));
    
    await lock.acquire();
    try {
      return await this.doValidate(move, state);
    } finally {
      lock.release();
    }
  }
  
  // 不同游戏可以并行验证（游戏间隔离）
  async validateMultiple(
    requests: Array<{ gameId: string; move: Move; state: GameState }>
  ): Promise<ValidationResult[]> {
    // 按 gameId 分组，并行处理不同游戏
    const byGame = groupBy(requests, r => r.gameId);
    const results = await Promise.all(
      Object.values(byGame).map(gameRequests =>
        // 同一游戏内串行
        this.serialize(gameRequests.map(r => () => this.validate(r.gameId, r.move, r.state)))
      )
    );
    return results.flat();
  }
}
```

### 3.2 状态写入模型（单写者）

```typescript
// 状态写入：单一写入者 + 事件广播
// 避免了多写者导致的状态冲突

class GameStateStore {
  private writer: singleThread;  // 唯一写线程
  
  async applyMove(gameId: string, move: Move, result: ValidationResult): Promise<void> {
    if (!result.valid) {
      throw new InvalidMoveError(result);
    }
    
    // 所有写入通过单一路径
    await this.writer.write({
      type: "APPLY_MOVE",
      gameId,
      move,
      timestamp: Date.now()
    });
    
    // 写入成功后广播事件（只读副本传播）
    this.eventBus.publish({
      type: "MOVE_APPLIED",
      gameId,
      move,
      newState: this.getSnapshot(gameId)  // 发布快照而非引用
    });
  }
  
  // 读取不需要锁——读取最新快照
  getSnapshot(gameId: string): GameStateSnapshot {
    return this.snapshots.get(gameId);
  }
}
```

### 3.3 Agent 请求路由

```typescript
// Agent 请求路由：按游戏 ID 哈希到固定 Worker
// 确保同一游戏的请求有序处理

class AgentRequestRouter {
  private workerPools: Map<string, WorkerPool>;
  private workerCount: number;
  
  constructor(workerCount: number = 4) {
    this.workerCount = workerCount;
    this.workerPools = new Map();
  }
  
  // 同一 gameId 总是路由到同一个 Worker Pool
  // 这保证了请求的顺序性
  routeTo(gameId: string): WorkerPool {
    const workerIndex = hash(gameId) % this.workerCount;
    const workerId = `worker-${workerIndex}`;
    
    if (!this.workerPools.has(workerId)) {
      this.workerPools.set(workerId, new WorkerPool(workerId));
    }
    
    return this.workerPools.get(workerId);
  }
  
  async submit(gameId: string, request: AgentRequest): Promise<AgentResponse> {
    const pool = this.routeTo(gameId);
    return pool.submit(request);  // 同一游戏保证 FIFO
  }
}
```

### 3.4 熔断器并发

```typescript
// 熔断器状态变更：必须是线程安全的
// 使用原子操作防止状态竞争

class AtomicCircuitBreaker {
  private state: AtomicRef<CircuitState>;  // 原子引用
  
  async trip(): Promise<void> {
    // 原子 CAS 操作——只有一个调用者能成功改变状态
    const prev = this.state.compareAndSet("closed", "open");
    if (prev === "closed") {
      this.onTrip();  // 触发告警
      this.scheduleRecovery();  // 安排半开探测
    }
  }
  
  async halfOpen(): Promise<void> {
    // 从 open 到 half-open 的转换也是原子的
    const prev = this.state.compareAndSet("open", "half-open");
    if (prev === "open") {
      this.probe();  // 发送探测请求
    }
  }
  
  async close(): Promise<void> {
    const prev = this.state.compareAndSet("half-open", "closed");
    if (prev === "half-open") {
      this.onClose();  // 重置计数器
    }
  }
}
```

---

## 四、一致性边界

### 4.1 游戏内一致性（强一致）

```
同一游戏内：所有操作串行
┌────────────────────────────────────────┐
│  Game Catan-001                        │
│                                        │
│  Move A ──┐                            │
│           ▼                            │
│  Validate ──▶ Serial Queue ──▶ State  │
│           ▲                            │
│  Move B ──┘                            │
│                                        │
│  Result A ──▶ Broadcast to players      │
│  Result B ──▶ Broadcast to players     │
└────────────────────────────────────────┘
```

**保证：**
- 同一游戏的 Move A 和 Move B 不会并发执行
- 状态更新和事件广播是原子的
- 玩家看到的状态更新顺序与写入顺序一致

### 4.2 游戏间一致性（最终一致）

```
不同游戏间：可并行
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Catan-001   │  │  UNO-042    │  │ Chess-101   │
│ Worker-0    │  │  Worker-1   │  │  Worker-2   │
└─────────────┘  └─────────────┘  └─────────────┘
      │                │                │
      ▼                ▼                ▼
  独立状态        独立状态         独立状态
```

**保证：**
- 游戏间完全隔离
- 一个游戏的故障不影响其他游戏
- 每个游戏的写入是自己有序的

### 4.3 跨游戏操作（需要协调）

```typescript
// 跨游戏操作的场景：排行榜、匹配系统、全局统计
// 这些场景需要分布式锁或事务

class GlobalOperations {
  // 排行榜更新：使用分布式锁
  async updateLeaderboard(gameResult: GameResult): Promise<void> {
    const lock = this.distributedLock.acquire(`leaderboard:${gameResult.gameType}`);
    try {
      await this.leaderboardStore.increment(gameResult);
    } finally {
      lock.release();
    }
  }
  
  // 匹配系统：使用乐观锁
  async matchPlayers(playerIds: string[]): Promise<MatchResult> {
    const match = new Match(playerIds);
    await this.matchStore.save(match);  // 乐观锁冲突重试
    
    // 发布匹配事件（最终一致）
    this.eventBus.publish({
      type: "MATCH_CREATED",
      players: playerIds,
      gameId: match.gameId
    });
  }
}
```

---

## 五、优先级与负荷管理

### 5.1 优先级队列

```typescript
// P0-P3 优先级实现
// 高优先级任务总是先被处理

class PriorityAgentQueue {
  private queues: Map<Priority, AsyncQueue<AgentRequest>> = new Map([
    [Priority.P0_CRITICAL, new AsyncQueue()],
    [Priority.P1_HIGH, new AsyncQueue()],
    [Priority.P2_NORMAL, new AsyncQueue()],
    [Priority.P3_LOW, new AsyncQueue()],
  ]);
  
  async enqueue(request: AgentRequest): Promise<void> {
    await this.queues.get(request.priority).enqueue(request);
  }
  
  async dequeue(): Promise<AgentRequest> {
    // 按优先级顺序检查
    for (const [priority, queue] of this.queues) {
      if (!queue.isEmpty()) {
        return queue.dequeue();
      }
    }
    return this.queues.get(Priority.P3_LOW).dequeue();  // 默认
  }
}

// 优先级定义
enum Priority {
  P0_CRITICAL = 0,  // 规则验证（阻塞游戏）
  P1_HIGH = 1,      // AI 响应（用户体验）
  P2_NORMAL = 2,    // 生成任务（非紧急）
  P3_LOW = 3,       // 优化/后台任务
}
```

### 5.2 负荷卸载策略

```typescript
// 当系统过载时：负荷卸载
// 防止雪崩效应

class LoadShedder {
  private currentLoad: number = 0;
  private maxLoad: number = 1000;  // 最大并发任务数
  
  async submit(task: Task): Promise<Result | LoadShedError> {
    // 原子递增
    const load = Atomic.increment(this.currentLoad);
    
    if (load > this.maxLoad) {
      Atomic.decrement(this.currentLoad);
      return new LoadShedError("System at capacity");
    }
    
    try {
      return await task.execute();
    } finally {
      Atomic.decrement(this.currentLoad);
    }
  }
  
  // 按优先级卸载
  shouldShed(priority: Priority): boolean {
    const loadFactor = this.currentLoad / this.maxLoad;
    
    if (loadFactor > 0.9 && priority >= Priority.P2_NORMAL) return true;
    if (loadFactor > 0.8 && priority >= Priority.P1_HIGH) return true;
    if (loadFactor > 0.7 && priority >= Priority.P0_CRITICAL) return true;
    
    return false;
  }
}
```

---

## 六、死锁预防

### 6.1 锁获取顺序

```typescript
// 规则：所有代码必须按固定顺序获取锁
// 禁止嵌套获取不同游戏的锁

// ✅ 正确：总是先按 gameId 排序再获取
async function handleCrossGameOperation(gameIds: string[]): Promise<void> {
  const sortedIds = gameIds.sort();  // 固定顺序
  for (const id of sortedIds) {
    await this.locks.acquire(`game:${id}`);
  }
  try {
    // 执行操作
  } finally {
    for (const id of sortedIds.reverse()) {
      this.locks.release(`game:${id}`);
    }
  }
}

// ❌ 错误：嵌套获取不同游戏的锁
async function brokenOperation(gameId1: string, gameId2: string): Promise<void> {
  await this.locks.acquire(`game:${gameId1}`);  // 先拿 game1
  await this.locks.acquire(`game:${gameId2}`);  // 再拿 game2
  
  // 如果另一个线程以相反顺序获取 → 死锁！
}
```

### 6.2 超时锁

```typescript
// 所有锁都必须有超时——防止永久死锁

class LockManager {
  async acquire(key: string, timeoutMs: number = 5000): Promise<Lock> {
    const lock = this.locks.get(key);
    
    const acquired = await lock.acquire(timeoutMs);
    if (!acquired) {
      throw new LockTimeoutError(`Could not acquire lock ${key} within ${timeoutMs}ms`);
    }
    
    return {
      key,
      release: () => lock.release(),
      // 自动释放超时
      autoRelease: setTimeout(() => {
        if (!lock.isReleased()) {
          lock.release();
          this.onLockLeak(key);  // 记录日志
        }
      }, timeoutMs * 2)
    };
  }
}
```

---

## 七、配置参考

```yaml
concurrency:
  # Worker Pool 配置
  worker_pools:
    validation:
      count: 1          # 验证器只有一个（串行瓶颈）
      queue_size: 1000
    agent:
      count: 4          # 4 个 Agent Worker
      queue_size: 500
    background:
      count: 2           # 后台任务 Worker
      queue_size: 200
  
  # 超时配置（毫秒）
  timeouts:
    validation: 5000
    agent_request: 30000
    lock_acquisition: 5000
    circuit_breaker_open: 60000
  
  # 负荷阈值
  load:
    max_concurrent_tasks: 1000
    shed_p0_threshold: 0.7
    shed_p1_threshold: 0.8
    shed_p2_threshold: 0.9
```

---

## 八、与 RULES-ENGINE.md 的集成

验证超时（ RULES-ENGINE.md 3.0 节）必须遵循此并发模型：

```typescript
// 验证请求通过 ValidationQueue 串行处理
// 超时通过 AbortController 实现
// 超时结果通过事件广播通知所有相关方

class ValidationIntegration {
  constructor(
    private validationQueue: ValidationQueue,
    private eventBus: EventBus
  ) {}
  
  async validateWithTimeout(move: Move, config: ValidationConfig): Promise<ValidationResult> {
    const result = await validationQueue.validate(move, config.timeoutMs);
    
    // 无论成功还是超时，都广播事件
    this.eventBus.publish({
      type: "VALIDATION_COMPLETED",
      move,
      result,
      timestamp: Date.now()
    });
    
    return result;
  }
}
```

---

## 九、检查清单

部署前检查：

- [ ] ValidationQueue 使用单一游戏锁（游戏内串行）
- [ ] 不同游戏可并行验证（游戏间隔离）
- [ ] 规则验证有 5 秒超时 + 默认拒绝
- [ ] 状态写入是单写者 + 事件广播
- [ ] Agent 请求按 gameId 路由到固定 Worker
- [ ] 熔断器状态变更使用原子操作
- [ ] 所有锁有超时配置
- [ ] 负荷卸载阈值已配置
- [ ] 死锁预防：锁获取顺序固定
