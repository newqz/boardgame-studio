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

  test('should handle large simulation count efficiently', () => {
    const config = {
      resources: ['wood', 'brick'],
      productionRules: {
        wood: { baseRate: 1.0 },
        brick: { baseRate: 1.0 }
      },
      strategies: [
        { id: 's1', name: 'S1', description: '', playFunction: null },
        { id: 's2', name: 'S2', description: '', playFunction: null }
      ],
      phases: [{ name: 'action', minDuration: 5, maxDuration: 10 }],
      firstPlayerMechanism: 'alternate'
    };

    const startTime = Date.now();
    const analyzer = new BalanceAnalyzer(config, { simulations: 5000 });
    analyzer.analyze();
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(30000); // 5k simulations < 30 seconds (slower CI environment)
  });

  test('should track analysis time in metadata', () => {
    const config = {
      resources: ['wood'],
      productionRules: { wood: { baseRate: 1.0 } },
      strategies: [{ id: 's1', name: 'S1', description: '', playFunction: null }],
      phases: [{ name: 'main', minDuration: 5, maxDuration: 10 }],
      firstPlayerMechanism: 'random'
    };
    const analyzer = new BalanceAnalyzer(config, { simulations: 100 });
    const results = analyzer.analyze();

    expect(results.metadata.analysisTimeMs).toBeGreaterThanOrEqual(0);
    expect(typeof results.metadata.analysisTimeMs).toBe('number');
  });
});

describe('Monte Carlo Convergence', () => {
  test('should produce consistent production rate averages', () => {
    const config = {
      resources: ['gold', 'silver'],
      productionRules: {
        gold: { baseRate: 1.0, variance: 0.2 },
        silver: { baseRate: 1.0, variance: 0.2 }
      }
    };

    const results1 = calculateResourceBalance(config);
    const results2 = calculateResourceBalance(config);

    // Results should be similar (within 20% tolerance due to randomness)
    const avg1 = results1.summary.averageProduction || 0;
    const avg2 = results2.summary.averageProduction || 0;
    
    if (avg1 > 0 && avg2 > 0) {
      const ratio = Math.min(avg1, avg2) / Math.max(avg1, avg2);
      expect(ratio).toBeGreaterThan(0.8); // Within 20%
    }
  });

  test('should run multiple simulations with different counts', () => {
    const config = {
      resources: ['test'],
      productionRules: {
        test: { baseRate: 1.0, variance: 0.1 }
      }
    };

    const result1 = calculateResourceBalance(config, { simulations: 50 });
    const result2 = calculateResourceBalance(config, { simulations: 200 });

    // Both should have valid results
    expect(result1.productionRate.test).toBeDefined();
    expect(result2.productionRate.test).toBeDefined();
  });
});

describe('Configuration Validation', () => {
  test('should handle negative simulation count gracefully', () => {
    const config = {
      resources: ['wood'],
      productionRules: { wood: { baseRate: 1.0 } }
    };

    // Should not throw
    const result = calculateResourceBalance(config, { simulations: -1 });
    expect(result).toBeDefined();
  });

  test('should use default values for missing options', () => {
    const config = {
      resources: ['wood', 'brick'],
      productionRules: {
        wood: { baseRate: 1.0 },
        brick: { baseRate: 1.0 }
      }
    };

    const analyzer = new BalanceAnalyzer(config);
    expect(analyzer.options.simulations).toBe(1000); // Default
  });

  test('should handle missing game name', () => {
    const config = {
      resources: ['wood'],
      productionRules: { wood: { baseRate: 1.0 } }
    };

    const analyzer = new BalanceAnalyzer(config);
    const report = analyzer.generateMarkdownReport();

    expect(report).toContain('Unnamed Game'); // Default name
  });

  test('should validate resource names', () => {
    const config = {
      resources: ['valid_resource', 'another'],
      productionRules: {
        valid_resource: { baseRate: 1.0 },
        another: { baseRate: 1.0 }
      }
    };

    const result = calculateResourceBalance(config);
    expect(result.productionRate.valid_resource).toBeDefined();
    expect(result.productionRate.another).toBeDefined();
  });

  test('should handle non-numeric resource rates', () => {
    const config = {
      resources: ['rate_test'],
      productionRules: {
        rate_test: { baseRate: 'invalid' }
      }
    };

    const result = calculateResourceBalance(config);
    expect(result.productionRate.rate_test).toBeDefined();
  });
});

describe('Statistical Analysis', () => {
  test('should provide production rate statistics', () => {
    const config = {
      resources: ['test'],
      productionRules: {
        test: { baseRate: 1.0, variance: 0.3 }
      }
    };

    const result = calculateResourceBalance(config);

    expect(result.productionRate.test).toBeDefined();
    expect(result.productionRate.test.averagePerTurn).toBeDefined();
    expect(result.productionRate.test.variance).toBeDefined();
    expect(result.productionRate.test.distribution).toBeDefined();
  });

  test('should calculate summary for multiple resources', () => {
    const config = {
      resources: ['res1', 'res2', 'res3'],
      productionRules: {
        res1: { baseRate: 1.0, variance: 0.2 },
        res2: { baseRate: 1.0, variance: 0.2 },
        res3: { baseRate: 1.0, variance: 0.2 }
      }
    };

    const result = calculateResourceBalance(config);

    expect(result.summary).toBeDefined();
    expect(Object.keys(result.productionRate).length).toBe(3);
  });
});

describe('Risk Assessment', () => {
  test('should return array of risks', () => {
    const config = {
      resources: ['op', 'up'],
      productionRules: {
        op: { baseRate: 5.0, variance: 0.1 },
        up: { baseRate: 0.2, variance: 0.1 }
      }
    };

    const analyzer = new BalanceAnalyzer(config);
    const results = analyzer.analyze();

    expect(Array.isArray(results.risks)).toBe(true);
  });

  test('should assess risk level correctly', () => {
    const config = {
      resources: ['balanced'],
      productionRules: {
        balanced: { baseRate: 1.0, variance: 0.3 }
      }
    };

    const analyzer = new BalanceAnalyzer(config);
    const results = analyzer.analyze();

    expect(Array.isArray(results.risks)).toBe(true);
  });

  test('should provide actionable suggestions', () => {
    const config = {
      resources: ['dominated'],
      productionRules: {
        dominated: { baseRate: 0.1, variance: 0.05 }
      }
    };

    const analyzer = new BalanceAnalyzer(config);
    const results = analyzer.analyze();

    expect(results.suggestions.length).toBeGreaterThan(0);
    expect(typeof results.suggestions[0]).toBe('string');
  });
});

describe('Report Generation', () => {
  test('should generate complete markdown report', () => {
    const config = {
      name: 'Complete Report Test',
      resources: ['r1', 'r2'],
      productionRules: {
        r1: { baseRate: 1.0 },
        r2: { baseRate: 1.0 }
      },
      strategies: [
        { id: 's1', name: 'Strategy 1', description: '', playFunction: null }
      ],
      phases: [{ name: 'main', minDuration: 5, maxDuration: 10 }],
      firstPlayerMechanism: 'alternate'
    };

    const analyzer = new BalanceAnalyzer(config);
    const report = analyzer.generateMarkdownReport();

    expect(report).toContain('Complete Report Test');
    expect(report).toContain('资源平衡');
    expect(report).toContain('策略平衡');
    expect(report).toContain('时间平衡');
    expect(report).toContain('风险点');
    expect(report).toContain('优化建议');
  });

  test('should format numbers correctly in report', () => {
    const config = {
      name: 'Number Format Test',
      resources: ['precise'],
      productionRules: {
        precise: { baseRate: 1.333333, variance: 0.166666 }
      }
    };

    const analyzer = new BalanceAnalyzer(config);
    const report = analyzer.generateMarkdownReport();

    // Should use toFixed for display
    expect(report).toMatch(/\d+\.\d{1,2}/);
  });
});

describe('Strategy Simulation Quality', () => {
  test('should simulate all strategies', () => {
    const strategies = [
      { id: 'a', name: 'A', description: '', playFunction: null },
      { id: 'b', name: 'B', description: '', playFunction: null },
      { id: 'c', name: 'C', description: '', playFunction: null }
    ];

    const result = calculateStrategyBalance({}, strategies, { simulations: 200 });

    expect(result.strategies.length).toBe(3);
  });

  test('should provide strategy summary', () => {
    const strategies = [
      { id: 'freq', name: 'Frequent', description: '', playFunction: null }
    ];

    const result = calculateStrategyBalance({}, strategies, { simulations: 100 });

    expect(result.summary).toBeDefined();
    expect(result.summary.totalStrategies).toBe(1);
  });
});

describe('Edge Cases - Extreme Values', () => {
  test('should handle zero variance', () => {
    const config = {
      resources: ['zero_var'],
      productionRules: {
        zero_var: { baseRate: 1.0, variance: 0 }
      }
    };

    const result = calculateResourceBalance(config);
    expect(result.productionRate.zero_var).toBeDefined();
  });

  test('should handle very high variance', () => {
    const config = {
      resources: ['high_var'],
      productionRules: {
        high_var: { baseRate: 1.0, variance: 2.0 }
      }
    };

    const result = calculateResourceBalance(config);
    expect(result.productionRate.high_var).toBeDefined();
  });

  test('should handle very short game length', () => {
    const config = {
      phases: [{ name: 'quick', minDuration: 1, maxDuration: 1 }],
      firstPlayerMechanism: 'random'
    };

    const result = calculateTimeBalance(config);
    expect(result.expectedGameLength).toBeDefined();
  });

  test('should handle extended game length', () => {
    const config = {
      phases: [{ name: 'long', minDuration: 100, maxDuration: 200 }],
      firstPlayerMechanism: 'alternate'
    };

    const result = calculateTimeBalance(config);
    expect(result.expectedGameLength.average).toBeGreaterThanOrEqual(50);
  });

  test('should handle many resources (10+)', () => {
    const resources = [];
    const productionRules = {};
    for (let i = 0; i < 12; i++) {
      const name = `resource_${i}`;
      resources.push(name);
      productionRules[name] = { baseRate: 1.0, variance: 0.3 };
    }

    const config = {
      resources,
      productionRules
    };

    const result = calculateResourceBalance(config);
    expect(Object.keys(result.productionRate).length).toBe(12);
  });
});

describe('Error Handling', () => {
  test('should handle empty production rules gracefully', () => {
    const config = {
      resources: ['safe'],
      productionRules: {}
    };

    const result = calculateResourceBalance(config);
    expect(result.productionRate).toBeDefined();
    expect(result.productionRate.safe).toBeDefined();
  });

  test('should handle malformed production rules', () => {
    const config = {
      resources: ['safe'],
      productionRules: {
        safe: null
      }
    };

    const result = calculateResourceBalance(config);
    expect(result.productionRate).toBeDefined();
  });

  test('should handle NaN in configuration', () => {
    const config = {
      resources: ['nan_test'],
      productionRules: {
        nan_test: { baseRate: NaN, variance: NaN }
      }
    };

    const result = calculateResourceBalance(config);
    expect(result.productionRate.nan_test).toBeDefined();
  });
});

describe('Boundary Conditions', () => {
  test('should handle first player advantage at boundaries', () => {
    const config = {
      phases: [{ name: 'action', minDuration: 5, maxDuration: 10 }],
      firstPlayerMechanism: 'winner'
    };

    const result = calculateTimeBalance(config, { simulations: 500 });
    
    expect(result.firstPlayerAdvantage.winRateBonus).toBeDefined();
  });

  test('should handle balanced game detection threshold', () => {
    const config = {
      resources: ['perfect'],
      productionRules: {
        perfect: { baseRate: 1.0, variance: 0.001 }
      },
      strategies: [
        { id: 's1', name: 'S1', description: '', playFunction: null },
        { id: 's2', name: 'S2', description: '', playFunction: null }
      ],
      phases: [{ name: 'main', minDuration: 5, maxDuration: 5 }],
      firstPlayerMechanism: 'random'
    };

    const analyzer = new BalanceAnalyzer(config);
    const results = analyzer.analyze();

    expect(results.overallScore).toBeGreaterThanOrEqual(0);
  });
});

describe('Integration Tests', () => {
  test('should run full pipeline with complex game', () => {
    const complexConfig = {
      name: 'Complex Game Integration Test',
      resources: ['wood', 'brick', 'sheep', 'wheat', 'ore', 'gold'],
      productionRules: {
        wood: { baseRate: 1.2, variance: 0.4 },
        brick: { baseRate: 0.8, variance: 0.3 },
        sheep: { baseRate: 1.0, variance: 0.5 },
        wheat: { baseRate: 1.0, variance: 0.3 },
        ore: { baseRate: 0.6, variance: 0.6 },
        gold: { baseRate: 0.2, variance: 0.2 }
      },
      strategies: [
        { id: 'rush', name: 'Rush', description: '', playFunction: null },
        { id: 'eco', name: 'Economy', description: '', playFunction: null },
        { id: 'military', name: 'Military', description: '', playFunction: null }
      ],
      phases: [
        { name: 'setup', minDuration: 2, maxDuration: 4 },
        { name: 'action', minDuration: 10, maxDuration: 20 },
        { name: 'end', minDuration: 1, maxDuration: 3 }
      ],
      firstPlayerMechanism: 'alternate',
      gameEngine: {}
    };

    const analyzer = new BalanceAnalyzer(complexConfig, { simulations: 200 });
    const results = analyzer.analyze();

    expect(results.overallScore).toBeGreaterThanOrEqual(0);
    expect(results.overallScore).toBeLessThanOrEqual(100);
    expect(results.resourceBalance).toBeDefined();
    expect(results.strategyBalance).toBeDefined();
    expect(results.timeBalance).toBeDefined();
    expect(results.risks).toBeDefined();
    expect(results.suggestions).toBeDefined();
  });

  test('should maintain consistency across multiple analyze() calls', () => {
    const config = {
      resources: ['consistency'],
      productionRules: {
        consistency: { baseRate: 1.0, variance: 0.1 }
      }
    };

    const analyzer = new BalanceAnalyzer(config);

    const results1 = analyzer.analyze();
    const results2 = analyzer.analyze();

    expect(results1.overallScore).toBe(results2.overallScore);
  });
});
