/**
 * State Synchronizer
 * Handles full state sync and delta compression
 * 
 * @version 1.0.0
 */

'use strict';

/**
 * @typedef {Object} CompressedState
 * @property {Object} data - Compressed state data
 * @property {Object} metadata - Compression metadata
 */

/**
 * @typedef {Object} Delta
 * @property {number} turn - Turn number
 * @property {Object} changes - Changed fields only
 * @property {number} timestamp - Delta timestamp
 */

/**
 * @typedef {Object} SyncMessage
 * @property {string} type - Message type
 * @property {Object} payload - Message payload
 * @property {number} timestamp - Message timestamp
 */

class StateSynchronizer {
  /**
   * Create a new State Synchronizer
   * @param {Object} [options={}] - Configuration options
   */
  constructor(options = {}) {
    /** @type {Object|null} */
    this.lastState = null;

    /** @type {number} */
    this.lastTurn = 0;

    /** @type {number} */
    this.compressionLevel = options.compressionLevel || 'normal'; // 'minimal' | 'normal' | 'aggressive'

    /** @type {Function|null} */
    this.stateSerializer = options.stateSerializer || null;

    /** @type {Set<string>} */
    this.trackedFields = new Set(options.trackedFields || []);

    /** @type {Map<string, any>} */
    this.fieldAliases = new Map(); // For renaming fields to shorter keys
  }

  /**
   * Set field aliases for compression (e.g., { playerResources: 'pr' })
   * @param {Object} aliases - Map of original to compressed field names
   */
  setFieldAliases(aliases) {
    for (const [original, compressed] of Object.entries(aliases)) {
      this.fieldAliases.set(original, compressed);
    }
  }

  /**
   * Set which fields to track for changes
   * @param {string[]} fields - List of field paths to track
   */
  setTrackedFields(fields) {
    this.trackedFields = new Set(fields);
  }

  /**
   * Create a full state snapshot message
   * @param {Object} state - Full game state
   * @param {Object} [metadata={}] - Additional metadata
   * @returns {SyncMessage}
   */
  createFullStateMessage(state, metadata = {}) {
    const compressed = this.compressState(state);

    this.lastState = this._deepClone(state);
    this.lastTurn = metadata.turn || 0;

    return {
      type: 'full_state',
      payload: {
        state: compressed,
        metadata: {
          ...metadata,
          turn: metadata.turn || 0,
          timestamp: Date.now()
        }
      },
      timestamp: Date.now()
    };
  }

  /**
   * Create a delta sync message
   * @param {Object} newState - New game state
   * @param {number} turn - Current turn number
   * @returns {SyncMessage|null}
   */
  createDeltaMessage(newState, turn) {
    if (!this.lastState) {
      // No reference state - send full state
      return this.createFullStateMessage(newState, { turn });
    }

    const changes = this.computeDelta(this.lastState, newState);

    // If no changes, return null
    if (Object.keys(changes).length === 0) {
      return null;
    }

    const delta = {
      turn,
      changes,
      timestamp: Date.now()
    };

    this.lastState = this._deepClone(newState);
    this.lastTurn = turn;

    return {
      type: 'delta',
      payload: delta,
      timestamp: Date.now()
    };
  }

  /**
   * Compute delta between two states
   * @param {Object} oldState - Previous state
   * @param {Object} newState - New state
   * @returns {Object} Changed fields only
   */
  computeDelta(oldState, newState) {
    const changes = {};

    if (this.trackedFields.size > 0) {
      // Only track specified fields
      for (const field of this.trackedFields) {
        const oldVal = this._getNestedValue(oldState, field);
        const newVal = this._getNestedValue(newState, field);

        if (!this._deepEqual(oldVal, newVal)) {
          this._setNestedValue(changes, field, newVal);
        }
      }
    } else {
      // Track all fields
      changes.resources = this._computeChanges(
        oldState.resources,
        newState.resources
      );
      changes.turn = newState.turn;
      changes.phase = newState.phase;

      // Add other top-level changes
      for (const key of Object.keys(newState)) {
        if (key === 'resources' || key === 'turn' || key === 'phase') continue;

        const oldVal = oldState[key];
        const newVal = newState[key];

        if (!this._deepEqual(oldVal, newVal)) {
          changes[key] = newVal;
        }
      }
    }

    return changes;
  }

  /**
   * Compute changes for nested objects
   * @param {Object} oldObj - Old object
   * @param {Object} newObj - New object
   * @returns {Object}
   * @private
   */
  _computeChanges(oldObj, newObj) {
    if (!oldObj || !newObj) {
      return newObj || {};
    }

    const changes = {};

    for (const key of Object.keys(newObj)) {
      const oldVal = oldObj[key];
      const newVal = newObj[key];

      if (Array.isArray(newVal)) {
        // For arrays, send if different
        if (!this._deepEqual(oldVal, newVal)) {
          changes[key] = newVal;
        }
      } else if (typeof newVal === 'object' && newVal !== null) {
        // For objects, recurse
        const nestedChanges = this._computeChanges(oldVal || {}, newVal);
        if (Object.keys(nestedChanges).length > 0) {
          changes[key] = nestedChanges;
        }
      } else {
        // Primitives - compare directly
        if (oldVal !== newVal) {
          changes[key] = newVal;
        }
      }
    }

    return changes;
  }

  /**
   * Compress state for transmission
   * @param {Object} state - Full state
   * @returns {Object} Compressed state
   */
  compressState(state) {
    if (this.stateSerializer) {
      return this.stateSerializer(state);
    }

    switch (this.compressionLevel) {
      case 'minimal':
        return this._compressMinimal(state);
      case 'aggressive':
        return this._compressAggressive(state);
      default:
        return this._compressNormal(state);
    }
  }

  /**
   * Minimal compression - only omit default values
   * @param {Object} state - State to compress
   * @returns {Object}
   * @private
   */
  _compressMinimal(state) {
    return JSON.parse(JSON.stringify(state)); // Deep clone first
  }

  /**
   * Normal compression - use aliases and omit defaults
   * @param {Object} state - State to compress
   * @returns {Object}
   * @private
   */
  _compressNormal(state) {
    const compressed = {};
    const defaults = this._getDefaultState();

    for (const [key, value] of Object.entries(state)) {
      // Apply alias if exists
      const compressedKey = this.fieldAliases.get(key) || key;

      // Skip if same as default
      const defaultVal = this._getNestedValue(defaults, key);
      if (this._deepEqual(value, defaultVal)) {
        continue;
      }

      // Apply value
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        compressed[compressedKey] = this._compressMinimal(value);
      } else {
        compressed[compressedKey] = value;
      }
    }

    // Always include turn
    compressed._t = state.turn;

    return compressed;
  }

  /**
   * Aggressive compression - numbers, short keys, binary
   * @param {Object} state - State to compress
   * @returns {Object}
   * @private
   */
  _compressAggressive(state) {
    const compressed = {};

    // Map to short keys
    const keyMap = {
      resources: 'r',
      players: 'p',
      turn: 't',
      phase: 'ph',
      deck: 'd',
      discard: 'dc',
      market: 'm'
    };

    for (const [key, value] of Object.entries(state)) {
      const shortKey = keyMap[key] || key;

      if (typeof value === 'object' && value !== null) {
        compressed[shortKey] = JSON.stringify(value);
      } else {
        compressed[shortKey] = value;
      }
    }

    return compressed;
  }

  /**
   * Decompress state from message
   * @param {Object} data - Compressed state data
   * @param {string} [type='normal'] - Compression type
   * @returns {Object} Decompressed state
   */
  decompressState(data, type = 'normal') {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }

    switch (type) {
      case 'aggressive':
        return this._decompressAggressive(data);
      case 'minimal':
      case 'normal':
      default:
        return data;
    }
  }

  /**
   * Decompress aggressively compressed state
   * @param {Object} data - Compressed data
   * @returns {Object}
   * @private
   */
  _decompressAggressive(data) {
    const state = {};
    const keyMap = {
      r: 'resources',
      p: 'players',
      t: 'turn',
      ph: 'phase',
      d: 'deck',
      dc: 'discard',
      m: 'market'
    };

    for (const [key, value] of Object.entries(data)) {
      const fullKey = keyMap[key] || key;

      if (typeof value === 'string' && ['resources', 'players', 'deck', 'discard', 'market'].includes(fullKey)) {
        try {
          state[fullKey] = JSON.parse(value);
        } catch {
          state[fullKey] = value;
        }
      } else {
        state[fullKey] = value;
      }
    }

    return state;
  }

  /**
   * Apply delta to current state
   * @param {Object} baseState - Base state to apply delta to
   * @param {Delta} delta - Delta to apply
   * @returns {Object} New state
   */
  applyDelta(baseState, delta) {
    const newState = this._deepClone(baseState);

    for (const [key, value] of Object.entries(delta.changes)) {
      this._setNestedValue(newState, key, value);
    }

    return newState;
  }

  /**
   * Get default state for comparison
   * @returns {Object}
   * @private
   */
  _getDefaultState() {
    return {
      turn: 0,
      phase: 'setup',
      resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
    };
  }

  /**
   * Get nested value from object using dot notation
   * @param {Object} obj - Object
   * @param {string} path - Dot-separated path
   * @returns {*}
   * @private
   */
  _getNestedValue(obj, path) {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Set nested value on object using dot notation
   * @param {Object} obj - Object
   * @param {string} path - Dot-separated path
   * @param {*} value - Value to set
   * @private
   */
  _setNestedValue(obj, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    let current = obj;

    for (const part of parts) {
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    current[last] = value;
  }

  /**
   * Deep clone an object
   * @param {Object} obj - Object to clone
   * @returns {Object}
   * @private
   */
  _deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this._deepClone(item));
    }

    const clone = {};
    for (const [key, value] of Object.entries(obj)) {
      clone[key] = this._deepClone(value);
    }
    return clone;
  }

  /**
   * Deep equality check
   * @param {*} a - First value
   * @param {*} b - Second value
   * @returns {boolean}
   * @private
   */
  _deepEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (typeof a !== 'object' || typeof b !== 'object') return a === b;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, i) => this._deepEqual(item, b[i]));
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every(key => this._deepEqual(a[key], b[key]));
  }
}

module.exports = { StateSynchronizer };
