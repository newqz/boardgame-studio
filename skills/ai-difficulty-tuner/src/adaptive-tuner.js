/**
 * Adaptive Difficulty Tuner
 * Analyzes player performance and adjusts AI difficulty dynamically
 * 
 * @version 1.0.0
 */

'use strict';

const { DifficultyLevel, DifficultyRank, getPreset, compareLevels } = require('./difficulty-presets');
const { PlayerEloTracker } = require('./elo-tracker');

/**
 * @typedef {'improving' | 'stable' | 'declining'} PerformanceTrend
 */

/**
 * @typedef {Object} PerformanceMetrics
 * @property {number} winRate - Win rate (0-1)
 * @property {number} avgTurnQuality - Average turn quality score
 * @property {number} mistakesPerGame - Average mistakes per game
 * @property {PerformanceTrend} trend - Performance trend
 * @property {number} gamesPlayed - Number of games analyzed
 */

/**
 * @typedef {Object} AdjustmentDecision
 * @property {boolean} adjust - Whether to adjust difficulty
 * @property {'up' | 'down' | 'none'} direction - Direction of adjustment
 * @property {number} magnitude - How much to adjust (in levels)
 * @property {string} reason - Reason for adjustment
 */

/**
 * @typedef {Object} GameResult
 * @property {boolean} won - Whether player won
 * @property {number} turnQuality - Average turn quality (0-1)
 * @property {number} mistakes - Number of mistakes made
 * @property {string[]} strategies - Strategies used
 * @property {number} duration - Game duration in seconds
 */

/**
 * Performance thresholds configuration
 */
const DEFAULT_THRESHOLDS = Object.freeze({
  WIN_STREAK_THRESHOLD: 3,      // Consecutive wins to trigger increase
  LOSS_STREAK_THRESHOLD: 3,     // Consecutive losses to trigger decrease
  LOW_WIN_RATE: 0.25,           // Win rate below = too hard
  HIGH_WIN_RATE: 0.75,          // Win rate above = too easy
  TARGET_WIN_RATE_MIN: 0.40,    // Target win rate range minimum
  TARGET_WIN_RATE_MAX: 0.60,    // Target win rate range maximum
  MIN_GAMES_FOR_ADJUSTMENT: 3,  // Minimum games before adjustment
  TREND_WINDOW: 5               // Games to analyze for trend
});

class AdaptiveDifficultyTuner {
  /**
   * Create a new Adaptive Difficulty Tuner
   * @param {Object} [options={}] - Configuration options
   */
  constructor(options = {}) {
    this.eloTracker = new PlayerEloTracker();
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
    /** @type {Map<string, GameResult[]>} */
    this.gameResults = new Map();
    /** @type {Map<string, number>} */
    this.currentDifficulty = new Map();
    /** @type {Object[]} */
    this.adjustmentHistory = [];
  }

  /**
   * Get or initialize player data
   * @param {string} playerId - Player identifier
   * @returns {Object} Player data
   */
  getPlayerData(playerId) {
    if (!this.gameResults.has(playerId)) {
      this.gameResults.set(playerId, []);
    }
    if (!this.currentDifficulty.has(playerId)) {
      this.currentDifficulty.set(playerId, DifficultyLevel.MEDIUM);
    }
    return {
      results: this.gameResults.get(playerId),
      difficulty: this.currentDifficulty.get(playerId),
      rating: this.eloTracker.getRating(playerId)
    };
  }

  /**
   * Record a game result
   * @param {string} playerId - Player identifier
   * @param {GameResult} result - Game result
   */
  recordResult(playerId, result) {
    const data = this.getPlayerData(playerId);
    data.results.push(result);

    // Keep only last 50 games
    if (data.results.length > 50) {
      data.results.shift();
    }

    // Update Elo rating (assume AI is at 1200 baseline)
    const aiRating = 1200;
    const actualScore = result.won ? 1 : 0;
    this.eloTracker.updateRating(playerId, aiRating, actualScore);
  }

  /**
   * Analyze player performance over recent games
   * @param {string} playerId - Player identifier
   * @param {number} [windowSize] - Number of games to analyze
   * @returns {PerformanceMetrics} Performance metrics
   */
  analyzePerformance(playerId, windowSize) {
    const data = this.getPlayerData(playerId);
    const window = windowSize || this.thresholds.TREND_WINDOW;
    const recentResults = data.results.slice(-window);

    if (recentResults.length === 0) {
      return {
        winRate: 0.5,
        avgTurnQuality: 0.5,
        mistakesPerGame: 0,
        trend: 'stable',
        gamesPlayed: 0
      };
    }

    const wins = recentResults.filter(r => r.won).length;
    const winRate = wins / recentResults.length;
    const avgTurnQuality = recentResults.reduce((sum, r) => sum + (r.turnQuality || 0.5), 0) / recentResults.length;
    const avgMistakes = recentResults.reduce((sum, r) => sum + (r.mistakes || 0), 0) / recentResults.length;

    // Calculate trend
    const trend = this.calculateTrend(recentResults);

    return {
      winRate,
      avgTurnQuality,
      mistakesPerGame: avgMistakes,
      trend,
      gamesPlayed: recentResults.length
    };
  }

  /**
   * Calculate performance trend
   * @param {GameResult[]} results - Game results
   * @returns {PerformanceTrend} Performance trend
   */
  calculateTrend(results) {
    if (results.length < 3) {
      return 'stable';
    }

    // Compare first half to second half
    const halfLength = Math.floor(results.length / 2);
    const firstHalf = results.slice(0, halfLength);
    const secondHalf = results.slice(halfLength);

    const firstHalfWins = firstHalf.filter(r => r.won).length;
    const secondHalfWins = secondHalf.filter(r => r.won).length;

    const firstHalfRate = firstHalfWins / firstHalf.length;
    const secondHalfRate = secondHalfWins / secondHalf.length;

    const diff = secondHalfRate - firstHalfRate;

    if (diff > 0.15) return 'improving';
    if (diff < -0.15) return 'declining';
    return 'stable';
  }

  /**
   * Determine if difficulty should be adjusted
   * @param {string} playerId - Player identifier
   * @returns {AdjustmentDecision} Adjustment decision
   */
  shouldAdjustDifficulty(playerId) {
    const data = this.getPlayerData(playerId);
    const metrics = this.analyzePerformance(playerId);
    const { winRate, trend } = metrics;

    // Not enough data
    if (metrics.gamesPlayed < this.thresholds.MIN_GAMES_FOR_ADJUSTMENT) {
      return { adjust: false, direction: 'none', magnitude: 0, reason: 'Insufficient game data' };
    }

    // Check for consecutive patterns
    const recentResults = data.results.slice(-this.thresholds.TREND_WINDOW);
    const winStreak = this.countConsecutiveStreak(recentResults, true);
    const lossStreak = this.countConsecutiveStreak(recentResults, false);

    // Player on a winning streak and winning too much
    if (winStreak >= this.thresholds.WIN_STREAK_THRESHOLD && winRate > this.thresholds.HIGH_WIN_RATE) {
      return {
        adjust: true,
        direction: 'up',
        magnitude: 1,
        reason: `Winning streak of ${winStreak} with ${Math.round(winRate * 100)}% win rate`
      };
    }

    // Player on a losing streak and losing too much
    if (lossStreak >= this.thresholds.LOSS_STREAK_THRESHOLD && winRate < this.thresholds.LOW_WIN_RATE) {
      return {
        adjust: true,
        direction: 'down',
        magnitude: 1,
        reason: `Losing streak of ${lossStreak} with ${Math.round(winRate * 100)}% win rate`
      };
    }

    // Win rate too low for extended period
    if (winRate < this.thresholds.LOW_WIN_RATE && trend === 'declining') {
      return {
        adjust: true,
        direction: 'down',
        magnitude: 1,
        reason: 'Performance declining with low win rate'
      };
    }

    // Win rate too high for extended period
    if (winRate > this.thresholds.HIGH_WIN_RATE && trend === 'improving') {
      return {
        adjust: true,
        direction: 'up',
        magnitude: 1,
        reason: 'Performance improving with high win rate'
      };
    }

    // Win rate in target range - no adjustment needed
    if (winRate >= this.thresholds.TARGET_WIN_RATE_MIN && winRate <= this.thresholds.TARGET_WIN_RATE_MAX) {
      return { adjust: false, direction: 'none', magnitude: 0, reason: 'Win rate in target range' };
    }

    return { adjust: false, direction: 'none', magnitude: 0, reason: 'No significant imbalance detected' };
  }

  /**
   * Count consecutive win/loss streak
   * @param {GameResult[]} results - Game results
   * @param {boolean} wins - Count wins if true, losses if false
   * @returns {number} Streak count
   */
  countConsecutiveStreak(results, wins) {
    let streak = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i].won === wins) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  /**
   * Calculate optimal difficulty based on player rating and target win rate
   * @param {string} playerId - Player identifier
   * @param {number} [targetWinRate=0.5] - Target win rate
   * @returns {DifficultyLevel} Optimal difficulty level
   */
  calculateOptimalDifficulty(playerId, targetWinRate = 0.5) {
    const rating = this.eloTracker.getRating(playerId);
    return this.eloTracker.calculateOptimalDifficulty(rating, targetWinRate);
  }

  /**
   * Get current AI difficulty for a player
   * @param {string} playerId - Player identifier
   * @returns {DifficultyLevel} Current difficulty level
   */
  getCurrentDifficulty(playerId) {
    return this.currentDifficulty.get(playerId) || DifficultyLevel.MEDIUM;
  }

  /**
   * Set AI difficulty for a player
   * @param {string} playerId - Player identifier
   * @param {DifficultyLevel} level - New difficulty level
   */
  setDifficulty(playerId, level) {
    this.currentDifficulty.set(playerId, level);
  }

  /**
   * Smoothly transition difficulty over time
   * @param {string} playerId - Player identifier
   * @param {DifficultyLevel} targetLevel - Target difficulty
   * @param {number} [transitionSpeed=0.5] - Transition speed (0-1)
   * @returns {DifficultyLevel} New difficulty after transition
   */
  smoothTransition(playerId, targetLevel, transitionSpeed = 0.5) {
    const currentLevel = this.getCurrentDifficulty(playerId);
    const diff = DifficultyRank[targetLevel] - DifficultyRank[currentLevel];

    // Small difference - just transition directly
    if (Math.abs(diff) <= 1) {
      this.setDifficulty(playerId, targetLevel);
      return targetLevel;
    }

    // Calculate gradual transition
    const step = Math.ceil(Math.abs(diff) * transitionSpeed);
    let newLevel;

    if (diff > 0) {
      newLevel = DifficultyRank[currentLevel] + step;
    } else {
      newLevel = DifficultyRank[currentLevel] - step;
    }

    // Clamp to valid range
    newLevel = Math.max(0, Math.min(5, newLevel));
    const levels = Object.values(DifficultyLevel);
    const newDifficulty = levels[newLevel];

    this.setDifficulty(playerId, newDifficulty);
    return newDifficulty;
  }

  /**
   * Get difficulty config for a player
   * @param {string} playerId - Player identifier
   * @returns {Object} Full difficulty configuration
   */
  getDifficultyConfig(playerId) {
    const level = this.getCurrentDifficulty(playerId);
    return getPreset(level);
  }

  /**
   * Get full analysis for a player
   * @param {string} playerId - Player identifier
   * @returns {Object} Complete analysis
   */
  getFullAnalysis(playerId) {
    const data = this.getPlayerData(playerId);
    const metrics = this.analyzePerformance(playerId);
    const adjustment = this.shouldAdjustDifficulty(playerId);
    const optimalDifficulty = this.calculateOptimalDifficulty(playerId);
    const currentConfig = this.getDifficultyConfig(playerId);

    return {
      playerId,
      currentDifficulty: data.difficulty,
      currentConfig,
      optimalDifficulty,
      metrics,
      adjustment,
      recommendation: this.generateRecommendation(adjustment, data.difficulty, optimalDifficulty),
      stats: this.eloTracker.getStats(playerId)
    };
  }

  /**
   * Generate a recommendation based on adjustment decision
   * @param {AdjustmentDecision} adjustment - Adjustment decision
   * @param {DifficultyLevel} current - Current difficulty
   * @param {DifficultyLevel} optimal - Optimal difficulty
   * @returns {string} Human-readable recommendation
   */
  generateRecommendation(adjustment, current, optimal) {
    if (!adjustment.adjust) {
      return `Current difficulty (${current}) is appropriate. ${adjustment.reason}.`;
    }

    if (adjustment.direction === 'up') {
      return `Increase difficulty from ${current} to ${optimal}. ${adjustment.reason}.`;
    }

    if (adjustment.direction === 'down') {
      return `Decrease difficulty from ${current} to ${optimal}. ${adjustment.reason}.`;
    }

    return 'No change recommended.';
  }
}

module.exports = {
  AdaptiveDifficultyTuner,
  DEFAULT_THRESHOLDS
};
