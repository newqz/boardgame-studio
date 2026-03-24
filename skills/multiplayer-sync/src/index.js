/**
 * Multiplayer Sync - Main Export
 * 
 * @version 1.0.0
 */

'use strict';

const { LockstepSynchronizer } = require('./synchronizer/lockstep');
const { StateSynchronizer } = require('./synchronizer/state-sync');
const { DisconnectHandler, ConnectionState } = require('./disconnect');
const { AntiCheat, ValidationError } = require('./anticheat');
const { MessageQueue, MessagePriority } = require('./queue');
const { SpectatorSystem, SpectatorPermission } = require('./spectator');

module.exports = {
  // Core synchronization
  LockstepSynchronizer,
  StateSynchronizer,

  // Connection handling
  DisconnectHandler,
  ConnectionState,

  // Security
  AntiCheat,
  ValidationError,

  // Networking
  MessageQueue,
  MessagePriority,

  // Spectating
  SpectatorSystem,
  SpectatorPermission,

  // Version
  VERSION: '1.0.0'
};
