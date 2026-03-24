/**
 * Anti-Cheat Module
 * Server-side input validation and anomaly detection
 * 
 * @version 1.0.0
 */

'use strict';

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether input is valid
 * @property {string} [reason] - Reason if invalid
 * @property {string} [details] - Additional details
 */

/**
 * @typedef {Object} AnomalyReport
 * @property {number} actionsPerMinute - Player's actions per minute
 * @property {string[]} unusualPatterns - Detected unusual patterns
 * @property {number} consistency - Consistency score (0-1)
 * @property {Object} timingAnomalies - Timing-related anomalies
 */

/**
 * @typedef {Object} AntiCheatConfig
 * @property {number} maxActionsPerMinute - Maximum allowed actions per minute
 * @property {number} minActionInterval - Minimum ms between actions
 * @property {boolean} enableTimingCheck - Check for impossible timing
 * @property {number} suspiciousDelayThreshold - Ms delay that's suspicious
 */

const DEFAULT_CONFIG = Object.freeze({
  maxActionsPerMinute: 60,
  minActionInterval: 500,
  enableTimingCheck: true,
  suspiciousDelayThreshold: 100
});

/**
 * Validation error codes
 */
const ValidationError = Object.freeze({
  NOT_PLAYER_TURN: 'not_your_turn',
  INSUFFICIENT_RESOURCES: 'insufficient_resources',
  INVALID_POSITION: 'invalid_position',
  INVALID_ACTION_TYPE: 'invalid_action_type',
  GAME_NOT_IN_PROGRESS: 'game_not_in_progress',
  ACTION_TOO_FAST: 'action_too_fast',
  SUSPICIOUS_TIMING: 'suspicious_timing',
  INVALID_SEED: 'invalid_seed',
  STATE_MISMATCH: 'state_mismatch'
});

class AntiCheat {
  /**
   * Create a new Anti-Cheat validator
   * @param {Object} gameEngine - Game engine with validation methods
   * @param {Object} [config={}] - Configuration
   */
  constructor(gameEngine, config = {}) {
    this.gameEngine = gameEngine;
    this.config = { ...DEFAULT_CONFIG, ...config };

    /** @type {Map<string, number[]>} */
    this.actionTimestamps = new Map();

    /** @type {Map<string, AnomalyReport>} */
    this.playerReports = new Map();

    /** @type {Set<string>} */
    this.bannedPlayers = new Set();

    /** @type {Function|null} */
    this.onAnomalyDetected = null;

    /** @type {Function|null} */
    this.onCheaterDetected = null;
  }

  /**
   * Set callbacks for events
   * @param {Object} callbacks - Event callbacks
   */
  setCallbacks(callbacks) {
    if (callbacks.onAnomalyDetected) {
      this.onAnomalyDetected = callbacks.onAnomalyDetected;
    }
    if (callbacks.onCheaterDetected) {
      this.onCheaterDetected = callbacks.onCheaterDetected;
    }
  }

  /**
   * Validate an input from a player
   * @param {string} playerId - Player ID
   * @param {Object} input - Input/action to validate
   * @param {Object} [gameState] - Current game state (optional, will fetch if not provided)
   * @returns {ValidationResult} Validation result
   */
  validateInput(playerId, input, gameState) {
    // Check if banned
    if (this.bannedPlayers.has(playerId)) {
      return { valid: false, reason: 'player_banned' };
    }

    // Get current state if not provided
    const state = gameState || (this.gameEngine.getState ? this.gameEngine.getState() : this.gameEngine.state);

    // 1. Validate timing (rate limiting)
    const timingResult = this._validateTiming(playerId);
    if (!timingResult.valid) {
      return timingResult;
    }

    // 2. Validate game is in progress
    if (!this._isGameInProgress(state)) {
      return { valid: false, reason: ValidationError.GAME_NOT_IN_PROGRESS };
    }

    // 3. Validate it's this player's turn
    if (!this._isPlayerTurn(playerId, state)) {
      return { valid: false, reason: ValidationError.NOT_PLAYER_TURN };
    }

    // 4. Validate action type is allowed
    if (!this._isValidActionType(input)) {
      return { valid: false, reason: ValidationError.INVALID_ACTION_TYPE };
    }

    // 5. Validate resources
    const resourceResult = this._validateResources(playerId, input, state);
    if (!resourceResult.valid) {
      return resourceResult;
    }

    // 6. Validate position (if applicable)
    if (input.position && !this._isValidPosition(input, state)) {
      return { valid: false, reason: ValidationError.INVALID_POSITION };
    }

    // 7. Validate random seed (if using deterministic randomness)
    if (input.randomSeed && !this._validateSeed(input.randomSeed)) {
      return { valid: false, reason: ValidationError.INVALID_SEED };
    }

    // Record action timestamp
    this._recordAction(playerId);

    return { valid: true };
  }

  /**
   * Validate timing between actions
   * @param {string} playerId - Player ID
   * @returns {ValidationResult}
   * @private
   */
  _validateTiming(playerId) {
    if (!this.config.enableTimingCheck) {
      return { valid: true };
    }

    const now = Date.now();
    const timestamps = this.actionTimestamps.get(playerId) || [];

    // Remove old timestamps (older than 1 minute)
    const cutoff = now - 60000;
    const recentTimestamps = timestamps.filter(t => t > cutoff);
    this.actionTimestamps.set(playerId, recentTimestamps);

    // Check actions per minute
    if (recentTimestamps.length >= this.config.maxActionsPerMinute) {
      this._reportAnomaly(playerId, 'high_action_rate', {
        actionsPerMinute: recentTimestamps.length,
        threshold: this.config.maxActionsPerMinute
      });
      return { valid: false, reason: ValidationError.ACTION_TOO_FAST };
    }

    // Check minimum interval between actions
    if (recentTimestamps.length > 0) {
      const lastAction = Math.max(...recentTimestamps);
      const interval = now - lastAction;

      if (interval < this.config.minActionInterval) {
        return { valid: false, reason: ValidationError.ACTION_TOO_FAST };
      }

      // Suspiciously fast (might be bot)
      if (interval < this.config.suspiciousDelayThreshold) {
        this._reportAnomaly(playerId, 'suspiciously_fast', {
          interval,
          threshold: this.config.suspiciousDelayThreshold
        });
      }
    }

    return { valid: true };
  }

  /**
   * Check if game is in progress
   * @param {Object} state - Game state
   * @returns {boolean}
   * @private
   */
  _isGameInProgress(state) {
    if (!state) return false;
    if (state.phase === 'ended' || state.phase === 'setup') return false;
    return true;
  }

  /**
   * Check if it's a specific player's turn
   * @param {string} playerId - Player ID
   * @param {Object} state - Game state
   * @returns {boolean}
   * @private
   */
  _isPlayerTurn(playerId, state) {
    if (this.gameEngine.isPlayerTurn) {
      return this.gameEngine.isPlayerTurn(playerId, state);
    }
    // Fallback: check currentPlayer field
    return state.currentPlayer === playerId;
  }

  /**
   * Check if action type is valid
   * @param {Object} input - Input to check
   * @returns {boolean}
   * @private
   */
  _isValidActionType(input) {
    if (!input || !input.type) return false;

    // Check against allowed actions
    if (this.gameEngine.getAllowedActions) {
      const allowed = this.gameEngine.getAllowedActions();
      return allowed.includes(input.type);
    }

    // Basic validation - ensure it's a non-empty string
    return typeof input.type === 'string' && input.type.length > 0;
  }

  /**
   * Validate player has required resources
   * @param {string} playerId - Player ID
   * @param {Object} input - Input with resource requirements
   * @param {Object} state - Game state
   * @returns {ValidationResult}
   * @private
   */
  _validateResources(playerId, input, state) {
    if (!input.requiredResources) {
      return { valid: true };
    }

    if (this.gameEngine.hasResources) {
      return this.gameEngine.hasResources(playerId, input.requiredResources, state)
        ? { valid: true }
        : { valid: false, reason: ValidationError.INSUFFICIENT_RESOURCES };
    }

    // Fallback: manual validation
    const player = state.players?.[playerId];
    if (!player || !player.resources) {
      return { valid: true }; // Can't validate, assume ok
    }

    for (const [resource, amount] of Object.entries(input.requiredResources)) {
      if ((player.resources[resource] || 0) < amount) {
        return { valid: false, reason: ValidationError.INSUFFICIENT_RESOURCES };
      }
    }

    return { valid: true };
  }

  /**
   * Validate position is valid
   * @param {Object} input - Input with position
   * @param {Object} state - Game state
   * @returns {boolean}
   * @private
   */
  _isValidPosition(input, state) {
    if (!input.position) return true;

    if (this.gameEngine.isValidPosition) {
      return this.gameEngine.isValidPosition(input.position, state);
    }

    // Basic validation: position should be within bounds
    if (Array.isArray(input.position)) {
      return input.position.every(v => typeof v === 'number' && v >= 0);
    }

    if (typeof input.position === 'object') {
      return Object.values(input.position).every(v => typeof v === 'number');
    }

    return true;
  }

  /**
   * Validate random seed
   * @param {string} seed - Random seed to validate
   * @returns {boolean}
   * @private
   */
  _validateSeed(seed) {
    // If game uses deterministic randomness, validate seed format
    if (this.gameEngine.validateSeed) {
      return this.gameEngine.validateSeed(seed);
    }

    // Basic validation: seed should be a non-empty string
    return typeof seed === 'string' && seed.length > 0;
  }

  /**
   * Record an action timestamp
   * @param {string} playerId - Player ID
   * @private
   */
  _recordAction(playerId) {
    const now = Date.now();
    const timestamps = this.actionTimestamps.get(playerId) || [];
    timestamps.push(now);
    this.actionTimestamps.set(playerId, timestamps);
  }

  /**
   * Report an anomaly
   * @param {string} playerId - Player ID
   * @param {string} type - Anomaly type
   * @param {Object} details - Anomaly details
   * @private
   */
  _reportAnomaly(playerId, type, details) {
    const report = this.getAnomalyReport(playerId);

    if (!report.unusualPatterns.includes(type)) {
      report.unusualPatterns.push(type);
    }

    if (this.onAnomalyDetected) {
      this.onAnomalyDetected(playerId, type, details);
    }
  }

  /**
   * Get comprehensive anomaly report for a player
   * @param {string} playerId - Player ID
   * @returns {AnomalyReport}
   */
  getAnomalyReport(playerId) {
    if (!this.playerReports.has(playerId)) {
      this.playerReports.set(playerId, {
        actionsPerMinute: 0,
        unusualPatterns: [],
        consistency: 1.0,
        timingAnomalies: {}
      });
    }

    const report = this.playerReports.get(playerId);

    // Calculate current APM
    const timestamps = this.actionTimestamps.get(playerId) || [];
    const now = Date.now();
    const cutoff = now - 60000;
    const recentTimestamps = timestamps.filter(t => t > cutoff);
    report.actionsPerMinute = recentTimestamps.length;

    // Calculate consistency score based on action intervals
    if (timestamps.length > 5) {
      const intervals = [];
      const sortedTimestamps = [...timestamps].sort((a, b) => a - b);

      for (let i = 1; i < sortedTimestamps.length; i++) {
        intervals.push(sortedTimestamps[i] - sortedTimestamps[i - 1]);
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) =>
        sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);

      // Low variance = high consistency
      const coefficientOfVariation = stdDev / (avgInterval || 1);
      report.consistency = Math.max(0, 1 - coefficientOfVariation);
    }

    return report;
  }

  /**
   * Check if player should be flagged as suspicious
   * @param {string} playerId - Player ID
   * @returns {boolean}
   */
  isSuspicious(playerId) {
    const report = this.getAnomalyReport(playerId);

    // Flag if:
    // - Has unusual patterns
    // - Very high APM (potential bot)
    // - Very low consistency (highly variable timing)
    return (
      report.unusualPatterns.length > 0 ||
      report.actionsPerMinute > this.config.maxActionsPerMinute * 0.8 ||
      report.consistency < 0.3
    );
  }

  /**
   * Ban a player
   * @param {string} playerId - Player ID
   * @param {string} reason - Reason for ban
   */
  banPlayer(playerId, reason) {
    this.bannedPlayers.add(playerId);

    if (this.onCheaterDetected) {
      this.onCheaterDetected(playerId, reason);
    }
  }

  /**
   * Unban a player
   * @param {string} playerId - Player ID
   */
  unbanPlayer(playerId) {
    this.bannedPlayers.delete(playerId);
  }

  /**
   * Check if player is banned
   * @param {string} playerId - Player ID
   * @returns {boolean}
   */
  isBanned(playerId) {
    return this.bannedPlayers.has(playerId);
  }

  /**
   * Clear player data (timestamps, reports)
   * @param {string} [playerId] - Player ID (omit to clear all)
   */
  clearPlayerData(playerId) {
    if (playerId) {
      this.actionTimestamps.delete(playerId);
      this.playerReports.delete(playerId);
    } else {
      this.actionTimestamps.clear();
      this.playerReports.clear();
    }
  }

  /**
   * Get all flagged players
   * @returns {string[]} List of suspicious player IDs
   */
  getFlaggedPlayers() {
    const flagged = [];
    for (const playerId of this.actionTimestamps.keys()) {
      if (this.isSuspicious(playerId)) {
        flagged.push(playerId);
      }
    }
    return flagged;
  }
}

module.exports = {
  AntiCheat,
  ValidationError,
  DEFAULT_CONFIG
};
