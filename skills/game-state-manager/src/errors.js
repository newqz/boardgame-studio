/**
 * Custom Error Classes
 * 自定义错误类
 */

'use strict';

/**
 * 游戏状态基础异常
 */
class GameStateError extends Error {
  /**
   * @param {string} message - 错误消息
   * @param {string} code - 错误代码
   * @param {Object} [details] - 详细信息
   */
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details
    };
  }
}

/**
 * 序列化异常
 */
class SerializationError extends GameStateError {
  constructor(message, details = {}) {
    super(message, 'SERIALIZATION_ERROR', details);
  }
}

/**
 * 快照异常
 */
class SnapshotError extends GameStateError {
  constructor(message, details = {}) {
    super(message, 'SNAPSHOT_ERROR', details);
  }
}

/**
 * 验证异常
 */
class ValidationException extends GameStateError {
  constructor(message, errors = []) {
    super(message, 'VALIDATION_ERROR', { errors });
    this.errors = errors;
  }
}

/**
 * 差异同步异常
 */
class DeltaSyncError extends GameStateError {
  constructor(message, details = {}) {
    super(message, 'DELTA_SYNC_ERROR', details);
  }
}

module.exports = {
  GameStateError,
  SerializationError,
  SnapshotError,
  ValidationException,
  DeltaSyncError
};
