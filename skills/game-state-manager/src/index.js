/**
 * Game State Manager
 * 统一导出所有模块
 */

const { GameStateSerializer } = require('./serializer');
const { SnapshotManager } = require('./snapshot-manager');
const { DeltaSync, deepEquals, deepClone } = require('./delta-sync');
const { StateValidator, CatanValidator } = require('./validator');

/**
 * 游戏状态管理器 - 统一接口
 */
class GameStateManager {
  constructor(options = {}) {
    this.serializer = new GameStateSerializer(options);
    this.snapshotManager = new SnapshotManager({
      ...options,
      serializer: this.serializer
    });
    this.deltaSync = new DeltaSync(options);
    this.validator = new StateValidator(options);

    this.games = new Map(); // gameId -> game state
    this.validateOnUpdate = options.validateOnUpdate !== false; // 默认启用验证
  }

  // ==================== 序列化 ====================

  /**
   * 序列化状态
   */
  serialize(state) {
    return this.serializer.serialize(state);
  }

  /**
   * 反序列化
   */
  deserialize(data) {
    return this.serializer.deserialize(data);
  }

  /**
   * 计算校验和
   */
  checksum(state) {
    return this.serializer.calculateChecksum(state);
  }

  // ==================== 快照 ====================

  /**
   * 创建快照
   */
  createSnapshot(state, label) {
    return this.snapshotManager.createSnapshot(state, label);
  }

  /**
   * 获取快照
   */
  getSnapshot(snapshotId) {
    return this.snapshotManager.getSnapshot(snapshotId);
  }

  /**
   * 恢复快照
   */
  restoreSnapshot(snapshotId) {
    return this.snapshotManager.restoreSnapshot(snapshotId);
  }

  /**
   * 获取最新快照
   */
  getLatestSnapshot() {
    return this.snapshotManager.getLatest();
  }

  /**
   * 删除快照
   */
  deleteSnapshot(snapshotId) {
    return this.snapshotManager.deleteSnapshot(snapshotId);
  }

  /**
   * 获取历史状态
   */
  getStateHistory(fromId, toId) {
    return this.snapshotManager.getStateHistory(fromId, toId);
  }

  // ==================== 差异同步 ====================

  /**
   * 计算差异
   */
  diff(stateA, stateB) {
    return this.deltaSync.diff(stateA, stateB);
  }

  /**
   * 应用差异
   */
  applyDelta(state, delta) {
    return this.deltaSync.applyDelta(state, delta);
  }

  /**
   * 撤销差异
   */
  reverseDelta(state, delta) {
    return this.deltaSync.reverseDelta(state, delta);
  }

  /**
   * 合并差异
   */
  mergeDeltas(delta1, delta2) {
    return this.deltaSync.mergeDeltas(delta1, delta2);
  }

  // ==================== 验证 ====================

  /**
   * 验证状态
   */
  validate(state) {
    return this.validator.validate(state);
  }

  /**
   * 注册自定义验证器
   */
  registerValidator(name, fn) {
    this.validator.registerValidator(name, fn);
  }

  // ==================== 游戏管理 ====================

  /**
   * 创建新游戏
   */
  createGame(gameId, initialState) {
    const state = {
      ...initialState,
      gameId,
      turnNumber: 0,
      createdAt: Date.now()
    };

    this.games.set(gameId, deepClone(state));

    // 创建初始快照
    this.createSnapshot(state, 'Initial State');

    return state;
  }

  /**
   * 获取游戏状态
   */
  getGame(gameId) {
    return this.games.get(gameId) || null;
  }

  /**
   * 更新游戏状态
   */
  updateGame(gameId, newState) {
    if (!this.games.has(gameId)) {
      throw new Error(`Game not found: ${gameId}`);
    }

    // 可选验证
    if (this.validateOnUpdate) {
      const result = this.validator.validate(newState);
      if (!result.valid) {
        const error = new Error(`State validation failed: ${result.errors.length} errors`);
        error.validationErrors = result.errors;
        throw error;
      }
    }

    this.games.set(gameId, deepClone(newState));
    this.createSnapshot(newState, `Turn ${newState.turnNumber}`);

    return newState;
  }

  /**
   * 删除游戏
   */
  deleteGame(gameId) {
    return this.games.delete(gameId);
  }

  /**
   * 检查游戏是否存在
   */
  hasGame(gameId) {
    return this.games.has(gameId);
  }

  // ==================== 工具方法 ====================

  /**
   * 克隆状态
   */
  clone(state) {
    return deepClone(state);
  }

  /**
   * 比较状态
   */
  equals(stateA, stateB) {
    return deepEquals(stateA, stateB);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      games: this.games.size,
      snapshots: this.snapshotManager.getStats()
    };
  }
}

module.exports = {
  GameStateManager,
  GameStateSerializer,
  SnapshotManager,
  DeltaSync,
  StateValidator,
  CatanValidator,
  deepEquals,
  deepClone
};
