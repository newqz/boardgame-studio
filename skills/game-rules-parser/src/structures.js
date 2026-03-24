/**
 * Game Rules Parser - Data Structures
 * @version 1.0.0
 */

'use strict';

/**
 * @typedef {Object} GameInfo
 * @property {string} name - 游戏名称
 * @property {Object} playerCount - 玩家数量范围
 * @property {number} playerCount.min - 最少玩家数
 * @property {number} playerCount.max - 最多玩家数
 * @property {string} ageRange - 适合年龄
 * @property {Object} playTime - 游戏时间范围
 * @property {number} playTime.min - 最短时间（分钟）
 * @property {number} playTime.max - 最长时间（分钟）
 * @property {GameCategory} category - 游戏类型
 */

/**
 * @typedef {string} GameCategory
 * @enum {string}
 */
const GameCategory = {
  STRATEGY: 'strategy',
  FAMILY: 'family',
  PARTY: 'party',
  COOPERATIVE: 'cooperative',
  COMPETITIVE: 'competitive',
  CARD: 'card',
  DICE: 'dice',
  TILE: 'tile'
};

/**
 * @typedef {Object} Component
 * @property {string} name - 组件名称
 * @property {number} [count] - 数量
 * @property {string} [description] - 描述
 * @property {ComponentCategory} [category] - 组件类别
 */

/**
 * @typedef {string} ComponentCategory
 * @enum {string}
 */
const ComponentCategory = {
  BOARD: 'board',
  CARD: 'card',
  TILE: 'tile',
  TOKEN: 'token',
  DICE: 'dice',
  FIGURE: 'figure',
  CURRENCY: 'currency',
  OTHER: 'other'
};

/**
 * @typedef {Object} SetupStep
 * @property {number} order - 执行顺序
 * @property {string} description - 步骤描述
 * @property {string} [phase] - 所属阶段
 */

/**
 * @typedef {Object} GamePhase
 * @property {string} name - 阶段名称
 * @property {number} order - 执行顺序
 * @property {string} [description] - 描述
 * @property {ActionType[]} [actions] - 可用动作
 * @property {boolean} [repeatable] - 是否可重复
 */

/**
 * @typedef {Object} ActionType
 * @property {string} name - 动作名称
 * @property {string} [description] - 描述
 * @property {string[]} [prerequisites] - 前置条件
 * @property {string[]} [costs] - 消耗
 * @property {string[]} [effects] - 效果
 * @property {boolean} [optional] - 是否可选
 */

/**
 * @typedef {Object} VictoryCondition
 * @property {string} name - 条件名称
 * @property {string} description - 描述
 * @property {string[]} [criteria] - 判定标准
 * @property {boolean} [isPrimary] - 是否为主要胜利条件
 */

/**
 * @typedef {Object} SpecialRule
 * @property {string} name - 规则名称
 * @property {string} description - 描述
 * @property {string[]} [triggerConditions] - 触发条件
 * @property {string[]} [exceptions] - 例外情况
 */

/**
 * @typedef {Object} EdgeCase
 * @property {string} scenario - 场景描述
 * @property {string} [resolution] - 解决方案
 * @property {string[]} [relatedRules] - 相关规则
 */

/**
 * @typedef {Object} Ambiguity
 * @property {string} originalText - 原文
 * @property {Object} location - 位置信息
 * @property {number} location.line - 行号
 * @property {string} location.context - 上下文
 * @property {Interpretation[]} interpretations - 可能解读
 * @property {AmbiguitySeverity} severity - 严重程度
 */

/**
 * @typedef {string} AmbiguitySeverity
 * @enum {string}
 */
const AmbiguitySeverity = {
  BLOCKING: 'blocking',  // 阻止实现
  WARNING: 'warning',    // 需要确认
  INFO: 'info'           // 仅供参考
};

/**
 * @typedef {Object} Interpretation
 * @property {string} reading - 解读方式
 * @property {string[]} implications - 影响
 * @property {EdgeCase[]} edgeCases - 边界情况
 */

/**
 * @typedef {Object} ParsedRule
 * @property {GameInfo} gameInfo - 游戏基本信息
 * @property {Component[]} components - 游戏组件
 * @property {SetupStep[]} setup - 设置流程
 * @property {GamePhase[]} phases - 游戏流程
 * @property {ActionType[]} actions - 行动类型
 * @property {VictoryCondition[]} victoryConditions - 胜利条件
 * @property {SpecialRule[]} specialRules - 特殊规则
 * @property {EdgeCase[]} edgeCases - 边界情况
 * @property {Ambiguity[]} ambiguities - 歧义标记
 * @property {string[]} warnings - 警告信息
 * @property {ParseMetadata} metadata - 解析元数据
 */

/**
 * @typedef {Object} ParseMetadata
 * @property {string} rawText - 原始文本长度
 * @property {number} parseTime - 解析耗时（毫秒）
 * @property {string[]} unparsedSections - 未解析的章节
 * @property {string} version - 解析器版本
 * @property {ConfidenceScore} [confidence] - 整体置信度
 */

/**
 * @typedef {Object} ConfidenceScore
 * @property {number} overall - 整体置信度 (0-1)
 * @property {number} gameInfo - 游戏信息置信度
 * @property {number} components - 组件置信度
 * @property {number} phases - 阶段置信度
 * @property {number} actions - 动作置信度
 * @property {number} victory - 胜利条件置信度
 * @property {number} ambiguity - 歧义检测置信度
 */

/**
 * @typedef {Object} ParserOptions
 * @property {string[]} [customTerms] - 自定义术语表
 * @property {boolean} [strictMode] - 严格模式
 * @property {string} [language] - 语言 (default: 'en')
 * @property {boolean} [computeConfidence] - 计算置信度 (default: true)
 */


// Utility function (defined before exports for reference)
const calculateConfidence = (extraction, expectedFields, actualFields, ambiguityPenalty = 0.1) => {
  if (expectedFields === 0) return 1;
  const coverage = Math.min(actualFields / expectedFields, 1);
  const ambiguityFactor = Math.max(0, 1 - (extraction.ambiguities?.length || 0) * ambiguityPenalty);
  return Math.round(coverage * ambiguityFactor * 100) / 100;
};

module.exports = {
  // Enums
  GameCategory,
  ComponentCategory,
  AmbiguitySeverity,
  
  // Type definitions (for documentation)
  structures: {
    GameInfo: {},
    Component: {},
    SetupStep: {},
    GamePhase: {},
    ActionType: {},
    VictoryCondition: {},
    SpecialRule: {},
    EdgeCase: {},
    Ambiguity: {},
    Interpretation: {},
    ParsedRule: {},
    ParseMetadata: {},
    ParserOptions: {},
    ConfidenceScore: {}
  },
  
  // Utility
  calculateConfidence
};
