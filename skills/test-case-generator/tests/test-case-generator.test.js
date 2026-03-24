/**
 * Test Case Generator Tests
 * 
 * @version 1.0.0
 */

'use strict';

const {
  TestCaseGenerator,
  TestDataGenerator,
  DEFAULT_CONFIG
} = require('../src/index');

describe('TestCaseGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new TestCaseGenerator();
  });

  test('should initialize with default config', () => {
    expect(generator.config.coverageTarget).toBe(90);
    expect(generator.config.modules).toContain('engine');
  });

  test('should generate unit tests for a method', () => {
    const cases = generator.generateUnitTests('ResourceManager', 'addResource', {
      setup: ['Initialize manager'],
      expectedResult: 'Resource added successfully',
      errorCases: [
        { description: 'negative amount', input: '-5', expectedError: 'Invalid amount' }
      ]
    });

    expect(cases.length).toBeGreaterThanOrEqual(1);
    expect(cases[0].type).toBe('unit');
    expect(cases[0].id).toContain('RESOURCEMANAGER');
  });

  test('should generate boundary tests', () => {
    const boundaries = [
      { name: 'resources', min: 0, max: 19 }
    ];

    const cases = generator.generateBoundaryTests('Player', boundaries);

    expect(cases.length).toBeGreaterThanOrEqual(4); // min, max, below, above
    expect(cases.some(c => c.tags.includes('minimum'))).toBe(true);
    expect(cases.some(c => c.tags.includes('maximum'))).toBe(true);
  });

  test('should generate integration tests', () => {
    const integrations = [
      {
        description: 'Trade between players',
        components: ['TradeManager', 'ResourceManager'],
        expectedResult: 'Resources transferred correctly'
      }
    ];

    const cases = generator.generateIntegrationTests('Game', integrations);

    expect(cases.length).toBe(1);
    expect(cases[0].type).toBe('integration');
    expect(cases[0].description).toBe('Trade between players');
  });

  test('should generate performance tests', () => {
    const perfSpec = {
      loadTest: { concurrent: 100, maxDuration: 1000 }
    };

    const cases = generator.generatePerformanceTests('Engine', perfSpec);

    expect(cases.length).toBeGreaterThanOrEqual(1);
    expect(cases[0].type).toBe('performance');
  });

  test('should generate tests for a module', () => {
    const moduleSpec = {
      methods: {
        addResource: { setup: [], expectedResult: 'OK' }
      },
      boundaries: [{ name: 'amount', min: 0, max: 100 }]
    };

    const cases = generator.generateForModule('ResourceManager', moduleSpec);

    expect(cases.length).toBeGreaterThan(0);
    expect(generator.testCases.length).toBe(cases.length);
  });

  test('should filter by type', () => {
    generator.generateUnitTests('Test', 'method', {});
    generator.generateBoundaryTests('Test', [{ name: 'x', min: 0, max: 10 }]);

    const unitTests = generator.getByType('unit');
    const boundaryTests = generator.getByType('boundary');

    expect(unitTests.length).toBeGreaterThan(0);
    expect(boundaryTests.length).toBeGreaterThan(0);
  });

  test('should filter by priority', () => {
    generator.generateUnitTests('Test', 'method', {
      errorCases: [{ description: 'error', priority: 'P1' }]
    });

    const p0Tests = generator.getByPriority('P0');
    const p1Tests = generator.getByPriority('P1');

    expect(p0Tests.length).toBeGreaterThan(0);
    expect(p1Tests.length).toBeGreaterThan(0);
  });

  test('should filter by tag', () => {
    generator.generateUnitTests('Test', 'method', {});

    const tests = generator.getByTag('happy-path');
    expect(tests.length).toBeGreaterThan(0);
  });

  test('should export to Jest format', () => {
    generator.generateUnitTests('Test', 'method', {});

    const jestCode = generator.exportToJest();

    expect(jestCode).toContain('describe');
    expect(jestCode).toContain('it(');
    expect(jestCode).toContain('expect');
  });

  test('should export to Markdown format', () => {
    generator.generateUnitTests('Test', 'method', {});

    const markdown = generator.exportToMarkdown();

    expect(markdown).toContain('# Test Cases');
    expect(markdown).toContain('## TC-');
  });

  test('should get statistics', () => {
    generator.generateUnitTests('Test', 'method', {});
    generator.generateBoundaryTests('Test', [{ name: 'x', min: 0, max: 10 }]);

    const stats = generator.getStats();

    expect(stats.total).toBeGreaterThan(0);
    expect(stats.byType.unit).toBeGreaterThan(0);
    expect(stats.byType.boundary).toBeGreaterThan(0);
    expect(stats.coverageEstimate).toBeGreaterThan(0);
  });

  test('should clear test cases', () => {
    generator.generateUnitTests('Test', 'method', {});
    expect(generator.testCases.length).toBeGreaterThan(0);

    generator.clear();
    expect(generator.testCases.length).toBe(0);
  });
});

describe('TestDataGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new TestDataGenerator();
  });

  test('should generate random game state', () => {
    const state = generator.generateRandomGameState('simple');

    expect(state).toHaveProperty('turn');
    expect(state).toHaveProperty('phase');
    expect(state).toHaveProperty('players');
    expect(state).toHaveProperty('board');
  });

  test('should generate different complexities', () => {
    const simple = generator.generateRandomGameState('simple');
    const medium = generator.generateRandomGameState('medium');
    const full = generator.generateRandomGameState('full');

    // All should have valid player counts within range
    const simplePlayers = Object.keys(simple.players).length;
    const mediumPlayers = Object.keys(medium.players).length;
    const fullPlayers = Object.keys(full.players).length;

    expect(simplePlayers).toBeGreaterThanOrEqual(2);
    expect(simplePlayers).toBeLessThanOrEqual(6);
    expect(mediumPlayers).toBeGreaterThanOrEqual(2);
    expect(mediumPlayers).toBeLessThanOrEqual(6);
    expect(fullPlayers).toBeGreaterThanOrEqual(2);
    expect(fullPlayers).toBeLessThanOrEqual(6);

    // Full complexity should have more detailed board
    expect(full.board.tiles.length).toBeGreaterThanOrEqual(simple.board.tiles.length);
  });

  test('should generate boundary cases', () => {
    const cases = generator.generateBoundaryCases();

    expect(cases.length).toBeGreaterThan(0);
    expect(cases.some(c => c.name === 'empty_game')).toBe(true);
    expect(cases.some(c => c.name === 'no_resources')).toBe(true);
  });

  test('should generate player combinations', () => {
    const combos = generator.generatePlayerCombinations(5);

    expect(combos.length).toBe(5);
    expect(combos[0]).toHaveProperty('players');
    expect(combos[0]).toHaveProperty('playerCount');
  });

  test('should generate dice distribution', () => {
    const distribution = generator.generateDiceDistribution(100);

    expect(Object.keys(distribution).length).toBe(11); // 2-12
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  test('should have valid resource amounts', () => {
    const state = generator.generateRandomGameState('medium');

    for (const player of Object.values(state.players)) {
      for (const [resource, amount] of Object.entries(player.resources)) {
        expect(amount).toBeGreaterThanOrEqual(0);
        expect(amount).toBeLessThanOrEqual(generator.config.maxResources);
      }
    }
  });
});

describe('Integration', () => {
  test('should work together', () => {
    const caseGen = new TestCaseGenerator();
    const dataGen = new TestDataGenerator();

    // Generate test data
    const gameState = dataGen.generateRandomGameState('medium');

    // Generate tests based on the state
    const moduleSpec = {
      methods: {
        validateState: {
          setup: ['Load generated state'],
          expectedResult: 'State is valid'
        }
      }
    };

    const cases = caseGen.generateForModule('Game', moduleSpec);

    expect(cases.length).toBeGreaterThan(0);
    expect(gameState).toBeDefined();
  });
});
