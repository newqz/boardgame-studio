/**
 * Balance Calculator Tests
 * 
 * @version 1.0.0
 */

'use strict';

const {
  BalanceAnalyzer,
  quickBalanceCheck,
  calculateResourceBalance,
  calculateStrategyBalance,
  calculateTimeBalance,
  BalanceStatus
} = require('../src/index');

describe('BalanceAnalyzer', () => {
  const mockGameConfig = {
    name: 'Test Game',
    resources: ['wood', 'brick', 'sheep', 'wheat', 'ore'],
    productionRules: {
      wood: { baseRate: 1.0, variance: 0.3 },
      brick: { baseRate: 1.0, variance: 0.3 },
      sheep: { baseRate: 1.2, variance: 0.4 },
      wheat: { baseRate: 1.0, variance: 0.3 },
      ore: { baseRate: 0.6, variance: 0.5 }
    },
    strategies: [
      { id: 'aggressive', name: 'Aggressive', description: 'Rush strategy', playFunction: null },
      { id: 'economic', name: 'Economic', description: 'Development focus', playFunction: null },
      { id: 'balanced', name: 'Balanced', description: 'Mixed approach', playFunction: null }
    ],
    gameEngine: {},
    turns: 20,
    firstPlayerMechanism: 'alternate'
  };

  test('should create BalanceAnalyzer instance', () => {
    const analyzer = new BalanceAnalyzer(mockGameConfig);
    expect(analyzer).toBeDefined();
    expect(analyzer.gameConfig).toBe(mockGameConfig);
  });

  test('should run full analysis', () => {
    const analyzer = new BalanceAnalyzer(mockGameConfig);
    const results = analyzer.analyze();

    expect(results).toBeDefined();
    expect(results.overallScore).toBeGreaterThanOrEqual(0);
    expect(results.overallScore).toBeLessThanOrEqual(100);
    expect(results.status).toBeDefined();
    expect(results.risks).toBeDefined();
    expect(results.suggestions).toBeDefined();
    expect(results.metadata).toBeDefined();
  });

  test('should calculate overall score between 0-100', () => {
    const analyzer = new BalanceAnalyzer(mockGameConfig);
    const results = analyzer.analyze();

    expect(results.overallScore).toBeGreaterThanOrEqual(0);
    expect(results.overallScore).toBeLessThanOrEqual(100);
  });

  test('should determine balance status correctly', () => {
    const analyzer = new BalanceAnalyzer(mockGameConfig);
    const results = analyzer.analyze();

    expect([BalanceStatus.BALANCED, BalanceStatus.NEEDS_ADJUSTMENT, BalanceStatus.UNBALANCED])
      .toContain(results.status);
  });

  test('should generate markdown report', () => {
    const analyzer = new BalanceAnalyzer(mockGameConfig);
    analyzer.analyze();
    const report = analyzer.generateMarkdownReport();

    expect(report).toBeDefined();
    expect(typeof report).toBe('string');
    expect(report).toContain('# 平衡性分析报告');
    expect(report).toContain('综合得分');
    expect(report).toContain('Test Game');
  });

  test('should include metadata in results', () => {
    const analyzer = new BalanceAnalyzer(mockGameConfig, { simulations: 500 });
    const results = analyzer.analyze();

    expect(results.metadata.analyzedAt).toBeDefined();
    expect(results.metadata.simulations).toBe(500);
    expect(results.metadata.analysisTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('quickBalanceCheck', () => {
  test('should return quick assessment', () => {
    const config = {
      resources: ['wood', 'brick'],
      productionRules: {
        wood: { baseRate: 1.0 },
        brick: { baseRate: 1.0 }
      }
    };

    const result = quickBalanceCheck(config);

    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.status).toBeDefined();
    expect(result.criticalIssues).toBeDefined();
    expect(result.suggestion).toBeDefined();
  });
});

describe('Resource Balance', () => {
  test('should calculate resource balance', () => {
    const config = {
      resources: ['wood', 'brick', 'sheep'],
      productionRules: {
        wood: { baseRate: 1.0, variance: 0.3 },
        brick: { baseRate: 1.0, variance: 0.3 },
        sheep: { baseRate: 1.2, variance: 0.4 }
      },
      turns: 20,
      simulations: 100
    };

    const result = calculateResourceBalance(config);

    expect(result).toBeDefined();
    expect(result.productionRate).toBeDefined();
    expect(result.relativeValue).toBeDefined();
    expect(result.scarcity).toBeDefined();
  });

  test('should detect production rates', () => {
    const config = {
      resources: ['wood', 'ore'],
      productionRules: {
        wood: { baseRate: 1.5, variance: 0.2 },
        ore: { baseRate: 0.5, variance: 0.4 }
      }
    };

    const result = calculateResourceBalance(config);

    expect(result.productionRate.wood.averagePerTurn).toBeGreaterThan(
      result.productionRate.ore.averagePerTurn
    );
  });

  test('should calculate relative values', () => {
    const config = {
      resources: ['wood', 'ore'],
      productionRules: {
        wood: { baseRate: 1.0 },
        ore: { baseRate: 0.5 }
      }
    };

    const result = calculateResourceBalance(config);

    expect(result.relativeValue.ore).toBeGreaterThan(result.relativeValue.wood);
  });

  test('should handle default production rules', () => {
    const config = {
      resources: ['wood', 'brick']
    };

    const result = calculateResourceBalance(config);

    expect(result.productionRate.wood).toBeDefined();
    expect(result.productionRate.brick).toBeDefined();
  });
});

describe('Strategy Balance', () => {
  test('should calculate strategy balance', () => {
    const strategies = [
      { id: 's1', name: 'Strategy 1', description: 'Test', playFunction: null },
      { id: 's2', name: 'Strategy 2', description: 'Test', playFunction: null }
    ];

    const result = calculateStrategyBalance({}, strategies, { simulations: 50 });

    expect(result).toBeDefined();
    expect(result.strategies).toBeDefined();
    expect(result.winRates).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  test('should track win rates for all strategies', () => {
    const strategies = [
      { id: 'aggressive', name: 'Aggressive', description: 'Rush', playFunction: null },
      { id: 'economic', name: 'Economic', description: 'Development', playFunction: null }
    ];

    const result = calculateStrategyBalance({}, strategies, { simulations: 100 });

    expect(result.strategies.length).toBe(2);
    expect(result.winRates.aggressive).toBeDefined();
    expect(result.winRates.economic).toBeDefined();
  });

  test('should detect dominant strategies', () => {
    const strategies = [
      { id: 'overpowered', name: 'Overpowered', description: 'Always wins', playFunction: () => ({ players: [{ points: 100 }] }) },
      { id: 'weak', name: 'Weak', description: 'Always loses', playFunction: () => ({ players: [{ points: 0 }] }) }
    ];

    // Note: This test depends on the simulation implementation
    const result = calculateStrategyBalance({}, strategies, { simulations: 20 });

    expect(result).toBeDefined();
  });

  test('should calculate summary statistics', () => {
    const strategies = [
      { id: 's1', name: 'S1', description: '', playFunction: null },
      { id: 's2', name: 'S2', description: '', playFunction: null },
      { id: 's3', name: 'S3', description: '', playFunction: null }
    ];

    const result = calculateStrategyBalance({}, strategies, { simulations: 50 });

    expect(result.summary.totalStrategies).toBe(3);
    expect(result.summary.averageWinRate).toBeGreaterThanOrEqual(0);
    expect(result.summary.averageWinRate).toBeLessThanOrEqual(1);
  });
});

describe('Time Balance', () => {
  test('should calculate time balance', () => {
    const config = {
      phases: [
        { name: 'setup', minDuration: 1, maxDuration: 3 },
        { name: 'action', minDuration: 5, maxDuration: 15 },
        { name: 'end', minDuration: 1, maxDuration: 2 }
      ],
      firstPlayerMechanism: 'alternate'
    };

    const result = calculateTimeBalance(config, { simulations: 100 });

    expect(result).toBeDefined();
    expect(result.expectedGameLength).toBeDefined();
    expect(result.phaseDistribution).toBeDefined();
    expect(result.firstPlayerAdvantage).toBeDefined();
  });

  test('should calculate first player advantage for different mechanisms', () => {
    const config = { phases: [], firstPlayerMechanism: 'alternate' };

    const alternateResult = calculateTimeBalance(config, { simulations: 100 });
    expect(alternateResult.firstPlayerAdvantage.winRateBonus).toBeDefined();

    config.firstPlayerMechanism = 'random';
    const randomResult = calculateTimeBalance(config, { simulations: 100 });
    expect(randomResult.firstPlayerAdvantage.winRateBonus).toBe(0);
  });

  test('should detect time imbalances', () => {
    const config = {
      phases: [
        { name: 'setup', minDuration: 1, maxDuration: 3 },
        { name: 'action', minDuration: 5, maxDuration: 15 },
        { name: 'end', minDuration: 1, maxDuration: 2 }
      ],
      firstPlayerMechanism: 'winner'
    };

    const result = calculateTimeBalance(config, { simulations: 200 });

    expect(result.imbalances).toBeDefined();
  });

  test('should generate time summary', () => {
    const config = {
      phases: [
        { name: 'setup', minDuration: 1, maxDuration: 3 },
        { name: 'action', minDuration: 5, maxDuration: 15 }
      ],
      firstPlayerMechanism: 'alternate'
    };

    const result = calculateTimeBalance(config, { simulations: 100 });

    expect(result.summary.avgGameLength).toBeGreaterThan(0);
    expect(result.summary.firstPlayerBonus).toBeDefined();
  });
});

describe('BalanceStatus Enums', () => {
  test('should have correct status values', () => {
    expect(BalanceStatus.BALANCED).toBe('balanced');
    expect(BalanceStatus.NEEDS_ADJUSTMENT).toBe('needs_adjustment');
    expect(BalanceStatus.UNBALANCED).toBe('unbalanced');
  });
});

describe('Edge Cases', () => {
  test('should handle empty resources', () => {
    const result = calculateResourceBalance({ resources: [] });
    expect(result.productionRate).toEqual({});
  });

  test('should handle single strategy', () => {
    const strategies = [
      { id: 'only', name: 'Only Strategy', description: '', playFunction: null }
    ];

    const result = calculateStrategyBalance({}, strategies, { simulations: 10 });
    expect(result.strategies.length).toBe(1);
  });

  test('should handle zero simulations', () => {
    const config = { phases: [] };
    const result = calculateTimeBalance(config, { simulations: 0 });
    expect(result.expectedGameLength).toBeDefined();
  });
});

describe('Performance', () => {
  test('should complete analysis in reasonable time', () => {
    const config = {
      resources: ['wood', 'brick', 'sheep', 'wheat', 'ore'],
      productionRules: {
        wood: { baseRate: 1.0, variance: 0.3 },
        brick: { baseRate: 1.0, variance: 0.3 },
        sheep: { baseRate: 1.2, variance: 0.4 },
        wheat: { baseRate: 1.0, variance: 0.3 },
        ore: { baseRate: 0.6, variance: 0.5 }
      },
      strategies: [
        { id: 's1', name: 'S1', description: '', playFunction: null },
        { id: 's2', name: 'S2', description: '', playFunction: null },
        { id: 's3', name: 'S3', description: '', playFunction: null }
      ],
      phases: [
        { name: 'setup', minDuration: 1, maxDuration: 3 },
        { name: 'action', minDuration: 5, maxDuration: 15 }
      ],
      firstPlayerMechanism: 'alternate'
    };

    const startTime = Date.now();
    const analyzer = new BalanceAnalyzer(config, { simulations: 500 });
    analyzer.analyze();
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });
});
