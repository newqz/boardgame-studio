/**
 * Game State Manager - Jest Tests
 * @version 2.0.0
 */

'use strict';

const {
  GameStateManager,
  GameStateSerializer,
  SnapshotManager,
  DeltaSync,
  StateValidator,
  deepEquals,
  deepClone
} = require('../src/index');

// ==================== 测试辅助函数 ====================

function createTestGameState(overrides = {}) {
  return {
    gameId: 'test-game-001',
    turnNumber: 1,
    currentPlayer: 'player1',
    gameOver: false,
    winner: null,
    players: {
      player1: {
        id: 'player1',
        resources: { wood: 2, brick: 1, sheep: 0, wheat: 0, ore: 0 },
        devCards: [],
        victoryPoints: 0
      },
      player2: {
        id: 'player2',
        resources: { wood: 1, brick: 2, sheep: 0, wheat: 0, ore: 0 },
        devCards: [],
        victoryPoints: 0
      }
    },
    board: {
      hexes: [],
      robberPosition: null
    },
    ...overrides
  };
}

// ==================== Serializer Tests ====================

describe('GameStateSerializer', () => {
  let serializer;

  beforeEach(() => {
    serializer = new GameStateSerializer();
  });

  test('should serialize and deserialize state correctly', () => {
    const state = createTestGameState();
    const serialized = serializer.serialize(state);
    const deserialized = serializer.deserialize(serialized);

    expect(deserialized.gameId).toBe(state.gameId);
    expect(deserialized.turnNumber).toBe(state.turnNumber);
    expect(deserialized.players.player1.resources.wood).toBe(2);
  });

  test('should calculate checksum correctly', () => {
    const state = createTestGameState();
    const checksum = serializer.calculateChecksum(state);

    expect(checksum).toHaveLength(16);
    expect(typeof checksum).toBe('string');
  });

  test('should detect corrupted data via checksum', () => {
    const state = createTestGameState();
    const serialized = serializer.serialize(state);

    // Tamper with the checksum (not the data)
    serialized.checksum = 'tampered_checksum_000';

    expect(() => serializer.deserialize(serialized)).toThrow();
  });

  test('should throw on invalid input', () => {
    expect(() => serializer.serialize(null)).toThrow();
    expect(() => serializer.serialize(undefined)).toThrow();
  });

  test('should handle null values in state', () => {
    const state = createTestGameState({ winner: null });
    const serialized = serializer.serialize(state);
    const deserialized = serializer.deserialize(serialized);

    expect(deserialized.winner).toBeNull();
  });

  test('should compress data when enabled', () => {
    const serializer = new GameStateSerializer({ compression: true });
    const state = createTestGameState();

    const serialized = serializer.serialize(state);
    expect(serialized.data).toBeDefined();
  });
});

// ==================== SnapshotManager Tests ====================

describe('SnapshotManager', () => {
  let snapshotManager;
  let initialState;

  beforeEach(() => {
    snapshotManager = new SnapshotManager({ maxSnapshots: 5 });
    initialState = createTestGameState();
  });

  test('should create snapshot with ID', () => {
    const snapshot = snapshotManager.createSnapshot(initialState, 'Initial');

    expect(snapshot.id).toBeDefined();
    expect(snapshot.label).toBe('Initial');
    expect(snapshot.timestamp).toBeLessThanOrEqual(Date.now());
  });

  test('should restore snapshot correctly', () => {
    const snapshot = snapshotManager.createSnapshot(initialState, 'Initial');

    const modified = createTestGameState({ turnNumber: 5 });
    snapshotManager.createSnapshot(modified, 'Modified');

    const restored = snapshotManager.restoreSnapshot(snapshot.id);
    expect(restored.turnNumber).toBe(1);
  });

  test('should auto-cleanup old snapshots', () => {
    // Create more than maxSnapshots
    for (let i = 0; i < 10; i++) {
      snapshotManager.createSnapshot(
        createTestGameState({ turnNumber: i }),
        `Turn ${i}`
      );
    }

    const stats = snapshotManager.getStats();
    expect(stats.total).toBeLessThanOrEqual(5);
  });

  test('should return latest snapshot', () => {
    snapshotManager.createSnapshot(initialState, 'First');
    const second = createTestGameState({ turnNumber: 2 });
    snapshotManager.createSnapshot(second, 'Second');

    const latest = snapshotManager.getLatest();
    expect(latest.label).toBe('Second');
  });

  test('should handle non-existent snapshot', () => {
    expect(() => snapshotManager.restoreSnapshot('non-existent')).toThrow();
  });
});

// ==================== DeltaSync Tests ====================

describe('DeltaSync', () => {
  let deltaSync;

  beforeEach(() => {
    deltaSync = new DeltaSync();
  });

  test('should detect single resource change', () => {
    const state1 = createTestGameState();
    const state2 = createTestGameState();
    state2.players.player1.resources.wood = 5;

    const delta = deltaSync.diff(state1, state2);

    expect(delta.fullState).toBe(false);
    expect(delta.changes.length).toBeGreaterThan(0);
    expect(delta.changes[0].path).toBe('players.player1.resources.wood');
    expect(delta.changes[0].newValue).toBe(5);
  });

  test('should apply delta correctly', () => {
    const state1 = createTestGameState();
    const state2 = createTestGameState();
    state2.players.player1.resources.wood = 5;

    const delta = deltaSync.diff(state1, state2);
    const applied = deltaSync.applyDelta(state1, delta);

    expect(applied.players.player1.resources.wood).toBe(5);
  });

  test('should reverse delta correctly (undo)', () => {
    const state1 = createTestGameState();
    const state2 = createTestGameState();
    state2.players.player1.resources.wood = 5;

    const delta = deltaSync.diff(state1, state2);
    const reversed = deltaSync.reverseDelta(state1, delta);
    const undone = deltaSync.applyDelta(state2, reversed);

    expect(undone.players.player1.resources.wood).toBe(2); // Original value
  });

  test('should merge deltas correctly', () => {
    const base = createTestGameState();
    const state1 = createTestGameState();
    state1.players.player1.resources.wood = 5;

    const state2 = createTestGameState();
    state2.players.player2.resources.brick = 10;

    const delta1 = deltaSync.diff(base, state1);
    const delta2 = deltaSync.diff(base, state2);
    const merged = deltaSync.mergeDeltas(delta1, delta2);

    expect(merged.changes.length).toBeGreaterThan(delta1.changes.length);
  });

  test('should compress delta', () => {
    const state1 = createTestGameState();
    const state2 = createTestGameState();
    state2.players.player1.resources.wood = 3;
    state2.players.player1.resources.brick = 4;
    state2.players.player1.resources.sheep = 5;

    const delta = deltaSync.diff(state1, state2);
    const compressed = deltaSync.compressDelta(delta);

    expect(compressed.compressed).toBe(true);
  });

  test('should handle array changes', () => {
    const state1 = createTestGameState();
    state1.players.player1.devCards = [];

    const state2 = createTestGameState();
    state2.players.player1.devCards = [{ type: 'knight', used: false }];

    const delta = deltaSync.diff(state1, state2);
    const applied = deltaSync.applyDelta(state1, delta);

    expect(applied.players.player1.devCards).toHaveLength(1);
    expect(applied.players.player1.devCards[0].type).toBe('knight');
  });
});

// ==================== StateValidator Tests ====================

describe('StateValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new StateValidator();
  });

  test('should validate correct state', () => {
    const state = createTestGameState();
    const result = validator.validate(state);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should detect negative resources', () => {
    const state = createTestGameState();
    state.players.player1.resources.wood = -5;

    const result = validator.validate(state);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === 'negative_resource')).toBe(true);
  });

  test('should detect missing required fields', () => {
    const state = { turnNumber: 1 }; // Missing gameId and players

    const result = validator.validate(state);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === 'missing_field')).toBe(true);
  });

  test('should detect invalid current player', () => {
    const state = createTestGameState();
    state.currentPlayer = 'non-existent-player';

    const result = validator.validate(state);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === 'invalid_current_player')).toBe(true);
  });

  test('should warn when game over without winner', () => {
    const state = createTestGameState();
    state.gameOver = true;
    state.winner = undefined;

    const result = validator.validate(state);

    expect(result.warnings.some(w => w.type === 'missing_winner')).toBe(true);
  });
});

// ==================== GameStateManager Tests ====================

describe('GameStateManager', () => {
  let manager;

  beforeEach(() => {
    manager = new GameStateManager();
  });

  test('should create and retrieve game', () => {
    const state = createTestGameState();
    manager.createGame('game-001', state);

    expect(manager.hasGame('game-001')).toBe(true);
    expect(manager.getGame('game-001').gameId).toBe('game-001');
  });

  test('should update game state', () => {
    const state = createTestGameState();
    manager.createGame('game-001', state);

    const updated = createTestGameState({ turnNumber: 5 });
    manager.updateGame('game-001', updated);

    expect(manager.getGame('game-001').turnNumber).toBe(5);
  });

  test('should create snapshot on update', () => {
    const state = createTestGameState();
    manager.createGame('game-001', state);

    const updated = createTestGameState({ turnNumber: 2 });
    manager.updateGame('game-001', updated);

    const latest = manager.getLatestSnapshot();
    expect(latest.label).toBe('Turn 2');
  });

  test('should diff and apply delta', () => {
    const state = createTestGameState();
    manager.createGame('game-001', state);

    const stateA = manager.getGame('game-001');
    const stateB = createTestGameState({ turnNumber: 3 });
    stateB.players.player1.resources.wood = 10;

    const delta = manager.diff(stateA, stateB);
    const merged = manager.applyDelta(stateA, delta);

    expect(merged.turnNumber).toBe(3);
    expect(merged.players.player1.resources.wood).toBe(10);
  });

  test('should validate state on update', () => {
    const state = createTestGameState();
    manager.createGame('game-001', state);

    const invalid = createTestGameState();
    invalid.players.player1.resources.wood = -100;

    expect(() => manager.updateGame('game-001', invalid)).toThrow();
  });

  test('should delete game', () => {
    const state = createTestGameState();
    manager.createGame('game-001', state);

    expect(manager.deleteGame('game-001')).toBe(true);
    expect(manager.hasGame('game-001')).toBe(false);
  });
});

// ==================== Clone & Equals Tests ====================

describe('Utility Functions', () => {
  test('deepClone should create independent copy', () => {
    const original = { a: 1, b: { c: 2 } };
    const cloned = deepClone(original);

    cloned.b.c = 999;

    expect(original.b.c).toBe(2);
    expect(cloned.b.c).toBe(999);
  });

  test('deepEquals should compare correctly', () => {
    expect(deepEquals({ a: 1 }, { a: 1 })).toBe(true);
    expect(deepEquals({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEquals({ a: { b: 2 } }, { a: { b: 2 } })).toBe(true);
    expect(deepEquals([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEquals([1, 2], [1, 2, 3])).toBe(false);
  });

  test('deepClone should handle arrays', () => {
    const original = [{ id: 1 }, { id: 2 }];
    const cloned = deepClone(original);

    cloned[0].id = 999;

    expect(original[0].id).toBe(1);
    expect(cloned[0].id).toBe(999);
  });
});
