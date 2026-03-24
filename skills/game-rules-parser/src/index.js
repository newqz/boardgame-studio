/**
 * Game Rules Parser - Main Export
 * 
 * @version 1.0.0
 * @description 将自然语言桌游规则文档解析为结构化数据
 */

'use strict';

const { parseRules, validateRules, toMarkdown, GameCategory } = require('./parser');
const structures = require('./structures');

// Re-export for convenience
module.exports = {
  // Main API
  parseRules,
  validateRules,
  toMarkdown,
  
  // Enums
  GameCategory,
  GameCategoryValues: Object.values(GameCategory),
  
  // Structures (for type checking)
  structures,
  
  // Version info
  VERSION: '1.0.0'
};
