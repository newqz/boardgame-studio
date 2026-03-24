/**
 * State Validator
 * 游戏状态验证器
 */

class StateValidator {
  constructor(options = {}) {
    this.rules = options.rules || this.getDefaultRules();
    this.customValidators = new Map();
  }

  /**
   * 验证状态
   * @param {Object} state
   * @returns {ValidationResult}
   */
  validate(state) {
    const errors = [];
    const warnings = [];

    // 基本结构验证
    this.validateStructure(state, errors, warnings);

    // 资源守恒验证
    this.validateResourceConservation(state, errors);

    // 合法性验证
    this.validateLegalities(state, errors, warnings);

    // 自定义规则验证
    this.validateCustomRules(state, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 验证基本结构
   */
  validateStructure(state, errors, warnings) {
    // 检查必需字段
    const requiredFields = ['gameId', 'turnNumber', 'players'];

    for (const field of requiredFields) {
      if (state[field] === undefined) {
        errors.push({
          type: 'missing_field',
          field,
          message: `缺少必需字段: ${field}`,
          severity: 'critical'
        });
      }
    }

    // 回合数验证
    if (state.turnNumber !== undefined) {
      if (typeof state.turnNumber !== 'number') {
        errors.push({
          type: 'invalid_type',
          field: 'turnNumber',
          message: '回合数必须是数字',
          severity: 'critical'
        });
      } else if (state.turnNumber < 0) {
        errors.push({
          type: 'invalid_value',
          field: 'turnNumber',
          message: '回合数不能为负',
          severity: 'critical'
        });
      }
    }

    // 玩家数验证
    if (state.players !== undefined) {
      if (typeof state.players !== 'object') {
        errors.push({
          type: 'invalid_type',
          field: 'players',
          message: '玩家数据必须是对象',
          severity: 'critical'
        });
      } else {
        const playerCount = Object.keys(state.players).length;
        if (playerCount < 1) {
          errors.push({
            type: 'invalid_value',
            field: 'players',
            message: '玩家数至少为1',
            severity: 'critical'
          });
        }
      }
    }
  }

  /**
   * 验证资源守恒
   */
  validateResourceConservation(state, errors) {
    // 计算总资源
    const totalResources = this.sumAllResources(state);

    // 检查负资源
    for (const [playerId, player] of Object.entries(state.players || {})) {
      if (!player.resources) continue;

      for (const [resource, amount] of Object.entries(player.resources)) {
        if (typeof amount === 'number' && amount < 0) {
          errors.push({
            type: 'negative_resource',
            playerId,
            resource,
            amount,
            message: `玩家 ${playerId} 的资源 ${resource} 为负值: ${amount}`,
            severity: 'critical'
          });
        }
      }
    }

    // 检查资源上限
    if (state.maxResources !== undefined) {
      for (const [playerId, player] of Object.entries(state.players || {})) {
        if (!player.resources) continue;

        for (const [resource, amount] of Object.entries(player.resources)) {
          const max = state.maxResources[resource];
          if (max !== undefined && amount > max) {
            errors.push({
              type: 'resource_exceeded',
              playerId,
              resource,
              amount,
              max,
              message: `玩家 ${playerId} 的资源 ${resource} (${amount}) 超过上限 (${max})`,
              severity: 'critical'
            });
          }
        }
      }
    }
  }

  /**
   * 验证合法性
   */
  validateLegalities(state, errors, warnings) {
    // 验证当前玩家
    if (state.currentPlayer !== undefined) {
      if (!state.players || !state.players[state.currentPlayer]) {
        errors.push({
          type: 'invalid_current_player',
          currentPlayer: state.currentPlayer,
          message: `当前玩家 ${state.currentPlayer} 不存在`,
          severity: 'critical'
        });
      }
    }

    // 验证游戏是否已结束
    if (state.gameOver && state.winner === undefined) {
      warnings.push({
        type: 'missing_winner',
        message: '游戏已结束但未指定获胜者',
        severity: 'warning'
      });
    }

    // 验证回合顺序
    if (state.turnOrder) {
      const playerIds = Object.keys(state.players || {});
      for (const playerId of state.turnOrder) {
        if (!playerIds.includes(playerId)) {
          errors.push({
            type: 'invalid_turn_order',
            playerId,
            message: `回合顺序中包含无效玩家: ${playerId}`,
            severity: 'critical'
          });
        }
      }
    }
  }

  /**
   * 验证自定义规则
   */
  validateCustomRules(state, errors, warnings) {
    for (const [name, validator] of this.customValidators) {
      try {
        const result = validator(state);
        if (!result.valid) {
          errors.push(...(Array.isArray(result.errors) ? result.errors : [result.errors]));
        }
        if (result.warnings) {
          warnings.push(...(Array.isArray(result.warnings) ? result.warnings : [result.warnings]));
        }
      } catch (e) {
        errors.push({
          type: 'custom_validation_error',
          validator: name,
          message: `自定义验证器 ${name} 执行失败: ${e.message}`,
          severity: 'error'
        });
      }
    }
  }

  /**
   * 注册自定义验证器
   */
  registerValidator(name, validatorFn) {
    this.customValidators.set(name, validatorFn);
  }

  /**
   * 移除自定义验证器
   */
  unregisterValidator(name) {
    this.customValidators.delete(name);
  }

  /**
   * 获取默认规则
   */
  getDefaultRules() {
    return {
      requiredFields: ['gameId', 'turnNumber', 'players'],
      maxTurnNumber: Infinity,
      maxPlayers: 99,
      minPlayers: 1
    };
  }

  /**
   * 计算总资源
   */
  sumAllResources(state) {
    const totals = {};

    for (const player of Object.values(state.players || {})) {
      if (!player.resources) continue;

      for (const [resource, amount] of Object.entries(player.resources)) {
        if (typeof amount === 'number') {
          totals[resource] = (totals[resource] || 0) + amount;
        }
      }
    }

    return totals;
  }
}

/**
 * Catan 专用验证器
 */
class CatanValidator extends StateValidator {
  constructor() {
    super();

    // Catan 特定验证
    this.registerValidator('catan_resources', (state) => {
      const errors = [];
      const warnings = [];

      // 检查资源上限（每个玩家最多19张卡）
      for (const [playerId, player] of Object.entries(state.players || {})) {
        const totalCards = Object.values(player.resources || {})
          .reduce((sum, count) => sum + (count || 0), 0);

        if (totalCards > 19) {
          errors.push({
            type: 'catan_resource_limit',
            playerId,
            totalCards,
            message: `玩家 ${playerId} 有 ${totalCards} 张资源卡，超过上限19`,
            severity: 'critical'
          });
        }
      }

      // 检查强盗位置
      if (state.robberPosition === undefined) {
        errors.push({
          type: 'missing_robber',
          message: '强盗位置未设置',
          severity: 'critical'
        });
      }

      // 检查 road building 等特殊卡使用次数
      if (state.usedDevCards) {
        for (const [card, count] of Object.entries(state.usedDevCards)) {
          if (count > 1) {
            errors.push({
              type: 'invalid_dev_card_usage',
              card,
              count,
              message: `发展卡 ${card} 已被使用 ${count} 次`,
              severity: 'critical'
            });
          }
        }
      }

      return { valid: errors.length === 0, errors, warnings };
    });
  }
}

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {Array} errors
 * @property {Array} warnings
 */

module.exports = { StateValidator, CatanValidator };
