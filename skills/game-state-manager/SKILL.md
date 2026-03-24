# Skill: game-state-manager

> 游戏状态管理技能 — 序列化和恢复游戏状态

**状态**: ✅ 已实现 (v1.0)

## 目录结构

```
game-state-manager/
├── src/
│   ├── index.js          # 主入口，导出 GameStateManager
│   ├── serializer.js     # 序列化模块
│   ├── snapshot-manager.js # 快照管理
│   ├── delta-sync.js     # 差异同步
│   └── validator.js      # 状态验证
├── tests/
│   └── state-manager.test.js  # 测试用例
└── SKILL.md              # 本文件
```

## 核心功能

### 1. 序列化 (serializer.js)
- 完整序列化/反序列化
- SHA-256 校验和验证
- 版本迁移支持
- 可选 gzip 压缩

### 2. 快照管理 (snapshot-manager.js)
- 创建/恢复快照
- 自动清理旧快照
- 状态历史追溯
- 快照链管理

### 3. 差异同步 (delta-sync.js)
- 高效差异计算
- 增量更新应用
- 差异撤销（undo）
- 差异合并

### 4. 状态验证 (validator.js)
- 资源守恒检查
- 合法性验证
- 可扩展自定义规则
- Catan 专用验证器

## 使用方法

```javascript
const { GameStateManager } = require('./src/index');

// 创建管理器
const manager = new GameStateManager();

// 创建游戏
const initialState = {
  gameId: 'game-001',
  turnNumber: 0,
  players: { /* ... */ }
};
manager.createGame('game-001', initialState);

// 创建快照
const snapshot = manager.createSnapshot(state, 'Turn 1');

// 计算差异
const delta = manager.diff(stateA, stateB);

// 应用差异
const newState = manager.applyDelta(stateA, delta);

// 验证状态
const result = manager.validate(state);
if (!result.valid) {
  console.log('Errors:', result.errors);
}
```

## 触发条件

- 需要保存/加载游戏进度时
- 实现游戏回放功能时
- 处理断线重连时
- 需要在客户端与服务端同步状态时

## 测试结果

```
=== Serializer Tests ===
Roundtrip equal: true ✅

=== Snapshot Tests ===
Created snapshot ✅
Restored from snap1: true ✅

=== Delta Sync Tests ===
Delta (single resource change): 1 changes ✅
Apply delta works: true ✅
Undo works: true ✅

=== Validator Tests ===
Valid state validation: true ✅
Invalid state (negative resources): false (detected) ✅

=== GameStateManager Tests ===
Created game: true ✅
Diff between states: 2 changes ✅
Apply delta works: true ✅

=== Clone & Equals Tests ===
Original unchanged: true ✅
Equals same object: true ✅
```

## 下一步

- 可选: 添加 pako 依赖以启用压缩
- 可选: 集成 Redis 进行分布式存储
- 可选: 添加 WebSocket 支持实时同步
