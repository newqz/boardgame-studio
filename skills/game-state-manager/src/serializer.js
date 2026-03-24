/**
 * Game State Serializer v3
 * 支持同步/异步序列化和性能基准
 * 
 * @version 3.0.0
 */

'use strict';

const crypto = require('crypto');
const zlib = require('zlib');
const { SerializationError } = require('./errors');

/**
 * 性能约束声明
 * @type {Object}
 */
const PERFORMANCE_CONSTRAINTS = {
  // 单次状态更新延迟目标 (ms)
  UPDATE_TARGET_MS: 1,
  // 快照创建延迟目标 (ms)
  SNAPSHOT_TARGET_MS: 5,
  // 序列化+压缩延迟目标 (ms) - 状态小于100KB
  SERIALIZE_TARGET_MS: 10,
  // 差异同步应用延迟目标 (ms)
  DELTA_APPLY_TARGET_MS: 0.5,
  // 异步压缩阈值 (bytes) - 超过此大小使用异步API
  ASYNC_THRESHOLD: 65536, // 64KB
  // 推荐的最大状态大小 (bytes)
  MAX_RECOMMENDED_SIZE: 10 * 1024 * 1024, // 10MB
};

/**
 * 游戏状态序列化器 v3
 */
class GameStateSerializer {
  /**
   * @param {Object} [options] - 配置选项
   * @param {string} [options.version='1.0.0'] - 版本号
   * @param {Array} [options.migrators=[]] - 版本迁移器
   * @param {boolean} [options.compression=true] - 启用压缩
   * @param {number} [options.asyncThreshold=65536] - 异步阈值
   */
  constructor(options = {}) {
    this.currentVersion = options.version || '1.0.0';
    this.migrators = options.migrators || [];
    this.compressionEnabled = options.compression !== false;
    this.asyncThreshold = options.asyncThreshold || PERFORMANCE_CONSTRAINTS.ASYNC_THRESHOLD;
    this.ignoreKeys = new Set(['_internal', 'lastUpdate', 'temp']);
  }

  /**
   * 同步序列化（小状态，<64KB）
   * @param {Object} state - 游戏状态
   * @returns {Object} 序列化后的状态
   */
  serialize(state) {
    if (state === undefined || state === null) {
      throw new SerializationError('State cannot be null or undefined', { state });
    }

    const data = this._encodeSync(state);
    return {
      version: this.currentVersion,
      timestamp: Date.now(),
      checksum: this.calculateChecksum(state),
      data
    };
  }

  /**
   * 异步序列化（大状态，>=64KB）
   * @param {Object} state - 游戏状态
   * @returns {Promise<Object>} 序列化后的状态
   */
  async serializeAsync(state) {
    if (state === undefined || state === null) {
      throw new SerializationError('State cannot be null or undefined', { state });
    }

    const data = await this._encodeAsync(state);
    return {
      version: this.currentVersion,
      timestamp: Date.now(),
      checksum: this.calculateChecksum(state),
      data
    };
  }

  /**
   * 智能序列化 - 自动选择同步/异步
   * @param {Object} state - 游戏状态
   * @returns {Promise<Object>} 序列化后的状态
   */
  async serializeSmart(state) {
    const json = JSON.stringify(state, this._replacer.bind(this));
    const size = Buffer.byteLength(json, 'utf8');

    if (size >= this.asyncThreshold) {
      return this.serializeAsync(state);
    }
    return this.serialize(state);
  }

  /**
   * 同步反序列化
   * @param {Object} serialized - 序列化的数据
   * @returns {Object} 游戏状态
   */
  deserialize(serialized) {
    if (!serialized || typeof serialized !== 'object') {
      throw new SerializationError('Invalid serialized data', { type: typeof serialized });
    }

    if (!serialized.checksum || !serialized.data) {
      throw new SerializationError('Missing checksum or data', {
        hasChecksum: !!serialized.checksum,
        hasData: !!serialized.data
      });
    }

    // 先解码（带 reviver）再验证校验和
    const decoded = this._decodeSync(serialized.data, true);
    const json = JSON.stringify(decoded, this._replacer.bind(this));
    const computed = crypto.createHash('sha256').update(json).digest('hex').substring(0, 16);

    if (computed !== serialized.checksum) {
      throw new SerializationError('Checksum mismatch: state may be corrupted');
    }

    const migrated = this._migrate(serialized);
    return this._decodeSync(migrated.data, true);
  }

  /**
   * 异步反序列化
   * @param {Object} serialized - 序列化的数据
   * @returns {Promise<Object>} 游戏状态
   */
  async deserializeAsync(serialized) {
    if (!serialized || typeof serialized !== 'object') {
      throw new SerializationError('Invalid serialized data', { type: typeof serialized });
    }

    if (!serialized.checksum || !serialized.data) {
      throw new SerializationError('Missing checksum or data', {
        hasChecksum: !!serialized.checksum,
        hasData: !!serialized.data
      });
    }

    if (!this.validateChecksum(serialized)) {
      throw new SerializationError('Checksum mismatch: state may be corrupted');
    }

    const migrated = this._migrate(serialized);
    return this._decodeAsync(migrated.data);
  }

  /**
   * 智能反序列化 - 自动选择同步/异步
   * @param {Object} serialized - 序列化的数据
   * @returns {Promise<Object>} 游戏状态
   */
  async deserializeSmart(serialized) {
    const dataSize = typeof serialized.data === 'string' 
      ? Buffer.byteLength(serialized.data, 'utf8')
      : serialized.data.length || 0;

    if (dataSize >= this.asyncThreshold) {
      return this.deserializeAsync(serialized);
    }
    return this.deserialize(serialized);
  }

  /**
   * 同步编码
   * @private
   */
  _encodeSync(state) {
    const json = JSON.stringify(state, this._replacer.bind(this));

    if (this.compressionEnabled) {
      try {
        const buffer = Buffer.from(json, 'utf8');
        const compressed = zlib.deflateSync(buffer);
        return compressed.toString('base64');
      } catch (e) {
        console.warn('Compression failed, using plain JSON');
      }
    }

    return json;
  }

  /**
   * 计算校验和（基于原始状态）
   */
  calculateChecksum(state) {
    try {
      const json = JSON.stringify(state, this._replacer.bind(this));
      return crypto.createHash('sha256').update(json).digest('hex').substring(0, 16);
    } catch (e) {
      throw new SerializationError(`Checksum calculation failed: ${e.message}`);
    }
  }

  /**
   * 异步编码 - 避免大状态阻塞事件循环
   * @private
   */
  _encodeAsync(state) {
    return new Promise((resolve, reject) => {
      const json = JSON.stringify(state, this._replacer.bind(this));
      const buffer = Buffer.from(json, 'utf8');

      if (!this.compressionEnabled || buffer.length < this.asyncThreshold) {
        resolve(this._encodeSync(state));
        return;
      }

      zlib.deflate(buffer, { level: 6 }, (err, compressed) => {
        if (err) {
          reject(new SerializationError(`Compression failed: ${err.message}`));
        } else {
          resolve(compressed.toString('base64'));
        }
      });
    });
  }

  /**
   * 同步解码
   * @private
   * @param {string} data - 编码的数据
   * @param {boolean} [useReviver=true] - 是否使用 reviver 恢复特殊类型
   */
  _decodeSync(data, useReviver = true) {
    let json = data;

    if (this.compressionEnabled) {
      try {
        const buffer = Buffer.from(data, 'base64');
        const decompressed = zlib.inflateSync(buffer).toString('utf8');
        json = decompressed;
      } catch (e) {
        // 假设是未压缩的 JSON
      }
    }

    try {
      return JSON.parse(json, useReviver ? this._reviver.bind(this) : undefined);
    } catch (e) {
      throw new SerializationError(`JSON parse failed: ${e.message}`, {
        dataLength: data.length
      });
    }
  }

  /**
   * 异步解码
   * @private
   */
  _decodeAsync(data) {
    return new Promise((resolve, reject) => {
      if (!this.compressionEnabled) {
        try {
          resolve(JSON.parse(data, this._reviver.bind(this)));
        } catch (e) {
          reject(new SerializationError(`JSON parse failed: ${e.message}`));
        }
        return;
      }

      try {
        const buffer = Buffer.from(data, 'base64');
        zlib.inflate(buffer, (err, decompressed) => {
          if (err) {
            // 尝试作为普通 JSON 解析
            try {
              resolve(JSON.parse(data, this._reviver.bind(this)));
            } catch (e) {
              reject(new SerializationError(`Decompression and JSON parse failed: ${err.message}`));
            }
          } else {
            try {
              resolve(JSON.parse(decompressed.toString('utf8'), this._reviver.bind(this)));
            } catch (e) {
              reject(new SerializationError(`JSON parse after decompression failed: ${e.message}`));
            }
          }
        });
      } catch (e) {
        // 尝试作为普通 JSON
        try {
          resolve(JSON.parse(data, this._reviver.bind(this)));
        } catch (e2) {
          reject(new SerializationError(`Data parsing failed: ${e.message}`));
        }
      }
    });
  }

  /**
   * 验证校验和
   */
  validateChecksum(serialized) {
    try {
      const decoded = this._decodeSync(serialized.data);
      // 使用与 serialize 相同的 replacer 确保校验和一致
      const json = JSON.stringify(decoded, this._replacer.bind(this));
      const computed = crypto.createHash('sha256').update(json).digest('hex').substring(0, 16);
      return computed === serialized.checksum;
    } catch (e) {
      return false;
    }
  }

  /**
   * 版本迁移
   * @private
   */
  _migrate(data) {
    if (data.version === this.currentVersion) {
      return data;
    }

    let current = { ...data };
    const sortedMigrators = [...this.migrators].sort((a, b) => {
      return this._compareVersions(a.fromVersion, b.fromVersion);
    });

    for (const migrator of sortedMigrators) {
      if (this._needsMigration(current, migrator.fromVersion)) {
        current = {
          ...migrator.upgrade(current),
          version: migrator.toVersion
        };
      }
    }

    return current;
  }

  _needsMigration(data, targetVersion) {
    return this._compareVersions(data.version, targetVersion) < 0;
  }

  _compareVersions(v1, v2) {
    const parts1 = (v1 || '0.0.0').split('.').map(Number);
    const parts2 = (v2 || '0.0.0').split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  _replacer(key, value) {
    if (value === undefined) return '__UNDEFINED__';
    if (typeof value === 'symbol') return value.toString();
    if (typeof value === 'function') return `__FUNCTION__:${value.name || 'anonymous'}`;
    if (value instanceof Date) return `__DATE__:${value.toISOString()}`;
    if (value instanceof Map) return `__MAP__:${JSON.stringify([...value])}`;
    if (value instanceof Set) return `__SET__:${JSON.stringify([...value])}`;
    return value;
  }

  _reviver(key, value) {
    if (value === '__UNDEFINED__') return undefined;
    if (typeof value === 'string' && value.startsWith('__FUNCTION__:')) {
      console.warn('Function values cannot be restored from serialization');
      return null;
    }
    if (typeof value === 'string' && value.startsWith('__DATE__:')) {
      return new Date(value.slice(8));
    }
    if (typeof value === 'string' && value.startsWith('__MAP__:')) {
      return new Map(JSON.parse(value.slice(8)));
    }
    if (typeof value === 'string' && value.startsWith('__SET__:')) {
      return new Set(JSON.parse(value.slice(8)));
    }
    // 恢复 ISO 格式的日期字符串为 Date 对象
    // JSON.stringify 会自动调用 Date.toJSON()，所以需要在这里转换回来
    if (typeof value === 'string' && this._isISODateString(value)) {
      return new Date(value);
    }
    return value;
  }

  /**
   * 检测是否为 ISO 日期字符串
   * @private
   */
  _isISODateString(value) {
    // ISO 8601 格式: YYYY-MM-DDTHH:mm:ss.sssZ 或类似变体
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
    if (!isoDateRegex.test(value)) return false;
    const date = new Date(value);
    return !isNaN(date.getTime()) && date.toISOString().startsWith(value.slice(0, 10));
  }

  /**
   * 克隆状态
   */
  clone(state) {
    return JSON.parse(JSON.stringify(state, this._replacer.bind(this)));
  }

  /**
   * 获取性能约束
   */
  static getPerformanceConstraints() {
    return { ...PERFORMANCE_CONSTRAINTS };
  }
}

module.exports = { GameStateSerializer, PERFORMANCE_CONSTRAINTS };
