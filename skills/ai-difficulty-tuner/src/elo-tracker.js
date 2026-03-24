/**
 * Player Elo Rating Tracker
 * Tracks player ratings and converts to difficulty levels
 * 
 * @version 1.0.0
 */

'use strict';

const { DifficultyLevel, DifficultyRank } = require('./difficulty-presets');

/**
 * @typedef {Object} EloConfig
 * @property {number} K_FACTOR - K-factor for rating updates
 * @property {number} INITIAL_RATING - Starting rating for new players
 * @property {number} MIN_RATING - Minimum possible rating
 * @property {number} MAX_RATING - Maximum possible rating
 */

/**
 * Default Elo configuration
 */
const DEFAULT_ELO_CONFIG = Object.freeze({
  K_FACTOR: 32,
  INITIAL_RATING: 1200,
  MIN_RATING: 100,
  MAX_RATING: 3000
});

class PlayerEloTracker {
  /**
   * Create a new Elo tracker
   * @param {Object} [config={}] - Elo configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_ELO_CONFIG, ...config };
    /** @type {Map<string, number>} */
    this.ratings = new Map();
    /** @type {Map<string, Object[]>} */
    this.history = new Map();
  }

  /**
   * Get player rating
   * @param {string} playerId - Player identifier
   * @returns {number} Current rating
   */
  getRating(playerId) {
    if (!this.ratings.has(playerId)) {
      return this.config.INITIAL_RATING;
    }
    return this.ratings.get(playerId);
  }

  /**
   * Set player rating directly
   * @param {string} playerId - Player identifier
   * @param {number} rating - New rating
   */
  setRating(playerId, rating) {
    const clampedRating = Math.max(
      this.config.MIN_RATING,
      Math.min(this.config.MAX_RATING, rating)
    );
    this.ratings.set(playerId, clampedRating);
  }

  /**
   * Calculate expected score for a matchup
   * @param {number} playerRating - Player's rating
   * @param {number} opponentRating - Opponent's rating
   * @returns {number} Expected win probability (0-1)
   */
  expectedScore(playerRating, opponentRating) {
    return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  }

  /**
   * Update rating after a game
   * @param {string} playerId - Player identifier
   * @param {number} opponentRating - Opponent's rating
   * @param {number} actualScore - Actual score (1=win, 0.5=draw, 0=loss)
   * @returns {Object} Update result with old and new rating
   */
  updateRating(playerId, opponentRating, actualScore) {
    const oldRating = this.getRating(playerId);
    const expected = this.expectedScore(oldRating, opponentRating);
    const newRating = oldRating + this.config.K_FACTOR * (actualScore - expected);

    this.setRating(playerId, newRating);

    // Record history
    this.recordResult(playerId, {
      opponentRating,
      actualScore,
      expectedScore: expected,
      oldRating,
      newRating,
      timestamp: Date.now()
    });

    return {
      oldRating,
      newRating,
      change: newRating - oldRating
    };
  }

  /**
   * Record a result in player history
   * @param {string} playerId - Player identifier
   * @param {Object} result - Game result
   */
  recordResult(playerId, result) {
    if (!this.history.has(playerId)) {
      this.history.set(playerId, []);
    }
    this.history.get(playerId).push(result);

    // Keep only last 100 games
    const history = this.history.get(playerId);
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get player game history
   * @param {string} playerId - Player identifier
   * @param {number} [limit] - Maximum number of games to return
   * @returns {Object[]} Game history
   */
  getHistory(playerId, limit) {
    const history = this.history.get(playerId) || [];
    if (limit) {
      return history.slice(-limit);
    }
    return [...history];
  }

  /**
   * Convert rating to difficulty level
   * @param {number} rating - Player rating
   * @returns {DifficultyLevel} Corresponding difficulty level
   */
  ratingToDifficulty(rating) {
    if (rating < 1000) return DifficultyLevel.TUTORIAL;
    if (rating < 1100) return DifficultyLevel.EASY;
    if (rating < 1300) return DifficultyLevel.MEDIUM;
    if (rating < 1500) return DifficultyLevel.HARD;
    if (rating < 1700) return DifficultyLevel.EXPERT;
    return DifficultyLevel.UNBEATABLE;
  }

  /**
   * Convert difficulty level to rating
   * @param {DifficultyLevel} level - Difficulty level
   * @returns {number} Approximate rating for that level
   */
  difficultyToRating(level) {
    const ratingMap = {
      [DifficultyLevel.TUTORIAL]: 900,
      [DifficultyLevel.EASY]: 1050,
      [DifficultyLevel.MEDIUM]: 1200,
      [DifficultyLevel.HARD]: 1400,
      [DifficultyLevel.EXPERT]: 1600,
      [DifficultyLevel.UNBEATABLE]: 1900
    };
    return ratingMap[level] || 1200;
  }

  /**
   * Calculate optimal difficulty for target win rate
   * @param {number} playerRating - Player rating
   * @param {number} targetWinRate - Target win rate (0-1)
   * @returns {DifficultyLevel} Recommended difficulty level
   */
  calculateOptimalDifficulty(playerRating, targetWinRate) {
    // Target win rate 40-60% = difficulty well matched
    // Target win rate 30-40% = slightly harder
    // Target win rate 60-70% = slightly easier

    // Convert target win rate to Elo difference
    // If target is 0.5, diff is 0
    // If target is 0.4, diff is ~75 (AI should be stronger)
    // If target is 0.6, diff is ~-75 (AI should be weaker)

    const targetDiff = (0.5 - targetWinRate) * 400;
    const optimalRating = playerRating + targetDiff;

    return this.ratingToDifficulty(optimalRating);
  }

  /**
   * Get player's estimated skill level description
   * @param {string} playerId - Player identifier
   * @returns {string} Skill description
   */
  getSkillDescription(playerId) {
    const rating = this.getRating(playerId);
    const level = this.ratingToDifficulty(rating);

    const descriptions = {
      [DifficultyLevel.TUTORIAL]: 'Beginner - Learning the basics',
      [DifficultyLevel.EASY]: 'Novice - Some game experience',
      [DifficultyLevel.MEDIUM]: 'Intermediate - Competent player',
      [DifficultyLevel.HARD]: 'Advanced - Skilled player',
      [DifficultyLevel.EXPERT]: 'Expert - Very skilled',
      [DifficultyLevel.UNBEATABLE]: 'Master - Exceptional player'
    };

    return `${descriptions[level]} (Rating: ${rating})`;
  }

  /**
   * Reset player rating
   * @param {string} playerId - Player identifier
   */
  resetRating(playerId) {
    this.ratings.delete(playerId);
    this.history.delete(playerId);
  }

  /**
   * Get statistics for a player
   * @param {string} playerId - Player identifier
   * @returns {Object} Player statistics
   */
  getStats(playerId) {
    const history = this.getHistory(playerId);
    const rating = this.getRating(playerId);

    if (history.length === 0) {
      return {
        rating,
        gamesPlayed: 0,
        winRate: 0,
        avgChange: 0
      };
    }

    const wins = history.filter(h => h.actualScore === 1).length;
    const draws = history.filter(h => h.actualScore === 0.5).length;
    const losses = history.filter(h => h.actualScore === 0).length;

    const totalChange = history.reduce((sum, h) => sum + (h.newRating - h.oldRating), 0);

    return {
      rating,
      gamesPlayed: history.length,
      wins,
      draws,
      losses,
      winRate: wins / history.length,
      drawRate: draws / history.length,
      lossRate: losses / history.length,
      avgChange: totalChange / history.length,
      currentDifficulty: this.ratingToDifficulty(rating)
    };
  }
}

module.exports = {
  PlayerEloTracker,
  DEFAULT_ELO_CONFIG
};
