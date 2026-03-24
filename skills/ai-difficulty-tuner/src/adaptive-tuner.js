/**
 * Adaptive Difficulty Tuner
 * Analyzes player performance and adjusts AI difficulty dynamically
 *
 * @version 2.0.0 - Enhanced with oscillation prevention and gradual recovery
 */

'use strict';

const { DifficultyLevel, DifficultyRank, getPreset, getFineTunedConfig, compareLevels } = require('./difficulty-presets');
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
 * @property {number} performanceScore - Computed performance score (-1 to 1)
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
  TREND_WINDOW: 5,              // Games to analyze for trend
  ADJUSTMENT_COOLDOWN: 3,       // Games to wait after adjustment
  OSCILLATION_THRESHOLD: 2      // Max direction changes in window to prevent oscillation
});

class AdaptiveDifficultyTuner {
  /**
   * Create a new Adaptive Difficulty Tuner
   * @param {Object} [options={}] - Configuration options
   */
  constructor(options = {}) {
    this.eloTracker = new PlayerEloTracker();
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };

    // Memory management - configurable limits
    this.maxHistorySize = options.maxHistorySize || 1000;  // Max games per player
    this.maxAdjustmentHistory = options.maxAdjustmentHistory || 100;  // Max adjustment records
    this.maxMetricsHistory = options.maxMetricsHistory || 100;  // Max metrics snapshots

    /** @type {Map<string, GameResult[]>} */
    this.gameResults = new Map();
    /** @type {Map<string, number>} */
    this.currentDifficulty = new Map();
    /** @type {Object[]} */
    this.adjustmentHistory = [];
    /** @type {Map<string, number>} */
    this.adjustmentCooldown = new Map();      // Games remaining before next adjustment
    /** @type {Map<string, number>} */
    this.lastAdjustmentDirection = new Map();   // Track last adjustment direction for oscillation
    /** @type {Map<string, {direction: string, count: number}[]>} */
    this.adjustmentOscillation = new Map();    // Track oscillation patterns

    // Telemetry and event hooks
    /** @type {Object[]} */
    this.changeCallbacks = [];
    /** @type {Object[]} */
    this.metricsHistory = [];
    /** @type {Object} */
    this.stats = {
      totalAdjustments: 0,
      oscillationsDetected: 0,
      cooldownsTriggered: 0,
      averagePerformanceScore: 0
    };
    /** @type {Date|null} */
    this.lastUpdateTime = null;

    // Rate limiting
    this.rateLimiter = {
      lastUpdate: 0,
      minInterval: options.minUpdateInterval || 100  // Minimum ms between updates
    };
  }

  /**
   * Check if rate limit allows update
   * @returns {boolean} True if update is allowed
   */
  canUpdate() {
    const now = Date.now();
    if (now - this.rateLimiter.lastUpdate < this.rateLimiter.minInterval) {
      return false;
    }
    this.rateLimiter.lastUpdate = now;
    return true;
  }

  /**
   * Prune old entries from history arrays to prevent memory growth
   * @private
   */
  _pruneHistory() {
    // Prune adjustment history
    while (this.adjustmentHistory.length > this.maxAdjustmentHistory) {
      this.adjustmentHistory.shift();
    }

    // Prune metrics history
    while (this.metricsHistory.length > this.maxMetricsHistory) {
      this.metricsHistory.shift();
    }

    // Prune per-player game results
    for (const [playerId, results] of this.gameResults) {
      while (results.length > this.maxHistorySize) {
        results.shift();
      }
      // Clean up empty player data
      if (results.length === 0 && !this.currentDifficulty.has(playerId)) {
        this.gameResults.delete(playerId);
        this.adjustmentCooldown.delete(playerId);
        this.lastAdjustmentDirection.delete(playerId);
        this.adjustmentOscillation.delete(playerId);
      }
    }
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
    // Check rate limit
    if (!this.canUpdate()) {
      console.warn('Rate limit exceeded, skipping update');
      return false;
    }

    const data = this.getPlayerData(playerId);
    data.results.push(result);

    // Use configurable max history size
    while (data.results.length > this.maxHistorySize) {
      data.results.shift();
    }

    // Update Elo rating (assume AI is at 1200 baseline)
    const aiRating = 1200;
    const actualScore = result.won ? 1 : 0;
    this.eloTracker.updateRating(playerId, aiRating, actualScore);

    // Decrement cooldown if active
    if (this.adjustmentCooldown.has(playerId) && this.adjustmentCooldown.get(playerId) > 0) {
      this.adjustmentCooldown.set(playerId, this.adjustmentCooldown.get(playerId) - 1);
    }

    // Periodic memory cleanup (every 10 updates)
    if (this.stats.totalAdjustments % 10 === 0) {
      this._pruneHistory();
    }

    return true;
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
        gamesPlayed: 0,
        performanceScore: 0
      };
    }

    const wins = recentResults.filter(r => r.won).length;
    const winRate = wins / recentResults.length;
    const avgTurnQuality = recentResults.reduce((sum, r) => sum + (r.turnQuality || 0.5), 0) / recentResults.length;
    const avgMistakes = recentResults.reduce((sum, r) => sum + (r.mistakes || 0), 0) / recentResults.length;

    // Calculate trend
    const trend = this.calculateTrend(recentResults);

    // Calculate performance score (-1 to 1)
    // Based on win rate relative to target (50%) and trend
    const targetWinRate = 0.5;
    const winRateDeviation = winRate - targetWinRate;
    const trendBonus = trend === 'improving' ? 0.1 : trend === 'declining' ? -0.1 : 0;
    const performanceScore = Math.max(-1, Math.min(1, winRateDeviation * 2 + trendBonus));

    return {
      winRate,
      avgTurnQuality,
      mistakesPerGame: avgMistakes,
      trend,
      gamesPlayed: recentResults.length,
      performanceScore
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

    // Check cooldown - if locked, don't adjust
    if (this.adjustmentCooldown.has(playerId) && this.adjustmentCooldown.get(playerId) > 0) {
      return { adjust: false, direction: 'none', magnitude: 0, reason: 'Difficulty adjustment on cooldown' };
    }

    // Check for oscillation pattern
    if (this.isOscillating(playerId)) {
      this._recordOscillation();
      return { adjust: false, direction: 'none', magnitude: 0, reason: 'Oscillation detected - difficulty locked' };
    }

    // Check for consecutive patterns
    const recentResults = data.results.slice(-this.thresholds.TREND_WINDOW);
    const winStreak = this.countConsecutiveStreak(recentResults, true);
    const lossStreak = this.countConsecutiveStreak(recentResults, false);

    // Player on a winning streak and winning too much
    if (winStreak >= this.thresholds.WIN_STREAK_THRESHOLD && winRate > this.thresholds.HIGH_WIN_RATE) {
      this.recordAdjustmentDirection(playerId, 'up');
      return {
        adjust: true,
        direction: 'up',
        magnitude: 1,
        reason: `Winning streak of ${winStreak} with ${Math.round(winRate * 100)}% win rate`
      };
    }

    // Player on a losing streak and losing too much
    if (lossStreak >= this.thresholds.LOSS_STREAK_THRESHOLD && winRate < this.thresholds.LOW_WIN_RATE) {
      this.recordAdjustmentDirection(playerId, 'down');
      return {
        adjust: true,
        direction: 'down',
        magnitude: 1,
        reason: `Losing streak of ${lossStreak} with ${Math.round(winRate * 100)}% win rate`
      };
    }

    // Win rate too low for extended period
    if (winRate < this.thresholds.LOW_WIN_RATE && trend === 'declining') {
      this.recordAdjustmentDirection(playerId, 'down');
      return {
        adjust: true,
        direction: 'down',
        magnitude: 1,
        reason: 'Performance declining with low win rate'
      };
    }

    // Win rate too high for extended period
    if (winRate > this.thresholds.HIGH_WIN_RATE && trend === 'improving') {
      this.recordAdjustmentDirection(playerId, 'up');
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
   * Check if difficulty is oscillating (rapid up/down switches)
   * @param {string} playerId - Player identifier
   * @returns {boolean} True if oscillating
   */
  isOscillating(playerId) {
    const recent = this.adjustmentHistory.slice(-this.thresholds.TREND_WINDOW);
    if (recent.length < 3) return false;

    // Count direction changes
    let changes = 0;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].direction !== recent[i - 1].direction) {
        changes++;
      }
    }

    return changes >= this.thresholds.OSCILLATION_THRESHOLD;
  }

  /**
   * Record adjustment direction for oscillation tracking
   * @param {string} playerId - Player identifier
   * @param {string} direction - 'up' or 'down'
   */
  recordAdjustmentDirection(playerId, direction) {
    // Record in history
    this.adjustmentHistory.push({
      playerId,
      direction,
      timestamp: Date.now()
    });

    // Keep only last 20 adjustments
    if (this.adjustmentHistory.length > 20) {
      this.adjustmentHistory.shift();
    }

    // Set cooldown
    this.adjustmentCooldown.set(playerId, this.thresholds.ADJUSTMENT_COOLDOWN);
    this.lastAdjustmentDirection.set(playerId, direction);

    // Record telemetry
    this._recordCooldownTriggered();
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
   * @param {boolean} [useFineTuning=true] - Whether to apply fine-tuning based on performance
   * @returns {Object} Full difficulty configuration
   */
  getDifficultyConfig(playerId, useFineTuning = true) {
    const level = this.getCurrentDifficulty(playerId);

    if (!useFineTuning) {
      return getPreset(level);
    }

    // Apply fine-tuning based on recent performance
    const metrics = this.analyzePerformance(playerId);

    // If in cooldown, use slightly more conservative settings
    const cooldownActive = this.adjustmentCooldown.has(playerId) && this.adjustmentCooldown.get(playerId) > 0;

    if (cooldownActive && metrics.performanceScore !== 0) {
      // During cooldown, gradually return to base level
      const cooldownRatio = this.adjustmentCooldown.get(playerId) / this.thresholds.ADJUSTMENT_COOLDOWN;
      const adjustedScore = metrics.performanceScore * cooldownRatio;
      return getFineTunedConfig(level, adjustedScore);
    }

    // Normal operation - use performance-based fine-tuning
    return getFineTunedConfig(level, metrics.performanceScore);
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

  /**
   * Register a callback for difficulty change events
   * @param {Function} callback - Function to call on difficulty change
   */
  onDifficultyChange(callback) {
    if (typeof callback === 'function') {
      this.changeCallbacks.push(callback);
    }
  }

  /**
   * Emit difficulty change event to all registered callbacks
   * @param {Object} event - Event data
   * @param {string} event.playerId - Player ID
   * @param {string} event.fromLevel - Previous level
   * @param {string} event.toLevel - New level
   * @param {string} event.direction - 'up' or 'down'
   * @param {Object} event.metrics - Performance metrics at time of change
   */
  emitDifficultyChange(event) {
    for (const callback of this.changeCallbacks) {
      try {
        callback(event);
      } catch (err) {
        console.error('Error in difficulty change callback:', err);
      }
    }
  }

  /**
   * Get telemetry metrics for monitoring
   * @returns {Object} Telemetry data
   */
  getMetrics() {
    // Calculate average performance score across all players
    let totalScore = 0;
    let playerCount = 0;

    for (const [playerId] of this.gameResults) {
      const metrics = this.analyzePerformance(playerId);
      totalScore += metrics.performanceScore;
      playerCount++;
    }

    const avgScore = playerCount > 0 ? totalScore / playerCount : 0;

    // Count difficulty distribution
    const difficultyDistribution = {};
    for (const level of Object.values(DifficultyLevel)) {
      difficultyDistribution[level] = 0;
    }
    for (const [, level] of this.currentDifficulty) {
      difficultyDistribution[level] = (difficultyDistribution[level] || 0) + 1;
    }

    return {
      totalPlayersTracked: this.gameResults.size,
      totalAdjustments: this.stats.totalAdjustments,
      oscillationsDetected: this.stats.oscillationsDetected,
      cooldownsTriggered: this.stats.cooldownsTriggered,
      averagePerformanceScore: avgScore,
      difficultyDistribution,
      lastUpdateTime: this.lastUpdateTime
    };
  }

  /**
   * Get health status for monitoring
   * @returns {Object} Health status
   */
  getHealthStatus() {
    const recentErrors = []; // Placeholder for error tracking

    // Check for oscillating players
    let oscillatingPlayers = 0;
    for (const [playerId] of this.gameResults) {
      if (this.isOscillating(playerId)) {
        oscillatingPlayers++;
      }
    }

    const isHealthy = oscillatingPlayers === 0 && recentErrors.length === 0;

    return {
      isHealthy,
      status: isHealthy ? 'healthy' : 'degraded',
      checks: {
        noOscillations: oscillatingPlayers === 0,
        noErrors: recentErrors.length === 0,
        playersTracked: this.gameResults.size > 0
      },
      details: {
        oscillatingPlayers,
        recentErrorCount: recentErrors.length,
        playersTracked: this.gameResults.size,
        uptime: this.lastUpdateTime ? Date.now() - this.lastUpdateTime.getTime() : null
      }
    };
  }

  /**
   * Record a difficulty adjustment and emit event
   * @param {string} playerId - Player ID
   * @param {string} fromLevel - Previous level
   * @param {string} toLevel - New level
   * @param {string} direction - 'up' or 'down'
   * @private
   */
  _recordAdjustment(playerId, fromLevel, toLevel, direction) {
    this.stats.totalAdjustments++;
    this.lastUpdateTime = new Date();

    // Record in history
    this.adjustmentHistory.push({
      playerId,
      fromLevel,
      toLevel,
      direction,
      timestamp: Date.now()
    });

    // Keep only last 20 adjustments
    if (this.adjustmentHistory.length > 20) {
      this.adjustmentHistory.shift();
    }

    // Emit event
    const metrics = this.analyzePerformance(playerId);
    this.emitDifficultyChange({
      playerId,
      fromLevel,
      toLevel,
      direction,
      metrics
    });
  }

  /**
   * Record that oscillation was detected
   * @private
   */
  _recordOscillation() {
    this.stats.oscillationsDetected++;
  }

  /**
   * Record that cooldown was triggered
   * @private
   */
  _recordCooldownTriggered() {
    this.stats.cooldownsTriggered++;
  }

  /**
   * Reset all telemetry data
   */
  resetMetrics() {
    this.stats = {
      totalAdjustments: 0,
      oscillationsDetected: 0,
      cooldownsTriggered: 0,
      averagePerformanceScore: 0
    };
    this.metricsHistory = [];
    this.adjustmentHistory = [];
    this.lastUpdateTime = null;
  }
}

module.exports = {
  AdaptiveDifficultyTuner,
  DEFAULT_THRESHOLDS
};
