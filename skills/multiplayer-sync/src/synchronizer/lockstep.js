/**
 * Lockstep Synchronizer
 * Synchronous turn-based multiplayer synchronization
 * 
 * @version 1.0.0
 */

'use strict';

/**
 * @typedef {Object} PlayerInput
 * @property {string} playerId - Player identifier
 * @property {Object} input - Input/action data
 * @property {number} timestamp - Submission timestamp
 */

/**
 * @typedef {Object} TurnResult
 * @property {number} turn - Turn number executed
 * @property {Object} state - Game state after turn
 * @property {PlayerInput[]} inputs - All inputs executed
 */

/**
 * @typedef {Object} LockstepConfig
 * @property {number} turnTimeout - Ms to wait before timeout
 * @property {boolean} allowLateJoin - Allow players to join mid-game
 * @property {number} maxBufferedTurns - Max turns to buffer for late joiners
 */

const DEFAULT_CONFIG = Object.freeze({
  turnTimeout: 30000,       // 30 seconds per turn
  allowLateJoin: false,
  maxBufferedTurns: 10
});

class LockstepSynchronizer {
  /**
   * Create a new Lockstep Synchronizer
   * @param {Object} gameEngine - Game engine with applyInput method
   * @param {Object} [config={}] - Configuration
   */
  constructor(gameEngine, config = {}) {
    this.gameEngine = gameEngine;
    this.config = { ...DEFAULT_CONFIG, ...config };

    /** @type {number} */
    this.currentTurn = 0;

    /** @type {Map<number, PlayerInput[]>} */
    this.pendingInputs = new Map();

    /** @type {PlayerInput[]} */
    this.confirmedInputs = [];

    /** @type {Set<string>} */
    this.playerIds = new Set();

    /** @type {Map<string, NodeJS.Timeout>} */
    this.turnTimeouts = new Map();

    /** @type {Function|null} */
    this.broadcastCallback = null;

    /** @type {TurnResult[]} */
    this.turnHistory = [];

    /** @type {boolean} */
    this.waitingForInputs = false;

    /** @type {string|null} */
    this.currentPhase = 'input'; // 'input' | 'execution' | 'broadcast'
  }

  /**
   * Set broadcast callback for network communication
   * @param {Function} callback - Function to call with broadcast messages
   */
  setBroadcastCallback(callback) {
    this.broadcastCallback = callback;
  }

  /**
   * Register players for the game
   * @param {string[]} playerIds - List of player IDs
   */
  registerPlayers(playerIds) {
    for (const id of playerIds) {
      this.playerIds.add(id);
    }
  }

  /**
   * Add a player to the game
   * @param {string} playerId - Player ID to add
   */
  addPlayer(playerId) {
    this.playerIds.add(playerId);
  }

  /**
   * Remove a player from the game
   * @param {string} playerId - Player ID to remove
   */
  removePlayer(playerId) {
    this.playerIds.delete(playerId);
  }

  /**
   * Get number of players
   * @returns {number}
   */
  get playerCount() {
    return this.playerIds.size;
  }

  /**
   * Submit an input from a player
   * @param {string} playerId - Player submitting input
   * @param {Object} input - Input/action data
   * @returns {Object} Result with success status and turn info
   */
  submitInput(playerId, input) {
    if (!this.playerIds.has(playerId)) {
      return { success: false, error: 'player_not_found' };
    }

    if (this.waitingForInputs) {
      const turnInputs = this.pendingInputs.get(this.currentTurn) || [];

      // Check if player already submitted
      if (turnInputs.some(i => i.playerId === playerId)) {
        return { success: false, error: 'already_submitted' };
      }

      const playerInput = {
        playerId,
        input,
        timestamp: Date.now()
      };

      turnInputs.push(playerInput);
      this.pendingInputs.set(this.currentTurn, turnInputs);

      // Broadcast input received
      this._broadcast('input_received', {
        playerId,
        turn: this.currentTurn,
        inputCount: turnInputs.length
      });

      // Check if all inputs received
      if (turnInputs.length >= this.playerCount) {
        this._executeTurn(this.currentTurn);
      } else {
        // Start/replace turn timeout
        this._startTurnTimeout();
      }

      return { success: true, turn: this.currentTurn, inputCount: turnInputs.length };
    } else {
      return { success: false, error: 'not_accepting_inputs' };
    }
  }

  /**
   * Get current turn status
   * @returns {Object} Turn status
   */
  getTurnStatus() {
    const turnInputs = this.pendingInputs.get(this.currentTurn) || [];
    return {
      turn: this.currentTurn,
      waitingForInputs: this.waitingForInputs,
      inputsReceived: turnInputs.length,
      inputsExpected: this.playerCount,
      phase: this.currentPhase,
      timedOut: this.turnTimeouts.has('turn')
    };
  }

  /**
   * Get pending inputs for a turn
   * @param {number} [turn] - Turn number (defaults to current)
   * @returns {PlayerInput[]}
   */
  getPendingInputs(turn = this.currentTurn) {
    return this.pendingInputs.get(turn) || [];
  }

  /**
   * Get default input for a player (used on timeout)
   * Override this in subclass for game-specific defaults
   * @param {string} playerId - Player ID
   * @returns {Object} Default input
   */
  getDefaultInput(playerId) {
    // Default: pass/skip turn
    return { type: 'pass', playerId, isDefault: true };
  }

  /**
   * Start waiting for inputs for a new turn
   */
  startNewTurn() {
    this.currentPhase = 'input';
    this.waitingForInputs = true;
    this.pendingInputs.set(this.currentTurn, []);

    this._broadcast('turn_started', {
      turn: this.currentTurn,
      playerCount: this.playerCount
    });

    this._startTurnTimeout();
  }

  /**
   * Force execute current turn (admin/debug)
   * @returns {TurnResult|null}
   */
  forceExecuteTurn() {
    if (this.waitingForInputs) {
      return this._executeTurn(this.currentTurn);
    }
    return null;
  }

  /**
   * Handle player timeout
   * @param {string} playerId - Timed out player
   */
  handleTimeout(playerId) {
    const turnInputs = this.pendingInputs.get(this.currentTurn) || [];

    // Check if player already submitted
    if (!turnInputs.some(i => i.playerId === playerId)) {
      const defaultInput = this.getDefaultInput(playerId);
      this.submitInput(playerId, defaultInput);

      this._broadcast('player_timeout', {
        playerId,
        turn: this.currentTurn,
        usedDefault: true
      });
    }
  }

  /**
   * Execute a turn with all collected inputs
   * @param {number} turn - Turn number
   * @returns {TurnResult}
   * @private
   */
  _executeTurn(turn) {
    this._clearTurnTimeout();
    this.waitingForInputs = false;
    this.currentPhase = 'execution';

    const turnInputs = this.pendingInputs.get(turn) || [];

    // Sort inputs deterministically (eliminate order dependency)
    turnInputs.sort((a, b) => a.playerId.localeCompare(b.playerId));

    // Apply inputs in order
    let state = this.gameEngine.getState ? this.gameEngine.getState() : this.gameEngine.state;

    for (const { playerId, input } of turnInputs) {
      if (this.gameEngine.applyInput) {
        state = this.gameEngine.applyInput(state, { playerId, ...input });
      }
    }

    // Update game engine state
    if (this.gameEngine.setState) {
      this.gameEngine.setState(state);
    } else {
      this.gameEngine.state = state;
    }

    // Store confirmed inputs
    this.confirmedInputs.push(...turnInputs);

    // Store turn result
    const result = {
      turn,
      state,
      inputs: turnInputs.map(i => i.input)
    };
    this.turnHistory.push(result);

    this.currentPhase = 'broadcast';

    // Broadcast turn executed
    this._broadcast('turn_executed', {
      turn,
      inputs: turnInputs.map(i => ({ playerId: i.playerId, input: i.input })),
      state: this._compressState(state)
    });

    // Move to next turn
    this.currentTurn++;
    this.startNewTurn();

    return result;
  }

  /**
   * Start turn timeout timer
   * @private
   */
  _startTurnTimeout() {
    this._clearTurnTimeout();

    const timeout = setTimeout(() => {
      this._broadcast('turn_timeout', { turn: this.currentTurn });
      this._handleTurnTimeout();
    }, this.config.turnTimeout);

    this.turnTimeouts.set('turn', timeout);
  }

  /**
   * Clear turn timeout
   * @private
   */
  _clearTurnTimeout() {
    const timeout = this.turnTimeouts.get('turn');
    if (timeout) {
      clearTimeout(timeout);
      this.turnTimeouts.delete('turn');
    }
  }

  /**
   * Handle turn timeout - execute with defaults for missing inputs
   * @private
   */
  _handleTurnTimeout() {
    const turnInputs = this.pendingInputs.get(this.currentTurn) || [];

    // Submit default inputs for missing players
    for (const playerId of this.playerIds) {
      if (!turnInputs.some(i => i.playerId === playerId)) {
        const defaultInput = this.getDefaultInput(playerId);
        turnInputs.push({
          playerId,
          input: defaultInput,
          timestamp: Date.now()
        });
      }
    }

    this._executeTurn(this.currentTurn);
  }

  /**
   * Broadcast message to all players
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @private
   */
  _broadcast(type, data) {
    if (this.broadcastCallback) {
      this.broadcastCallback({ type, data, turn: this.currentTurn });
    }
  }

  /**
   * Compress state for network transmission
   * @param {Object} state - Full state
   * @returns {Object} Compressed state
   * @private
   */
  _compressState(state) {
    // Subclass can override with actual compression
    return state;
  }

  /**
   * Get recent turn history
   * @param {number} [count=10] - Number of recent turns
   * @returns {TurnResult[]}
   */
  getRecentHistory(count = 10) {
    return this.turnHistory.slice(-count);
  }

  /**
   * Get full history
   * @returns {TurnResult[]}
   */
  getFullHistory() {
    return [...this.turnHistory];
  }

  /**
   * Reset synchronizer state
   */
  reset() {
    this._clearTurnTimeout();
    this.currentTurn = 0;
    this.pendingInputs.clear();
    this.confirmedInputs = [];
    this.turnHistory = [];
    this.waitingForInputs = false;
    this.currentPhase = 'input';
  }

  /**
   * Clean up resources
   */
  destroy() {
    this._clearTurnTimeout();
    for (const timeout of this.turnTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.turnTimeouts.clear();
  }
}

module.exports = {
  LockstepSynchronizer,
  DEFAULT_CONFIG
};
