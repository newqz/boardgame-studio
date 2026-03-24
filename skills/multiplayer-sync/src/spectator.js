/**
 * Spectator System
 * Watch multiplayer games live with delayed replay
 * 
 * @version 1.0.0
 */

'use strict';

/**
 * @typedef {Object} SpectatorConfig
 * @property {number} delayMs - Delay before showing events (ms)
 * @property {number} maxSpectators - Maximum spectators per game
 * @property {boolean} allowSpectatorChat - Allow chat from spectators
 * @property {string[]} spectatorPermissions - What spectators can do
 */

const DEFAULT_CONFIG = Object.freeze({
  delayMs: 500,
  maxSpectators: 100,
  allowSpectatorChat: false,
  spectatorPermissions: ['watch', 'replay']
});

/**
 * Spectator permissions
 */
const SpectatorPermission = Object.freeze({
  WATCH: 'watch',
  REPLAY: 'replay',
  CHAT: 'chat',
  FREEZE: 'freeze',
  CAMERA: 'camera'
});

class SpectatorSystem {
  /**
   * Create a new Spectator System
   * @param {Object} [config={}] - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    /** @type {Map<string, Set<WebSocket>>} */
    this.gameSpectators = new Map();

    /** @type {Map<string, Object[]>} */
    this.gameHistory = new Map();

    /** @type {Map<string, Map<string, Object>>} */
    this.spectatorStates = new Map();

    /** @type {Map<string, Object>} */
    this.gameSnapshots = new Map();

    /** @type {Function|null} */
    this.sendCallback = null;

    /** @type {Function|null} */
    this.getGameStateCallback = null;
  }

  /**
   * Set callbacks
   * @param {Object} callbacks - Event callbacks
   */
  setCallbacks(callbacks) {
    if (callbacks.send) {
      this.sendCallback = callbacks.send;
    }
    if (callbacks.getGameState) {
      this.getGameStateCallback = callbacks.getGameState;
    }
  }

  /**
   * Register a game for spectators
   * @param {string} gameId - Game ID
   * @param {Object} [initialState] - Initial game state
   */
  registerGame(gameId, initialState) {
    this.gameSpectators.set(gameId, new Set());
    this.gameHistory.set(gameId, []);
    this.gameSnapshots.set(gameId, initialState || null);
    this.spectatorStates.set(gameId, new Map());
  }

  /**
   * Unregister a game
   * @param {string} gameId - Game ID
   */
  unregisterGame(gameId) {
    // Notify all spectators
    const spectators = this.gameSpectators.get(gameId);
    if (spectators) {
      for (const spectator of spectators) {
        this._sendToSpectator(spectator, {
          type: 'game_ended',
          gameId
        });
      }
      spectators.clear();
    }

    this.gameSpectators.delete(gameId);
    this.gameHistory.delete(gameId);
    this.gameSnapshots.delete(gameId);
    this.spectatorStates.delete(gameId);
  }

  /**
   * Add a spectator to a game
   * @param {string} gameId - Game ID
   * @param {Object} connection - Spectator connection
   * @param {Object} [options={}] - Options
   * @returns {Object} Join result
   */
  joinSpectator(gameId, connection, options = {}) {
    const spectators = this.gameSpectators.get(gameId);

    if (!spectators) {
      return { success: false, reason: 'game_not_found' };
    }

    if (spectators.size >= this.config.maxSpectators) {
      return { success: false, reason: 'spectator_limit_reached' };
    }

    // Check if already spectating
    if (spectators.has(connection)) {
      return { success: true, alreadySpectating: true };
    }

    // Add to spectators
    spectators.add(connection);

    // Store spectator state
    const states = this.spectatorStates.get(gameId);
    states.set(connection, {
      joinedAt: Date.now(),
      permissions: options.permissions || this.config.spectatorPermissions,
      camera: options.camera || null,
      isFrozen: false,
      playbackSpeed: options.playbackSpeed || 1
    });

    // Send initial state
    const initialState = this.gameSnapshots.get(gameId);
    const history = this.gameHistory.get(gameId);

    this._sendToSpectator(connection, {
      type: 'spectator_joined',
      gameId,
      state: initialState,
      historyLength: history.length,
      spectatorCount: spectators.size
    });

    // Broadcast spectator count update
    this._broadcastSpectatorCount(gameId);

    // Set up disconnect handler
    connection.on?.('close', () => {
      this.leaveSpectator(gameId, connection);
    });

    return {
      success: true,
      spectatorCount: spectators.size,
      historyLength: history.length
    };
  }

  /**
   * Remove a spectator from a game
   * @param {string} gameId - Game ID
   * @param {Object} connection - Spectator connection
   */
  leaveSpectator(gameId, connection) {
    const spectators = this.gameSpectators.get(gameId);
    if (spectators) {
      spectators.delete(connection);
    }

    const states = this.spectatorStates.get(gameId);
    if (states) {
      states.delete(connection);
    }

    this._broadcastSpectatorCount(gameId);
  }

  /**
   * Record a game event for replay
   * @param {string} gameId - Game ID
   * @param {Object} event - Event to record
   */
  recordEvent(gameId, event) {
    const history = this.gameHistory.get(gameId);
    if (!history) return;

    // Add timestamp and sequence
    const eventRecord = {
      ...event,
      timestamp: Date.now(),
      sequence: history.length
    };

    history.push(eventRecord);

    // Keep history manageable
    if (history.length > 10000) {
      history.splice(0, history.length - 10000);
    }

    // Schedule delayed broadcast to spectators
    this._scheduleDelayedBroadcast(gameId, eventRecord);
  }

  /**
   * Update game state snapshot
   * @param {string} gameId - Game ID
   * @param {Object} state - New state
   */
  updateSnapshot(gameId, state) {
    this.gameSnapshots.set(gameId, state);
  }

  /**
   * Get spectator count for a game
   * @param {string} gameId - Game ID
   * @returns {number}
   */
  getSpectatorCount(gameId) {
    return this.gameSpectators.get(gameId)?.size || 0;
  }

  /**
   * Get all games with spectators
   * @returns {string[]} List of game IDs
   */
  getActiveGames() {
    const games = [];
    for (const [gameId, spectators] of this.gameSpectators) {
      if (spectators.size > 0) {
        games.push(gameId);
      }
    }
    return games;
  }

  /**
   * Broadcast to all spectators of a game
   * @param {string} gameId - Game ID
   * @param {Object} data - Data to broadcast
   * @private
   */
  _broadcastToSpectators(gameId, data) {
    const spectators = this.gameSpectators.get(gameId);
    if (!spectators) return;

    for (const spectator of spectators) {
      const states = this.spectatorStates.get(gameId);
      const state = states?.get(spectator);

      // Skip if frozen (unless critical)
      if (state?.isFrozen && data.type !== 'game_ended') {
        continue;
      }

      this._sendToSpectator(spectator, data);
    }
  }

  /**
   * Send message to a specific spectator
   * @param {Object} connection - Spectator connection
   * @param {Object} data - Data to send
   * @private
   */
  _sendToSpectator(connection, data) {
    if (this.sendCallback) {
      this.sendCallback(connection, data);
    } else if (connection.send) {
      connection.send(JSON.stringify(data));
    }
  }

  /**
   * Schedule delayed broadcast for spectator replay
   * @param {string} gameId - Game ID
   * @param {Object} event - Event to broadcast
   * @private
   */
  _scheduleDelayedBroadcast(gameId, event) {
    const delay = this.config.delayMs;

    setTimeout(() => {
      this._broadcastToSpectators(gameId, {
        ...event,
        replayTimestamp: Date.now()
      });
    }, delay);
  }

  /**
   * Broadcast spectator count update
   * @param {string} gameId - Game ID
   * @private
   */
  _broadcastSpectatorCount(gameId) {
    const count = this.getSpectatorCount(gameId);

    this._broadcastToSpectators(gameId, {
      type: 'spectator_count',
      count
    });
  }

  /**
   * Freeze/unfreeze a spectator's view
   * @param {string} gameId - Game ID
   * @param {Object} connection - Spectator connection
   * @param {boolean} freeze - Whether to freeze
   */
  setFrozen(gameId, connection, freeze) {
    const states = this.spectatorStates.get(gameId);
    if (!states) return;

    const state = states.get(connection);
    if (state) {
      state.isFrozen = freeze;

      this._sendToSpectator(connection, {
        type: freeze ? 'view_frozen' : 'view_unfrozen'
      });
    }
  }

  /**
   * Set spectator's playback speed
   * @param {string} gameId - Game ID
   * @param {Object} connection - Spectator connection
   * @param {number} speed - Playback speed (0.5 - 2.0)
   */
  setPlaybackSpeed(gameId, connection, speed) {
    const states = this.spectatorStates.get(gameId);
    if (!states) return;

    const state = states.get(connection);
    if (state) {
      state.playbackSpeed = Math.max(0.5, Math.min(2.0, speed));

      this._sendToSpectator(connection, {
        type: 'playback_speed_changed',
        speed: state.playbackSpeed
      });
    }
  }

  /**
   * Get replay history for a spectator
   * @param {string} gameId - Game ID
   * @param {number} [fromSequence=0] - Start sequence
   * @param {number} [limit=100] - Max events to return
   * @returns {Object[]} Event history
   */
  getReplayHistory(gameId, fromSequence = 0, limit = 100) {
    const history = this.gameHistory.get(gameId) || [];
    return history
      .filter(e => e.sequence >= fromSequence)
      .slice(0, limit);
  }

  /**
   * Check if spectator has a permission
   * @param {string} gameId - Game ID
   * @param {Object} connection - Spectator connection
   * @param {string} permission - Permission to check
   * @returns {boolean}
   */
  hasPermission(gameId, connection, permission) {
    const states = this.spectatorStates.get(gameId);
    if (!states) return false;

    const state = states.get(connection);
    if (!state) return false;

    return state.permissions.includes(permission) ||
           state.permissions.includes('*');
  }

  /**
   * Grant permission to a spectator
   * @param {string} gameId - Game ID
   * @param {Object} connection - Spectator connection
   * @param {string} permission - Permission to grant
   */
  grantPermission(gameId, connection, permission) {
    const states = this.spectatorStates.get(gameId);
    if (!states) return;

    const state = states.get(connection);
    if (state && !state.permissions.includes(permission)) {
      state.permissions.push(permission);
    }
  }

  /**
   * Revoke permission from a spectator
   * @param {string} gameId - Game ID
   * @param {Object} connection - Spectator connection
   * @param {string} permission - Permission to revoke
   */
  revokePermission(gameId, connection, permission) {
    const states = this.spectatorStates.get(gameId);
    if (!states) return;

    const state = states.get(connection);
    if (state) {
      state.permissions = state.permissions.filter(p => p !== permission);
    }
  }

  /**
   * Kick a spectator
   * @param {string} gameId - Game ID
   * @param {Object} connection - Spectator connection
   * @param {string} [reason] - Reason for kick
   */
  kickSpectator(gameId, connection, reason) {
    this._sendToSpectator(connection, {
      type: 'kicked',
      reason: reason || 'Removed from spectating'
    });

    this.leaveSpectator(gameId, connection);
  }

  /**
   * Get spectator statistics
   * @returns {Object} Spectator stats
   */
  getStats() {
    let totalSpectators = 0;
    let totalGames = 0;

    for (const [, spectators] of this.gameSpectators) {
      totalSpectators += spectators.size;
      if (spectators.size > 0) totalGames++;
    }

    return {
      totalSpectators,
      activeGames: totalGames,
      totalEventsRecorded: [...this.gameHistory.values()].reduce(
        (sum, h) => sum + h.length, 0
      )
    };
  }

  /**
   * Clean up resources for a game
   * @param {string} gameId - Game ID
   */
  cleanupGame(gameId) {
    const spectators = this.gameSpectators.get(gameId);
    if (spectators) {
      for (const spectator of spectators) {
        this._sendToSpectator(spectator, {
          type: 'game_cleanup',
          gameId
        });
      }
      spectators.clear();
    }

    this.gameSpectators.delete(gameId);
    this.gameHistory.delete(gameId);
    this.gameSnapshots.delete(gameId);
    this.spectatorStates.delete(gameId);
  }
}

module.exports = {
  SpectatorSystem,
  SpectatorPermission,
  DEFAULT_CONFIG
};
