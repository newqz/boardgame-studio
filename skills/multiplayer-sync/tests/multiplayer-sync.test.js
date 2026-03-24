/**
 * Multiplayer Sync Tests
 * 
 * @version 1.0.0
 */

'use strict';

const {
  LockstepSynchronizer,
  StateSynchronizer,
  DisconnectHandler,
  ConnectionState,
  AntiCheat,
  ValidationError,
  MessageQueue,
  MessagePriority,
  SpectatorSystem,
  SpectatorPermission
} = require('../src/index');

// Mock game engine for testing
const createMockGameEngine = () => ({
  state: {
    turn: 0,
    phase: 'input',
    currentPlayer: 'player1',
    players: ['player1', 'player2'],
    resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
  },
  getState() {
    return this.state;
  },
  setState(state) {
    this.state = state;
  },
  applyInput(state, input) {
    const newState = { ...state };
    if (input.type === 'build') {
      newState.turn++;
    }
    return newState;
  },
  getAllowedActions() {
    return ['build', 'pass', 'trade'];
  }
});

describe('LockstepSynchronizer', () => {
  let engine;
  let synchronizer;

  beforeEach(() => {
    engine = createMockGameEngine();
    synchronizer = new LockstepSynchronizer(engine, {
      turnTimeout: 5000
    });
    synchronizer.registerPlayers(['player1', 'player2']);
  });

  afterEach(() => {
    synchronizer.destroy();
  });

  test('should initialize correctly', () => {
    expect(synchronizer.currentTurn).toBe(0);
    expect(synchronizer.playerCount).toBe(2);
    expect(synchronizer.getTurnStatus().phase).toBe('input');
  });

  test('should accept inputs from players', () => {
    synchronizer.startNewTurn();
    const result = synchronizer.submitInput('player1', { type: 'build' });
    expect(result.success).toBe(true);
    expect(result.turn).toBe(0);
  });

  test('should reject duplicate inputs', () => {
    synchronizer.startNewTurn();
    synchronizer.submitInput('player1', { type: 'build' });
    const result = synchronizer.submitInput('player1', { type: 'build' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('already_submitted');
  });

  test('should execute turn when all players submit', () => {
    synchronizer.startNewTurn();
    synchronizer.submitInput('player1', { type: 'build' });
    synchronizer.submitInput('player2', { type: 'pass' });

    // Turn should execute and move to turn 1
    expect(synchronizer.currentTurn).toBe(1);
  });

  test('should handle unknown player', () => {
    const result = synchronizer.submitInput('player3', { type: 'build' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('player_not_found');
  });

  test('should execute turn on timeout', (done) => {
    // Use a short timeout for this test
    synchronizer.config.turnTimeout = 50;
    synchronizer.startNewTurn();

    // Only player 1 submits
    synchronizer.submitInput('player1', { type: 'build' });

    // Wait for timeout
    setTimeout(() => {
      expect(synchronizer.currentTurn).toBe(1);
      done();
    }, 100);
  }, 5000);

  test('should add and remove players', () => {
    synchronizer.addPlayer('player3');
    expect(synchronizer.playerCount).toBe(3);

    synchronizer.removePlayer('player3');
    expect(synchronizer.playerCount).toBe(2);
  });

  test('should reset state', () => {
    synchronizer.submitInput('player1', { type: 'build' });
    synchronizer.reset();

    expect(synchronizer.currentTurn).toBe(0);
    expect(synchronizer.getPendingInputs().length).toBe(0);
  });
});

describe('StateSynchronizer', () => {
  let synchronizer;

  beforeEach(() => {
    synchronizer = new StateSynchronizer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should create full state message', () => {
    const state = {
      turn: 5,
      phase: 'main',
      resources: { wood: 10, brick: 5 }
    };

    const message = synchronizer.createFullStateMessage(state, { turn: 5 });

    expect(message.type).toBe('full_state');
    expect(message.payload.state).toBeDefined();
    expect(message.payload.metadata.turn).toBe(5);
  });

  test('should create delta message when state changes', () => {
    const oldState = { turn: 1, resources: { wood: 10 } };
    const newState = { turn: 2, resources: { wood: 15 } };

    synchronizer.lastState = oldState;

    const message = synchronizer.createDeltaMessage(newState, 2);

    expect(message).not.toBeNull();
    expect(message.type).toBe('delta');
    expect(message.payload.changes.turn).toBe(2);
  });

  test('should return null when no changes', () => {
    const state = { turn: 1, resources: { wood: 10 } };

    synchronizer.lastState = state;

    const message = synchronizer.createDeltaMessage(state, 1);

    expect(message).toBeNull();
  });

  test('should apply delta to state', () => {
    const baseState = { turn: 1, resources: { wood: 10 } };
    const delta = { turn: 2, resources: { wood: 15 } };

    const newState = synchronizer.applyDelta(baseState, { changes: delta });

    expect(newState.turn).toBe(2);
    expect(newState.resources.wood).toBe(15);
  });

  test('should use field aliases', () => {
    synchronizer.setFieldAliases({ resources: 'r' });

    synchronizer.setTrackedFields(['resources.wood']);

    const state = { turn: 1, resources: { wood: 10, brick: 5 } };

    synchronizer.lastState = { turn: 0, resources: { wood: 0, brick: 0 } };

    const delta = synchronizer.computeDelta(synchronizer.lastState, state);

    expect(delta.resources).toBeDefined();
  });
});

describe('DisconnectHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new DisconnectHandler({
      reconnectWindow: 5000
    });
  });

  afterEach(() => {
    handler.destroy();
    jest.clearAllMocks();
  });

  test('should track connected players', () => {
    handler.onPlayerConnect('player1');
    expect(handler.isConnected('player1')).toBe(true);
  });

  test('should track disconnected players', () => {
    handler.onPlayerConnect('player1');
    handler.onPlayerDisconnect('player1');

    expect(handler.isDisconnected('player1')).toBe(true);
    expect(handler.getDisconnectedPlayers()).toContain('player1');
  });

  test('should handle reconnection', () => {
    handler.onPlayerConnect('player1');
    handler.onPlayerDisconnect('player1');

    const result = handler.handleReconnect('player1', {});

    expect(result.success).toBe(true);
    expect(handler.isConnected('player1')).toBe(true);
  });

  test('should reject late reconnection', async () => {
    handler.config.reconnectWindow = 100; // Very short window

    handler.onPlayerConnect('player1');
    handler.onPlayerDisconnect('player1');

    // Wait for timeout
    await new Promise((resolve) => {
      setTimeout(() => {
        const result = handler.handleReconnect('player1', {});
        expect(result.success).toBe(false);
        expect(result.reason).toBe('reconnect_window_expired');
        resolve();
      }, 150);
    });
  }, 10000); // 10 second timeout

  test('should get reconnection info', () => {
    handler.onPlayerConnect('player1');
    handler.onPlayerDisconnect('player1');

    const info = handler.getReconnectInfo('player1');

    expect(info).not.toBeNull();
    expect(info.playerId).toBe('player1');
    expect(info.reconnectDeadline).toBeGreaterThan(info.disconnectTime);
  });

  test('should record pending actions', () => {
    handler.onPlayerConnect('player1');
    handler.onPlayerDisconnect('player1');

    handler.recordPendingAction('player1', { type: 'turn_executed', turn: 1 });

    const info = handler.getReconnectInfo('player1');
    expect(info.pendingActions).toHaveLength(1);
  });

  test('should get connection state', () => {
    expect(handler.getConnectionState('player1')).toBe(ConnectionState.CONNECTED);

    handler.onPlayerConnect('player1');
    handler.onPlayerDisconnect('player1');

    expect(handler.getConnectionState('player1')).toBe(ConnectionState.DISCONNECTED);
  });

  test('should get stats', () => {
    handler.onPlayerConnect('player1');
    handler.onPlayerConnect('player2');
    handler.onPlayerDisconnect('player1');

    const stats = handler.getStats();

    expect(stats.totalPlayers).toBe(2);
    expect(stats.connected).toBe(1);
    expect(stats.disconnected).toBe(1);
  });
});

describe('AntiCheat', () => {
  let engine;
  let antiCheat;

  beforeEach(() => {
    engine = createMockGameEngine();
    antiCheat = new AntiCheat(engine, {
      maxActionsPerMinute: 10,
      minActionInterval: 100
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should validate valid input', () => {
    const result = antiCheat.validateInput('player1', { type: 'build' });
    expect(result.valid).toBe(true);
  });

  test('should reject invalid action type', () => {
    const result = antiCheat.validateInput('player1', { type: 'invalid_action' });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe(ValidationError.INVALID_ACTION_TYPE);
  });

  test('should reject action too fast', () => {
    // Submit multiple actions quickly
    antiCheat.validateInput('player1', { type: 'build' });
    const result = antiCheat.validateInput('player1', { type: 'pass' });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe(ValidationError.ACTION_TOO_FAST);
  });

  test('should track action timestamps', () => {
    for (let i = 0; i < 5; i++) {
      antiCheat.validateInput('player1', { type: 'build' });
    }

    const report = antiCheat.getAnomalyReport('player1');
    expect(report.actionsPerMinute).toBeGreaterThan(0);
  });

  test('should ban and unban players', () => {
    antiCheat.banPlayer('cheater', 'Speed hacking');

    expect(antiCheat.isBanned('cheater')).toBe(true);

    const result = antiCheat.validateInput('cheater', { type: 'build' });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('player_banned');

    antiCheat.unbanPlayer('cheater');
    expect(antiCheat.isBanned('cheater')).toBe(false);
  });

  test('should detect suspicious players', () => {
    // Disable timing check to allow rapid actions
    antiCheat.config.enableTimingCheck = false;
    
    // Submit many actions to exceed APM threshold
    // With maxActionsPerMinute = 10, we need > 8 actions
    for (let i = 0; i < 15; i++) {
      antiCheat.validateInput('player1', { type: 'build' });
    }

    // Check that player has high APM
    const report = antiCheat.getAnomalyReport('player1');
    expect(report.actionsPerMinute).toBeGreaterThan(8);
    expect(antiCheat.isSuspicious('player1')).toBe(true);
  });

  test('should clear player data', () => {
    antiCheat.validateInput('player1', { type: 'build' });
    antiCheat.clearPlayerData('player1');

    const report = antiCheat.getAnomalyReport('player1');
    expect(report.actionsPerMinute).toBe(0);
  });
});

describe('MessageQueue', () => {
  let queue;

  beforeEach(() => {
    queue = new MessageQueue({
      batchSize: 5,
      flushInterval: 50
    });
  });

  afterEach(() => {
    queue.destroy();
    jest.clearAllMocks();
  });

  test('should enqueue messages', () => {
    const id = queue.enqueue({ type: 'test' });
    expect(id).toBeDefined();
    expect(queue.size()).toBe(1);
  });

  test('should prioritize messages', () => {
    queue.enqueueLow({ type: 'low' });
    queue.enqueueHigh({ type: 'high' });
    queue.enqueue({ type: 'normal' });

    // High priority should come first
    expect(queue.size(MessagePriority.HIGH)).toBe(1);
    expect(queue.size(MessagePriority.LOW)).toBe(1);
  });

  test('should flush messages', () => {
    const sent = [];
    queue.setSendCallback((data) => sent.push(data));

    queue.enqueue({ type: 'test1' });
    queue.enqueue({ type: 'test2' });

    queue.start();

    return new Promise((resolve) => {
      setTimeout(() => {
        queue.stop();
        expect(sent.length).toBeGreaterThan(0);
        resolve();
      }, 100);
    });
  });

  test('should get queue status', () => {
    queue.enqueue({ type: 'test' });

    const status = queue.getStatus();

    expect(status.total).toBe(1);
    expect(status.isRunning).toBe(false);
  });

  test('should clear queue', () => {
    queue.enqueue({ type: 'test' });
    queue.clear();

    expect(queue.isEmpty()).toBe(true);
  });

  test('should remove specific message', () => {
    const id = queue.enqueue({ type: 'test' });
    queue.remove(id);

    expect(queue.size()).toBe(0);
  });

  test('should set event handlers', () => {
    let droppedCalled = false;
    queue.setHandlers({
      onDropped: () => { droppedCalled = true; }
    });

    // Create full queue to trigger drop
    const smallQueue = new MessageQueue({ maxQueueSize: 2 });
    for (let i = 0; i < 5; i++) {
      smallQueue.enqueue({ type: `msg${i}` });
    }
    smallQueue.setHandlers({ onDropped: () => { droppedCalled = true; } });
  });
});

describe('SpectatorSystem', () => {
  let spectator;
  let mockConnection;

  beforeEach(() => {
    spectator = new SpectatorSystem({
      delayMs: 10
    });

    mockConnection = {
      id: 'spectator1',
      send: jest.fn()
    };
  });

  afterEach(() => {
    // Clean up all registered games to prevent state leakage
    if (spectator && typeof spectator.cleanupGame === 'function') {
      // Get all registered game IDs and clean them up
      const gameIds = spectator.gameSpectators ? Array.from(spectator.gameSpectators.keys()) : [];
      for (const gameId of gameIds) {
        spectator.cleanupGame(gameId);
      }
    }
    spectator = null;
    mockConnection = null;
    jest.clearAllMocks();
  });

  test('should register and unregister games', () => {
    spectator.registerGame('game1');

    expect(spectator.getSpectatorCount('game1')).toBe(0);

    spectator.unregisterGame('game1');
    expect(spectator.getSpectatorCount('game1')).toBe(0);
  });

  test('should add and remove spectators', () => {
    spectator.registerGame('game1');

    const result = spectator.joinSpectator('game1', mockConnection);

    expect(result.success).toBe(true);
    expect(spectator.getSpectatorCount('game1')).toBe(1);

    spectator.leaveSpectator('game1', mockConnection);
    expect(spectator.getSpectatorCount('game1')).toBe(0);
  });

  test('should limit spectators', () => {
    spectator.config.maxSpectators = 2;
    spectator.registerGame('game1');

    spectator.joinSpectator('game1', { id: 's1', send: jest.fn() });
    spectator.joinSpectator('game1', { id: 's2', send: jest.fn() });

    const result = spectator.joinSpectator('game1', { id: 's3', send: jest.fn() });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('spectator_limit_reached');
  });

  test('should record and replay events', (done) => {
    spectator.registerGame('game1');
    spectator.joinSpectator('game1', mockConnection);

    spectator.recordEvent('game1', { type: 'turn_executed', turn: 1 });

    setTimeout(() => {
      expect(mockConnection.send).toHaveBeenCalled();
      done();
    }, 50);
  });

  test('should update snapshots', () => {
    spectator.registerGame('game1');
    spectator.updateSnapshot('game1', { turn: 5, phase: 'main' });

    const history = spectator.getReplayHistory('game1');
    expect(history).toEqual([]);
  });

  test('should get active games', () => {
    spectator.registerGame('game1');
    spectator.registerGame('game2');
    spectator.joinSpectator('game1', { id: 's1', send: jest.fn() });

    const active = spectator.getActiveGames();

    expect(active).toContain('game1');
    expect(active).not.toContain('game2');
  });

  test('should kick spectators', () => {
    spectator.registerGame('game1');
    spectator.joinSpectator('game1', mockConnection);

    spectator.kickSpectator('game1', mockConnection, 'Inappropriate behavior');

    expect(spectator.getSpectatorCount('game1')).toBe(0);
    expect(mockConnection.send).toHaveBeenCalledWith(
      expect.stringContaining('kicked')
    );
  });

  test('should get spectator stats', () => {
    spectator.registerGame('game1');
    spectator.joinSpectator('game1', { id: 's1', send: jest.fn() });

    const stats = spectator.getStats();

    expect(stats.totalSpectators).toBe(1);
    expect(stats.activeGames).toBe(1);
  });
});

describe('Integration', () => {
  test('should work together as a complete system', () => {
    // Create components
    const engine = createMockGameEngine();
    const synchronizer = new LockstepSynchronizer(engine);
    const disconnectHandler = new DisconnectHandler();
    const antiCheat = new AntiCheat(engine);
    const messageQueue = new MessageQueue();
    const spectatorSystem = new SpectatorSystem();

    // Register players
    synchronizer.registerPlayers(['player1', 'player2']);

    // Start game
    synchronizer.startNewTurn();

    // Simulate player connections
    disconnectHandler.onPlayerConnect('player1');
    disconnectHandler.onPlayerConnect('player2');

    // Submit inputs
    const validation1 = antiCheat.validateInput('player1', { type: 'build' });
    expect(validation1.valid).toBe(true);

    synchronizer.submitInput('player1', { type: 'build' });
    synchronizer.submitInput('player2', { type: 'pass' });

    // Simulate disconnect
    disconnectHandler.onPlayerDisconnect('player1');
    expect(disconnectHandler.isDisconnected('player1')).toBe(true);

    // Verify turn advanced
    expect(synchronizer.currentTurn).toBe(1);

    // Cleanup
    synchronizer.destroy();
    disconnectHandler.destroy();
    messageQueue.destroy();
  });
});
