/**
 * Snapshot Manager
 * 游戏状态快照管理
 */

const { GameStateSerializer } = require('./serializer');

class SnapshotManager {
  constructor(options = {}) {
    this.serializer = new GameStateSerializer(options);
    this.snapshots = new Map();
    this.currentSnapshotId = null;
    this.maxSnapshots = options.maxSnapshots || 100;
    this.autoCleanup = options.autoCleanup !== false;
  }

  /**
   * 创建快照
   * @param {Object} state - 游戏状态
   * @param {string} [label] - 快照标签
   * @returns {Snapshot}
   */
  createSnapshot(state, label) {
    const snapshot = {
      id: this.generateUUID(),
      label: label || `Snapshot ${new Date().toISOString()}`,
      timestamp: Date.now(),
      state: this.serializer.serialize(state),
      size: this.estimateSize(state),
      parentId: this.currentSnapshotId,
      metadata: {}
    };

    this.snapshots.set(snapshot.id, snapshot);
    this.currentSnapshotId = snapshot.id;

    if (this.autoCleanup) {
      this.cleanupOldSnapshots();
    }

    return snapshot;
  }

  /**
   * 获取快照
   */
  getSnapshot(snapshotId) {
    return this.snapshots.get(snapshotId) || null;
  }

  /**
   * 获取最新的快照
   */
  getLatest() {
    if (!this.currentSnapshotId) {
      return null;
    }
    return this.snapshots.get(this.currentSnapshotId);
  }

  /**
   * 恢复快照
   */
  restoreSnapshot(snapshotId) {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    return this.serializer.deserialize(snapshot.state);
  }

  /**
   * 删除快照
   */
  deleteSnapshot(snapshotId) {
    if (!this.snapshots.has(snapshotId)) {
      return false;
    }

    // 更新父引用
    const snapshot = this.snapshots.get(snapshotId);
    this.snapshots.delete(snapshotId);

    // 如果删除的是当前快照，尝试找到前一个
    if (this.currentSnapshotId === snapshotId) {
      this.currentSnapshotId = snapshot.parentId;
    }

    return true;
  }

  /**
   * 获取状态历史
   */
  getStateHistory(fromSnapshotId, toSnapshotId) {
    const states = [];
    let currentId = fromSnapshotId;

    while (currentId && currentId !== toSnapshotId) {
      const snapshot = this.snapshots.get(currentId);
      if (!snapshot) break;

      states.push(this.serializer.deserialize(snapshot.state));
      currentId = snapshot.parentId;
    }

    // 包含目标快照
    if (currentId === toSnapshotId) {
      const snapshot = this.snapshots.get(toSnapshotId);
      if (snapshot) {
        states.push(this.serializer.deserialize(snapshot.state));
      }
    }

    return states;
  }

  /**
   * 获取所有快照
   */
  getAllSnapshots() {
    return Array.from(this.snapshots.values())
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 获取快照链
   */
  getSnapshotChain(snapshotId) {
    const chain = [];
    let currentId = snapshotId;

    while (currentId) {
      const snapshot = this.snapshots.get(currentId);
      if (!snapshot) break;

      chain.unshift(snapshot);
      currentId = snapshot.parentId;
    }

    return chain;
  }

  /**
   * 清理旧快照
   */
  cleanupOldSnapshots() {
    if (this.snapshots.size <= this.maxSnapshots) {
      return;
    }

    const sorted = this.getAllSnapshots();
    const toDelete = sorted.slice(0, sorted.length - this.maxSnapshots);

    for (const snapshot of toDelete) {
      this.snapshots.delete(snapshot.id);
    }

    return toDelete.map(s => s.id);
  }

  /**
   * 估算状态大小
   */
  estimateSize(state) {
    const json = JSON.stringify(state);
    return {
      bytes: Buffer.byteLength(json, 'utf8'),
      kb: (Buffer.byteLength(json, 'utf8') / 1024).toFixed(2) + ' KB'
    };
  }

  /**
   * 生成 UUID
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 导出快照到文件
   */
  exportToFile(snapshotId, filepath) {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const fs = require('fs');
    fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
    return filepath;
  }

  /**
   * 从文件导入快照
   */
  importFromFile(filepath) {
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

    this.snapshots.set(data.id, data);
    this.currentSnapshotId = data.id;

    return data;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      total: this.snapshots.size,
      max: this.maxSnapshots,
      currentId: this.currentSnapshotId,
      oldest: this.snapshots.size > 0
        ? this.getAllSnapshots()[0].timestamp
        : null,
      newest: this.snapshots.size > 0
        ? this.getAllSnapshots()[this.snapshots.size - 1].timestamp
        : null
    };
  }
}

/**
 * @typedef {Object} Snapshot
 * @property {string} id
 * @property {string} label
 * @property {number} timestamp
 * @property {Object} state
 * @property {Object} size
 * @property {string|null} parentId
 */

module.exports = { SnapshotManager };
