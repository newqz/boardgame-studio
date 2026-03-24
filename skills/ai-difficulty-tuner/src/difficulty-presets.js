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

/**
 * Interpolate between two difficulty configs
 * @param {DifficultyConfig} configA - Base config
 * @param {DifficultyConfig} configB - Target config
 * @param {number} factor - Interpolation factor (0-1)
 * @returns {DifficultyConfig} Interpolated config
 */
function interpolateConfigs(configA, configB, factor) {
  const clampedFactor = Math.max(0, Math.min(1, factor));

  return {
    level: configA.level,
    thinkTime: {
      min: Math.round(configA.thinkTime.min + (configB.thinkTime.min - configA.thinkTime.min) * clampedFactor),
      max: Math.round(configA.thinkTime.max + (configB.thinkTime.max - configA.thinkTime.max) * clampedFactor),
      average: Math.round(configA.thinkTime.average + (configB.thinkTime.average - configA.thinkTime.average) * clampedFactor)
    },
    decisionParams: {
      explorationRate: configA.decisionParams.explorationRate + (configB.decisionParams.explorationRate - configA.decisionParams.explorationRate) * clampedFactor,
      randomActionRate: configA.decisionParams.randomActionRate + (configB.decisionParams.randomActionRate - configA.decisionParams.randomActionRate) * clampedFactor,
      mistakeRate: configA.decisionParams.mistakeRate + (configB.decisionParams.mistakeRate - configA.decisionParams.mistakeRate) * clampedFactor,
      blindSpotRate: configA.decisionParams.blindSpotRate + (configB.decisionParams.blindSpotRate - configA.decisionParams.blindSpotRate) * clampedFactor
    },
    capabilities: {
      maxLookAhead: Math.round(configA.capabilities.maxLookAhead + (configB.capabilities.maxLookAhead - configA.capabilities.maxLookAhead) * clampedFactor),
      memoryDepth: Math.round(configA.capabilities.memoryDepth + (configB.capabilities.memoryDepth - configA.capabilities.memoryDepth) * clampedFactor),
      patternRecognition: clampedFactor > 0.5 ? configB.capabilities.patternRecognition : configA.capabilities.patternRecognition,
      adaptToPlayer: clampedFactor > 0.5 ? configB.capabilities.adaptToPlayer : configA.capabilities.adaptToPlayer
    }
  };
}

/**
 * Get interpolated difficulty config based on performance score
 * @param {DifficultyLevel} level - Base difficulty level
 * @param {number} performanceScore - Performance score (-1 to 1, negative=struggling, positive=dominant)
 * @returns {DifficultyConfig} Fine-tuned config
 */
function getFineTunedConfig(level, performanceScore) {
  // Validate level input
  if (!isValidLevel(level)) {
    console.warn(`Invalid difficulty level: ${level}, defaulting to MEDIUM`);
    level = DifficultyLevel.MEDIUM;
  }

  // Validate performanceScore
  if (typeof performanceScore !== 'number' || isNaN(performanceScore)) {
    console.warn(`Invalid performanceScore: ${performanceScore}, defaulting to 0`);
    performanceScore = 0;
  }

  const baseConfig = getPreset(level);
  const clampedScore = Math.max(-1, Math.min(1, performanceScore));

  // Performance score maps to interpolation factor
  // -1 = use previous level config (or current if tutorial)
  // 0 = use current level config
  // +1 = use next level config (or current if unbeatable)

  const factor = (clampedScore + 1) / 2; // Convert -1..1 to 0..1

  // Find adjacent levels
  const levels = getAllLevels();
  const currentIndex = levels.indexOf(level);

  let targetConfig;
  if (clampedScore < 0 && currentIndex > 0) {
    // Struggling: use easier level as target
    targetConfig = getPreset(levels[currentIndex - 1]);
  } else if (clampedScore > 0 && currentIndex < levels.length - 1) {
    // Dominant: use harder level as target
    targetConfig = getPreset(levels[currentIndex + 1]);
  } else {
    // At boundary or neutral - use current
    return baseConfig;
  }

  // Interpolate between current and target
  return interpolateConfigs(baseConfig, targetConfig, Math.abs(clampedScore));
}

/**
 * Validate a difficulty config structure
 * @param {Object} config - Config to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
function validateDifficultyConfig(config) {
  const errors = [];

  if (!config) {
    return { valid: false, errors: ['Config is null or undefined'] };
  }

  // Check thinkTime
  if (!config.thinkTime || typeof config.thinkTime !== 'object') {
    errors.push('thinkTime is required and must be an object');
  } else {
    if (typeof config.thinkTime.min !== 'number' || config.thinkTime.min < 0) {
      errors.push('thinkTime.min must be a non-negative number');
    }
    if (typeof config.thinkTime.max !== 'number' || config.thinkTime.max < 0) {
      errors.push('thinkTime.max must be a non-negative number');
    }
    if (typeof config.thinkTime.average !== 'number' || config.thinkTime.average < 0) {
      errors.push('thinkTime.average must be a non-negative number');
    }
    if (config.thinkTime.min > config.thinkTime.max) {
      errors.push('thinkTime.min cannot be greater than thinkTime.max');
    }
  }

  // Check decisionParams
  if (!config.decisionParams || typeof config.decisionParams !== 'object') {
    errors.push('decisionParams is required and must be an object');
  } else {
    const rates = ['explorationRate', 'randomActionRate', 'mistakeRate', 'blindSpotRate'];
    for (const rate of rates) {
      const val = config.decisionParams[rate];
      if (typeof val !== 'number' || val < 0 || val > 1) {
        errors.push(`decisionParams.${rate} must be a number between 0 and 1`);
      }
    }
  }

  // Check capabilities
  if (!config.capabilities || typeof config.capabilities !== 'object') {
    errors.push('capabilities is required and must be an object');
  } else {
    if (typeof config.capabilities.maxLookAhead !== 'number' || config.capabilities.maxLookAhead < 0) {
      errors.push('capabilities.maxLookAhead must be a non-negative number');
    }
    if (typeof config.capabilities.memoryDepth !== 'number' || config.capabilities.memoryDepth < 0) {
      errors.push('capabilities.memoryDepth must be a non-negative number');
    }
    if (typeof config.capabilities.patternRecognition !== 'boolean') {
      errors.push('capabilities.patternRecognition must be a boolean');
    }
    if (typeof config.capabilities.adaptToPlayer !== 'boolean') {
      errors.push('capabilities.adaptToPlayer must be a boolean');
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  DifficultyLevel,
  DifficultyRank,
  DIFFICULTY_PRESETS,
  getPreset,
  getAllLevels,
  isValidLevel,
  compareLevels,
  interpolateConfigs,
  getFineTunedConfig,
  validateDifficultyConfig
};
