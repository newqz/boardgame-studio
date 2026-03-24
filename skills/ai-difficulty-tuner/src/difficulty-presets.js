/**
 * AI Difficulty Tuner - Difficulty Presets
 * 
 * @version 1.0.0
 */

'use strict';

/**
 * @typedef {'tutorial' | 'easy' | 'medium' | 'hard' | 'expert' | 'unbeatable'} DifficultyLevel
 */

/**
 * Difficulty level enum with numeric values
 * @type {Object.<DifficultyLevel, number>}
 */
const DifficultyLevel = Object.freeze({
  TUTORIAL: 'tutorial',
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  EXPERT: 'expert',
  UNBEATABLE: 'unbeatable'
});

/**
 * Difficulty level numeric values for comparison
 * @type {Object.<string, number>}
 */
const DifficultyRank = Object.freeze({
  tutorial: 0,
  easy: 1,
  medium: 2,
  hard: 3,
  expert: 4,
  unbeatable: 5
});

/**
 * @typedef {Object} ThinkTime
 * @property {number} min - Minimum think time in ms
 * @property {number} max - Maximum think time in ms
 * @property {number} average - Average think time in ms
 */

/**
 * @typedef {Object} DecisionParams
 * @property {number} explorationRate - Epsilon-greedy exploration rate
 * @property {number} randomActionRate - Random action probability
 * @property {number} mistakeRate - Intentional mistake probability
 * @property {number} blindSpotRate - Missing threats probability
 */

/**
 * @typedef {Object} Capabilities
 * @property {number} maxLookAhead - Maximum lookahead depth
 * @property {number} memoryDepth - Memory depth for game state
 * @property {boolean} patternRecognition - Can recognize patterns
 * @property {boolean} adaptToPlayer - Can adapt to player style
 */

/**
 * @typedef {Object} DifficultyConfig
 * @property {DifficultyLevel} level
 * @property {ThinkTime} thinkTime
 * @property {DecisionParams} decisionParams
 * @property {Capabilities} capabilities
 */

/**
 * Difficulty presets for each level
 * @type {Record<DifficultyLevel, DifficultyConfig>}
 */
const DIFFICULTY_PRESETS = Object.freeze({
  [DifficultyLevel.TUTORIAL]: {
    level: DifficultyLevel.TUTORIAL,
    thinkTime: { min: 500, max: 2000, average: 1000 },
    decisionParams: {
      explorationRate: 0.5,
      randomActionRate: 0.4,
      mistakeRate: 0.3,
      blindSpotRate: 0.5
    },
    capabilities: {
      maxLookAhead: 1,
      memoryDepth: 0,
      patternRecognition: false,
      adaptToPlayer: false
    }
  },

  [DifficultyLevel.EASY]: {
    level: DifficultyLevel.EASY,
    thinkTime: { min: 1000, max: 3000, average: 2000 },
    decisionParams: {
      explorationRate: 0.3,
      randomActionRate: 0.2,
      mistakeRate: 0.15,
      blindSpotRate: 0.3
    },
    capabilities: {
      maxLookAhead: 2,
      memoryDepth: 1,
      patternRecognition: false,
      adaptToPlayer: false
    }
  },

  [DifficultyLevel.MEDIUM]: {
    level: DifficultyLevel.MEDIUM,
    thinkTime: { min: 2000, max: 5000, average: 3000 },
    decisionParams: {
      explorationRate: 0.15,
      randomActionRate: 0.05,
      mistakeRate: 0.03,
      blindSpotRate: 0.1
    },
    capabilities: {
      maxLookAhead: 3,
      memoryDepth: 3,
      patternRecognition: true,
      adaptToPlayer: false
    }
  },

  [DifficultyLevel.HARD]: {
    level: DifficultyLevel.HARD,
    thinkTime: { min: 3000, max: 8000, average: 5000 },
    decisionParams: {
      explorationRate: 0.05,
      randomActionRate: 0.01,
      mistakeRate: 0.005,
      blindSpotRate: 0.02
    },
    capabilities: {
      maxLookAhead: 5,
      memoryDepth: 5,
      patternRecognition: true,
      adaptToPlayer: true
    }
  },

  [DifficultyLevel.EXPERT]: {
    level: DifficultyLevel.EXPERT,
    thinkTime: { min: 5000, max: 15000, average: 10000 },
    decisionParams: {
      explorationRate: 0.01,
      randomActionRate: 0,
      mistakeRate: 0,
      blindSpotRate: 0
    },
    capabilities: {
      maxLookAhead: 8,
      memoryDepth: 10,
      patternRecognition: true,
      adaptToPlayer: true
    }
  },

  [DifficultyLevel.UNBEATABLE]: {
    level: DifficultyLevel.UNBEATABLE,
    thinkTime: { min: 10000, max: 60000, average: 30000 },
    decisionParams: {
      explorationRate: 0,
      randomActionRate: 0,
      mistakeRate: 0,
      blindSpotRate: 0
    },
    capabilities: {
      maxLookAhead: 999,
      memoryDepth: 999,
      patternRecognition: true,
      adaptToPlayer: true
    }
  }
});

/**
 * Get difficulty config by level
 * @param {DifficultyLevel} level - Difficulty level
 * @returns {DifficultyConfig} Difficulty configuration
 */
function getPreset(level) {
  return DIFFICULTY_PRESETS[level] || DIFFICULTY_PRESETS[DifficultyLevel.MEDIUM];
}

/**
 * Get all difficulty levels in order
 * @returns {DifficultyLevel[]} Array of difficulty levels
 */
function getAllLevels() {
  return [
    DifficultyLevel.TUTORIAL,
    DifficultyLevel.EASY,
    DifficultyLevel.MEDIUM,
    DifficultyLevel.HARD,
    DifficultyLevel.EXPERT,
    DifficultyLevel.UNBEATABLE
  ];
}

/**
 * Check if level is valid
 * @param {string} level - Level to check
 * @returns {boolean}
 */
function isValidLevel(level) {
  return Object.values(DifficultyLevel).includes(level);
}

/**
 * Compare two difficulty levels
 * @param {DifficultyLevel} a - First level
 * @param {DifficultyLevel} b - Second level
 * @returns {number} Negative if a < b, positive if a > b, 0 if equal
 */
function compareLevels(a, b) {
  return DifficultyRank[a] - DifficultyRank[b];
}

module.exports = {
  DifficultyLevel,
  DifficultyRank,
  DIFFICULTY_PRESETS,
  getPreset,
  getAllLevels,
  isValidLevel,
  compareLevels
};
