/**
 * Disconnect Handler
 * Manages player disconnection and reconnection
 * 
 * @version 1.0.0
 */

'use strict';

/**
 * @typedef {Object} ReconnectInfo
 * @property {string} playerId - Player ID
 * @property {number} disconnectTime - When player disconnected
 * @property {number} reconnectDeadline - When reconnect window expires
 * @property {Object} pendingState - State at disconnect time
 * @property {Object[]} pendingActions - Actions that occurred while disconnected
 */

/**
 * @typedef {Object} DisconnectConfig
 * @property {number} reconnectWindow - Ms window for reconnection
 * @property {boolean} autoReplaceWithAI - Replace with AI after timeout
 * @property {number} maxReconnectWindow - Maximum reconnect window
 */

const DEFAULT_CONFIG = Object.freeze({
  reconnectWindow: 60000,        // 60 seconds
  autoReplaceWithAI: false,
  maxReconnectWindow: 300000     // 5 minutes max
});

/**
 * Player connection state
 */
const ConnectionState = Object.freeze({
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  RECONNECTED: 'reconnected',
  REPLACED: 'replaced'
});

class DisconnectHandler {
  /**
   * Create a new Disconnect Handler
   * @param {Object} [config={}] - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    /** @type {Map<string, ConnectionState>} */
    this.connectionStates = new Map();

    /** @type {Map<string, ReconnectInfo>} */
    this.reconnectInfos = new Map();

    /** @type {Map<string, NodeJS.Timeout>} */
    this.reconnectTimeouts = new Map();

    /** @type {Function|null} */
    this.onPermanentDisconnect = null;

    /** @type {Function|null} */
    this.onReconnected = null;

    /** @type {Function|null} */
    this.onReplacedWithAI = null;

    /** @type {Function|null} */
    this.broadcastCallback = null;

    /** @type {Object[]} */
    this.disconnectHistory = [];
  }

  /**
   * Set callbacks for events
   * @param {Object} callbacks - Event callbacks
   */
  setCallbacks(callbacks) {
    if (callbacks.onPermanentDisconnect) {
      this.onPermanentDisconnect = callbacks.onPermanentDisconnect;
    }
    if (callbacks.onReconnected) {
      this.onReconnected = callbacks.onReconnected;
    }
    if (callbacks.onReplacedWithAI) {
      this.onReplacedWithAI = callbacks.onReplacedWithAI;
    }
    if (callbacks.broadcast) {
      this.broadcastCallback = callbacks.broadcast;
    }
  }

  /**
   * Set state synchronizer for getting pending state
   * @param {Object} synchronizer - State synchronizer instance
   */
  setSynchronizer(synchronizer) {
    this.synchronizer = synchronizer;
  }

  /**
   * Handle player connection
   * @param {string} playerId - Player ID
   * @param {Object} [connection] - Connection info
   */
  onPlayerConnect(playerId, connection) {
    const wasDisconnected = this.connectionStates.get(playerId) === ConnectionState.DISCONNECTED;

    this.connectionStates.set(playerId, ConnectionState.CONNECTED);

    // Clear any reconnect timeout
    const timeout = this.reconnectTimeouts.get(playerId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(playerId);
    }

    // Handle reconnection
    if (wasDisconnected) {
      const reconnectInfo = this.reconnectInfos.get(playerId);
      if (reconnectInfo) {
        this.reconnectInfos.delete(playerId);
        this.connectionStates.set(playerId, ConnectionState.RECONNECTED);

        this._broadcast('player_reconnected', {
          playerId,
          disconnectDuration: Date.now() - reconnectInfo.disconnectTime
        });

        if (this.onReconnected) {
          this.onReconnected(playerId, reconnectInfo);
        }

        // Reset state after a delay
        setTimeout(() => {
          if (this.connectionStates.get(playerId) === ConnectionState.RECONNECTED) {
            this.connectionStates.set(playerId, ConnectionState.CONNECTED);
          }
        }, 5000);
      }
    }

    this._broadcast('player_connected', { playerId });
  }

  /**
   * Handle player disconnection
   * @param {string} playerId - Player ID
   * @param {Object} [pendingState] - Current game state
   */
  onPlayerDisconnect(playerId, pendingState) {
    const currentState = this.connectionStates.get(playerId);

    // Ignore if already disconnected
    if (currentState === ConnectionState.DISCONNECTED ||
        currentState === ConnectionState.REPLACED) {
      return;
    }

    this.connectionStates.set(playerId, ConnectionState.DISCONNECTED);

    const disconnectTime = Date.now();
    const reconnectDeadline = disconnectTime + this.config.reconnectWindow;

    // Store reconnect info
    const reconnectInfo = {
      playerId,
      disconnectTime,
      reconnectDeadline,
      pendingState: pendingState || null,
      pendingActions: []
    };
    this.reconnectInfos.set(playerId, reconnectInfo);

    // Store in history
    this.disconnectHistory.push({
      playerId,
      disconnectTime,
      reconnectDeadline
    });

    // Keep history manageable
    if (this.disconnectHistory.length > 100) {
      this.disconnectHistory.shift();
    }

    // Broadcast disconnection
    this._broadcast('player_disconnected', {
      playerId,
      reconnectDeadline,
      reconnectWindow: this.config.reconnectWindow
    });

    // Start reconnect timeout
    const timeout = setTimeout(() => {
      this._handleReconnectTimeout(playerId);
    }, this.config.reconnectWindow);

    this.reconnectTimeouts.set(playerId, timeout);
  }

  /**
   * Handle reconnection attempt
   * @param {string} playerId - Player ID
   * @param {Object} connection - New connection
   * @returns {Object|null} Sync data for the player
   */
  handleReconnect(playerId, connection) {
    const reconnectInfo = this.reconnectInfos.get(playerId);

    if (!reconnectInfo) {
      // Check if player was permanently disconnected (timeout already fired)
      const state = this.connectionStates.get(playerId);
      if (state === ConnectionState.REPLACED) {
        return {
          success: false,
          reason: 'reconnect_window_expired'
        };
      }
      
      // No pending reconnect - new connection
      this.onPlayerConnect(playerId, connection);
      return null;
    }

    // Clear timeout
    const timeout = this.reconnectTimeouts.get(playerId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(playerId);
    }

    // Check if deadline passed
    if (Date.now() > reconnectInfo.reconnectDeadline) {
      // Too late
      return {
        success: false,
        reason: 'reconnect_window_expired'
      };
    }

    // Successful reconnect
    this.onPlayerConnect(playerId, connection);

    // Get state to sync
    const syncData = {
      success: true,
      playerId,
      state: reconnectInfo.pendingState,
      actionsSinceDisconnect: reconnectInfo.pendingActions,
      disconnectTime: reconnectInfo.disconnectTime
    };

    // If we have a synchronizer, get current state
    if (this.synchronizer) {
      syncData.state = this.synchronizer.lastState;
      syncData.turn = this.synchronizer.lastTurn;
    }

    return syncData;
  }

  /**
   * Record an action that occurred while player was disconnected
   * @param {string} playerId - Player ID (optional, records for all disconnected)
   * @param {Object} action - Action that occurred
   */
  recordPendingAction(playerId, action) {
    // If playerId specified, only record for that player
    if (playerId) {
      const info = this.reconnectInfos.get(playerId);
      if (info) {
        info.pendingActions.push(action);
      }
      return;
    }

    // Record for all disconnected players
    for (const info of this.reconnectInfos.values()) {
      info.pendingActions.push(action);
    }
  }

  /**
   * Get connection state for a player
   * @param {string} playerId - Player ID
   * @returns {string} Connection state
   */
  getConnectionState(playerId) {
    return this.connectionStates.get(playerId) || ConnectionState.CONNECTED;
  }

  /**
   * Check if a player is connected
   * @param {string} playerId - Player ID
   * @returns {boolean}
   */
  isConnected(playerId) {
    const state = this.connectionStates.get(playerId);
    return state === ConnectionState.CONNECTED || 
           state === ConnectionState.RECONNECTED;
  }

  /**
   * Check if a player is disconnected
   * @param {string} playerId - Player ID
   * @returns {boolean}
   */
  isDisconnected(playerId) {
    const state = this.connectionStates.get(playerId);
    return state === ConnectionState.DISCONNECTED || state === ConnectionState.RECONNECTING;
  }

  /**
   * Get all disconnected players
   * @returns {string[]} List of disconnected player IDs
   */
  getDisconnectedPlayers() {
    const disconnected = [];
    for (const [playerId, state] of this.connectionStates) {
      if (state === ConnectionState.DISCONNECTED) {
        disconnected.push(playerId);
      }
    }
    return disconnected;
  }

  /**
   * Get reconnection info for a player
   * @param {string} playerId - Player ID
   * @returns {ReconnectInfo|null}
   */
  getReconnectInfo(playerId) {
    return this.reconnectInfos.get(playerId) || null;
  }

  /**
   * Handle reconnect timeout - player didn't come back
   * @param {string} playerId - Player ID
   * @private
   */
  _handleReconnectTimeout(playerId) {
    this.reconnectTimeouts.delete(playerId);

    const reconnectInfo = this.reconnectInfos.get(playerId);
    if (!reconnectInfo) {
      return;
    }

    this.reconnectInfos.delete(playerId);
    this.connectionStates.set(playerId, ConnectionState.REPLACED);

    // Broadcast permanent disconnect
    this._broadcast('player_disconnect_timeout', {
      playerId,
      replaced: this.config.autoReplaceWithAI
    });

    if (this.config.autoReplaceWithAI) {
      this.connectionStates.set(playerId, ConnectionState.REPLACED);

      this._broadcast('player_replaced_with_ai', { playerId });

      if (this.onReplacedWithAI) {
        this.onReplacedWithAI(playerId);
      }
    } else {
      if (this.onPermanentDisconnect) {
        this.onPermanentDisconnect(playerId, reconnectInfo);
      }
    }
  }

  /**
   * Broadcast message
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @private
   */
  _broadcast(type, data) {
    if (this.broadcastCallback) {
      this.broadcastCallback({ type, data, timestamp: Date.now() });
    }
  }

  /**
   * Extend reconnect window for a player
   * @param {string} playerId - Player ID
   * @param {number} additionalMs - Additional time in ms
   */
  extendReconnectWindow(playerId, additionalMs) {
    const info = this.reconnectInfos.get(playerId);
    if (!info) return;

    // Don't exceed max window
    const maxDeadline = info.disconnectTime + this.config.maxReconnectWindow;
    const newDeadline = Math.min(
      info.reconnectDeadline + additionalMs,
      maxDeadline
    );

    info.reconnectDeadline = newDeadline;

    // Clear existing timeout and set new one
    const existingTimeout = this.reconnectTimeouts.get(playerId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this._handleReconnectTimeout(playerId);
    }, newDeadline - Date.now());

    this.reconnectTimeouts.set(playerId, timeout);

    this._broadcast('reconnect_window_extended', {
      playerId,
      newDeadline,
      additionalMs
    });
  }

  /**
   * Get disconnect statistics
   * @returns {Object} Disconnect stats
   */
  getStats() {
    let connected = 0;
    let disconnected = 0;
    let replaced = 0;

    for (const state of this.connectionStates.values()) {
      if (state === ConnectionState.CONNECTED) connected++;
      else if (state === ConnectionState.DISCONNECTED) disconnected++;
      else if (state === ConnectionState.REPLACED) replaced++;
    }

    return {
      totalPlayers: this.connectionStates.size,
      connected,
      disconnected,
      replaced,
      pendingReconnects: this.reconnectInfos.size,
      recentDisconnects: this.disconnectHistory.slice(-10)
    };
  }

  /**
   * Reset handler state
   */
  reset() {
    for (const timeout of this.reconnectTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.reconnectTimeouts.clear();
    this.connectionStates.clear();
    this.reconnectInfos.clear();
    this.disconnectHistory = [];
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.reset();
    this.onPermanentDisconnect = null;
    this.onReconnected = null;
    this.onReplacedWithAI = null;
    this.broadcastCallback = null;
  }
}

module.exports = {
  DisconnectHandler,
  ConnectionState,
  DEFAULT_CONFIG
};
