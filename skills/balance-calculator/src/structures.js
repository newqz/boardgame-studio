/**
 * Balance Calculator - Core Data Structures
 * 
 * @version 1.0.0
 */

'use strict';

/**
 * @typedef {'common' | 'uncommon' | 'rare'} Scarcity
 * @typedef {'normal' | 'uniform' | 'skewed'} Distribution
 * @typedef {'high' | 'medium' | 'low'} Significance
 * @typedef {'balanced' | 'needs_adjustment' | 'unbalanced'} BalanceStatus
 */

/**
 * @typedef {Object} ResourceProduction
 * @property {number} averagePerTurn
 * @property {number} variance
 * @property {Distribution} distribution
 */

/**
 * @typedef {Object} ResourceBalance
 * @property {Object.<string, ResourceProduction>} productionRate
 * @property {Object.<string, number>} relativeValue
 * @property {Object.<string, Scarcity>} scarcity
 */

/**
 * @typedef {Object} Strategy
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {number} winRate
 * @property {number} pickRate
 * @property {number} avgGameLength
 */

/**
 * @typedef {Object} WinRateEntry
 * @property {number} vsRandom
 * @property {number} vsAggressive
 * @property {number} vsEconomic
 * @property {number} overall
 */

/**
 * @typedef {Object} StrategyBalance
 * @property {Strategy[]} strategies
 * @property {Object.<string, WinRateEntry>} winRates
 * @property {Object.<string, Object.<string, number>>} correlation
 */

/**
 * @typedef {Object} TimeBalance
 * @property {{min: number, max: number, average: number, median: number}} expectedGameLength
 * @property {Object.<string, {percentageOfGame: number, variance: number}>} phaseDistribution
 * @property {{winRateBonus: number, significance: Significance}} firstPlayerAdvantage
 */

/**
 * @typedef {Object} BalanceReport
 * @property {number} overallScore
 * @property {BalanceStatus} status
 * @property {ResourceBalance} resourceBalance
 * @property {StrategyBalance} strategyBalance
 * @property {TimeBalance} timeBalance
 * @property {string[]} risks
 * @property {string[]} suggestions
 * @property {Object} metadata
 */

module.exports = {
  // Enums for type safety
  Scarcity: Object.freeze({
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare'
  }),

  Distribution: Object.freeze({
    NORMAL: 'normal',
    UNIFORM: 'uniform',
    SKEWED: 'skewed'
  }),

  Significance: Object.freeze({
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
  }),

  BalanceStatus: Object.freeze({
    BALANCED: 'balanced',
    NEEDS_ADJUSTMENT: 'needs_adjustment',
    UNBALANCED: 'unbalanced'
  })
};
