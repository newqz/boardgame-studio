/**
 * Delta Sync v2
 * 差异同步 - 计算和应用状态差异
 * 
 * @version 2.0.0
 * @with Immer for immutable updates
 */

'use strict';

const { produce } = require('immer');
const { DeltaSyncError } = require('./errors');

/**
 * 深度比较两个值
 * @param {*} a 
 * @param {*} b 
 * @returns {boolean}
 */
function deepEquals(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => deepEquals(item, b[index]));
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEquals(a[key], b[key])) return false;
    }

    return true;
  }

  return false;
}

/**
 * 深度克隆
 * @param {*} obj 
 * @returns {*}
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }

  const cloned = {};
  for (const [key, value] of Object.entries(obj)) {
    cloned[key] = deepClone(value);
  }
  return cloned;
}

/**
 * 差异同步类
 * @class
 */
class DeltaSync {
  /**
   * @param {Object} [options] - 配置选项
   * @param {Set<string>} [options.ignoreKeys] - 忽略的键
   * @param {number} [options.maxDeltaSize=1000] - 最大变更数
   */
  constructor(options = {}) {
    /** @type {Set<string>} */
    this.ignoreKeys = new Set(options.ignoreKeys || ['_internal', 'lastUpdate', 'temp']);
    /** @type {number} */
    this.maxDeltaSize = options.maxDeltaSize || 1000;
  }

  /**
   * 计算两个状态的差异
   * @param {Object} stateA - 旧状态
   * @param {Object} stateB - 新状态
   * @returns {Object} Delta
   * @throws {DeltaSyncError}
   */
  diff(stateA, stateB) {
    if (stateA === undefined || stateA === null) {
      throw new DeltaSyncError('stateA cannot be null or undefined');
    }
    if (stateB === undefined || stateB === null) {
      throw new DeltaSyncError('stateB cannot be null or undefined');
    }

    const changes = [];

    this._compareObjects('', stateA, stateB, changes);

    // 限制差异数量
    if (changes.length > this.maxDeltaSize) {
      console.warn(`Delta size (${changes.length}) exceeds max (${this.maxDeltaSize})`);
      return {
        id: this._generateUUID(),
        timestamp: Date.now(),
        changes: [{ type: 'full_state', path: '', oldValue: stateA, newValue: stateB }],
        fullState: true
      };
    }

    return {
      id: this._generateUUID(),
      timestamp: Date.now(),
      changes,
      fullState: false
    };
  }

  /**
   * 递归比较对象
   * @private
   */
  _compareObjects(path, objA, objB, changes) {
    if (objA === objB) return;

    // 处理 null
    if (objA === null || objB === null) {
      if (objA !== objB) {
        changes.push({ type: 'change', path: path || '.', oldValue: objA, newValue: objB });
      }
      return;
    }

    // 处理基本类型
    if (typeof objA !== 'object' || typeof objB !== 'object') {
      if (objA !== objB) {
        changes.push({ type: 'change', path: path || '.', oldValue: objA, newValue: objB });
      }
      return;
    }

    // 处理数组
    if (Array.isArray(objA) || Array.isArray(objB)) {
      if (!Array.isArray(objA) || !Array.isArray(objB)) {
        changes.push({ type: 'change', path: path || '.', oldValue: objA, newValue: objB });
      } else if (!deepEquals(objA, objB)) {
        changes.push({ type: 'array_change', path: path || '.', oldValue: objA, newValue: objB });
      }
      return;
    }

    // 处理对象 - 找出新增的键
    const allKeys = new Set([...Object.keys(objA || {}), ...Object.keys(objB || {})]);

    for (const key of allKeys) {
      if (this.ignoreKeys.has(key)) continue;

      const valueA = objA ? objA[key] : undefined;
      const valueB = objB ? objB[key] : undefined;
      const childPath = path ? `${path}.${key}` : key;

      if (!(key in (objA || {}))) {
        changes.push({ type: 'add', path: childPath, oldValue: undefined, newValue: valueB });
      } else if (!(key in (objB || {}))) {
        changes.push({ type: 'remove', path: childPath, oldValue: valueA, newValue: undefined });
      } else if (!deepEquals(valueA, valueB)) {
        if (typeof valueA !== 'object' || typeof valueB !== 'object') {
          changes.push({ type: 'change', path: childPath, oldValue: valueA, newValue: valueB });
        } else {
          this._compareObjects(childPath, valueA, valueB, changes);
        }
      }
    }
  }

  /**
   * 应用差异到状态（使用 Immer）
   * @param {Object} baseState - 基础状态
   * @param {Object} delta - 差异
   * @returns {Object} 新状态
   */
  applyDelta(baseState, delta) {
    if (delta.fullState) {
      return deepClone(delta.changes[0].newValue);
    }

    // 使用 Immer 进行不可变更新
    return produce(baseState, draft => {
      for (const change of delta.changes) {
        this._applyChange(draft, change);
      }
    });
  }

  /**
   * 应用单个变更到 draft
   * @private
   */
  _applyChange(draft, change) {
    const { type, path, oldValue, newValue } = change;

    if (path === '.' || path === '') {
      if (type === 'full_state' || type === 'change') {
        return deepClone(newValue);
      }
      return;
    }

    const parts = path.split('.');
    let current = draft;

    // 遍历到父对象
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] === undefined) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    const lastKey = parts[parts.length - 1];

    switch (type) {
      case 'add':
      case 'change':
        current[lastKey] = deepClone(newValue);
        break;
      case 'remove':
        delete current[lastKey];
        break;
      case 'array_change':
        current[lastKey] = deepClone(newValue);
        break;
    }
  }

  /**
   * 反向应用差异（撤销）
   * @param {Object} baseState - 基础状态
   * @param {Object} delta - 差异
   * @returns {Object} 撤销后的状态
   */
  reverseDelta(baseState, delta) {
    const reverseChanges = delta.changes.map(change => ({
      type: change.type === 'add' ? 'remove' :
            change.type === 'remove' ? 'add' : 'change',
      path: change.path,
      oldValue: change.newValue,
      newValue: change.oldValue
    }));

    return {
      id: this._generateUUID(),
      timestamp: Date.now(),
      changes: reverseChanges,
      fullState: delta.fullState,
      reversed: true
    };
  }

  /**
   * 合并多个差异
   * @param {Object} delta1 - 差异1
   * @param {Object} delta2 - 差异2
   * @returns {Object} 合并后的差异
   */
  mergeDeltas(delta1, delta2) {
    const merged = deepClone(delta1);
    const pathIndex = new Map();

    // 构建路径索引
    merged.changes.forEach((change, index) => {
      pathIndex.set(change.path, index);
    });

    // 合并 delta2 的变更
    for (const change of delta2.changes) {
      const existingIndex = pathIndex.get(change.path);
      if (existingIndex !== undefined) {
        merged.changes[existingIndex] = change;
      } else {
        merged.changes.push(change);
        pathIndex.set(change.path, merged.changes.length - 1);
      }
    }

    return merged;
  }

  /**
   * 压缩差异
   * @param {Object} delta - 差异
   * @returns {Object} 压缩后的差异
   */
  compressDelta(delta) {
    const finalChanges = new Map();

    // 从后往前，只保留每个路径的最后一次变更
    for (let i = delta.changes.length - 1; i >= 0; i--) {
      const change = delta.changes[i];
      if (!finalChanges.has(change.path)) {
        finalChanges.set(change.path, change);
      }
    }

    return {
      ...delta,
      changes: Array.from(finalChanges.values()),
      compressed: true
    };
  }

  /**
   * 生成 UUID
   * @private
   */
  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

module.exports = { DeltaSync, deepEquals, deepClone };
