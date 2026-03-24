/**
 * Game Rules Parser - Main Export
 * 
 * @version 2.0.0
 * @description 将自然语言桌游规则文档解析为结构化数据
 */

'use strict';

const { parseRules, validateRules, toMarkdown, validateInput, GameCategory } = require('./parser');
const structures = require('./structures');

// Re-export for convenience
module.exports = {
  // Main API
  parseRules,
  validateRules,
  validateInput,
  toMarkdown,
  
  // Enums
  GameCategory,
  GameCategoryValues: Object.values(GameCategory),
  
  // Structures (for type checking)
  structures,
  
  // Version info
  VERSION: '2.0.0'
};
