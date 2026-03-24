/**
 * AI Difficulty Tuner Tests
 * 
 * @version 1.0.0
 */

'use strict';

const {
  DifficultyLevel,
  DifficultyRank,
  getPreset,
  getAllLevels,
  isValidLevel,
  compareLevels,
  PlayerEloTracker,
  AdaptiveDifficultyTuner,
  PlayerStyleAnalyzer
} = require('../src/index');

describe('Difficulty Presets', () => {
  test('should have all difficulty levels', () => {
    const levels = getAllLevels();
    expect(levels).toContain(DifficultyLevel.TUTORIAL);
    expect(levels).toContain(DifficultyLevel.EASY);
    expect(levels).toContain(DifficultyLevel.MEDIUM);
    expect(levels).toContain(DifficultyLevel.HARD);
    expect(levels).toContain(DifficultyLevel.EXPERT);
    expect(levels).toContain(DifficultyLevel.UNBEATABLE);
    expect(levels.length).toBe(6);
  });

  test('should get correct preset for each level', () => {
    for (const level of getAllLevels()) {
      const preset = getPreset(level);
      expect(preset).toBeDefined();
      expect(preset.level).toBe(level);
      expect(preset.thinkTime).toBeDefined();
      expect(preset.decisionParams).toBeDefined();
      expect(preset.capabilities).toBeDefined();
    }
  });

  test('should have increasing difficulty parameters', () => {
    const easyPreset = getPreset(DifficultyLevel.EASY);
    const mediumPreset = getPreset(DifficultyLevel.MEDIUM);
    const hardPreset = getPreset(DifficultyLevel.HARD);

    // Higher difficulty = lower mistake rate
    expect(mediumPreset.decisionParams.mistakeRate).toBeLessThan(
      easyPreset.decisionParams.mistakeRate
    );
    expect(hardPreset.decisionParams.mistakeRate).toBeLessThan(
      mediumPreset.decisionParams.mistakeRate
    );

    // Higher difficulty = more lookahead
    expect(mediumPreset.capabilities.maxLookAhead).toBeGreaterThan(
      easyPreset.capabilities.maxLookAhead
    );
    expect(hardPreset.capabilities.maxLookAhead).toBeGreaterThan(
      mediumPreset.capabilities.maxLookAhead
    );
  });

  test('should validate difficulty levels', () => {
    expect(isValidLevel('easy')).toBe(true);
    expect(isValidLevel('medium')).toBe(true);
    expect(isValidLevel('invalid')).toBe(false);
  });

  test('should compare difficulty levels correctly', () => {
    expect(compareLevels(DifficultyLevel.EASY, DifficultyLevel.MEDIUM)).toBeLessThan(0);
    expect(compareLevels(DifficultyLevel.HARD, DifficultyLevel.EASY)).toBeGreaterThan(0);
    expect(compareLevels(DifficultyLevel.MEDIUM, DifficultyLevel.MEDIUM)).toBe(0);
  });

  test('Tutorial preset should have highest mistake rates', () => {
    const tutorial = getPreset(DifficultyLevel.TUTORIAL);
    const easy = getPreset(DifficultyLevel.EASY);

    expect(tutorial.decisionParams.mistakeRate).toBeGreaterThan(easy.decisionParams.mistakeRate);
    expect(tutorial.decisionParams.randomActionRate).toBeGreaterThan(easy.decisionParams.randomActionRate);
    expect(tutorial.capabilities.maxLookAhead).toBeLessThan(easy.capabilities.maxLookAhead);
  });

  test('Unbeatable preset should have zero mistake rates', () => {
    const unbeatable = getPreset(DifficultyLevel.UNBEATABLE);

    expect(unbeatable.decisionParams.mistakeRate).toBe(0);
    expect(unbeatable.decisionParams.randomActionRate).toBe(0);
    expect(unbeatable.decisionParams.explorationRate).toBe(0);
  });
});

describe('PlayerEloTracker', () => {
  let tracker;

  beforeEach(() => {
    tracker = new PlayerEloTracker();
  });

  test('should initialize with default rating', () => {
    const rating = tracker.getRating('player1');
    expect(rating).toBe(1200);
  });

  test('should update rating after win', () => {
    const result = tracker.updateRating('player1', 1200, 1);
    expect(result.newRating).toBeGreaterThan(result.oldRating);
    expect(result.change).toBeGreaterThan(0);
  });

  test('should update rating after loss', () => {
    const result = tracker.updateRating('player1', 1200, 0);
    expect(result.newRating).toBeLessThan(result.oldRating);
    expect(result.change).toBeLessThan(0);
  });

  test('should update rating after draw', () => {
    const result = tracker.updateRating('player1', 1200, 0.5);
    expect(Math.abs(result.change)).toBeLessThan(32);
  });

  test('should calculate expected score correctly', () => {
    // Same rating = 50% expected
    expect(tracker.expectedScore(1200, 1200)).toBeCloseTo(0.5, 1);

    // Higher rated player = higher expected
    expect(tracker.expectedScore(1400, 1200)).toBeGreaterThan(0.5);

    // Lower rated player = lower expected
    expect(tracker.expectedScore(1000, 1200)).toBeLessThan(0.5);
  });

  test('should convert rating to difficulty', () => {
    expect(tracker.ratingToDifficulty(900)).toBe(DifficultyLevel.TUTORIAL);
    expect(tracker.ratingToDifficulty(1050)).toBe(DifficultyLevel.EASY);
    expect(tracker.ratingToDifficulty(1200)).toBe(DifficultyLevel.MEDIUM);
    expect(tracker.ratingToDifficulty(1400)).toBe(DifficultyLevel.HARD);
    expect(tracker.ratingToDifficulty(1600)).toBe(DifficultyLevel.EXPERT);
    expect(tracker.ratingToDifficulty(1900)).toBe(DifficultyLevel.UNBEATABLE);
  });

  test('should convert difficulty to rating', () => {
    expect(tracker.difficultyToRating(DifficultyLevel.TUTORIAL)).toBe(900);
    expect(tracker.difficultyToRating(DifficultyLevel.MEDIUM)).toBe(1200);
    expect(tracker.difficultyToRating(DifficultyLevel.UNBEATABLE)).toBe(1900);
  });

  test('should calculate optimal difficulty for target win rate', () => {
    // A 1200 rated player against a 1200 AI should get medium difficulty for 50% win rate
    expect(tracker.calculateOptimalDifficulty(1200, 0.5)).toBe(DifficultyLevel.MEDIUM);

    // A 900 rated player should get easier difficulty
    expect(DifficultyRank[tracker.calculateOptimalDifficulty(900, 0.5)]).toBeLessThan(
      DifficultyRank[DifficultyLevel.MEDIUM]
    );

    // A 1600 rated player should get harder difficulty
    expect(DifficultyRank[tracker.calculateOptimalDifficulty(1600, 0.5)]).toBeGreaterThan(
      DifficultyRank[DifficultyLevel.MEDIUM]
    );
  });

  test('should track game history', () => {
    tracker.updateRating('player1', 1200, 1);
    tracker.updateRating('player1', 1200, 0);
    tracker.updateRating('player1', 1200, 0.5);

    const history = tracker.getHistory('player1');
    expect(history.length).toBe(3);
  });

  test('should reset player rating', () => {
    tracker.updateRating('player1', 1200, 1);
    tracker.resetRating('player1');
    expect(tracker.getRating('player1')).toBe(1200);
    expect(tracker.getHistory('player1').length).toBe(0);
  });
});

describe('AdaptiveDifficultyTuner', () => {
  let tuner;

  beforeEach(() => {
    tuner = new AdaptiveDifficultyTuner();
  });

  test('should initialize with medium difficulty', () => {
    expect(tuner.getCurrentDifficulty('player1')).toBe(DifficultyLevel.MEDIUM);
  });

  test('should set and get difficulty', () => {
    tuner.setDifficulty('player1', DifficultyLevel.HARD);
    expect(tuner.getCurrentDifficulty('player1')).toBe(DifficultyLevel.HARD);
  });

  test('should get difficulty config', () => {
    tuner.setDifficulty('player1', DifficultyLevel.EASY);
    const config = tuner.getDifficultyConfig('player1');
    expect(config.level).toBe(DifficultyLevel.EASY);
    expect(config.decisionParams.mistakeRate).toBeGreaterThan(0);
  });

  test('should record game results', () => {
    tuner.recordResult('player1', { won: true, turnQuality: 0.8, mistakes: 1 });
    tuner.recordResult('player1', { won: false, turnQuality: 0.6, mistakes: 3 });

    const analysis = tuner.getFullAnalysis('player1');
    expect(analysis.stats.gamesPlayed).toBe(2);
    expect(analysis.metrics.winRate).toBe(0.5);
  });

  test('should analyze performance', () => {
    // Record some games
    for (let i = 0; i < 5; i++) {
      tuner.recordResult('player1', { won: i < 3, turnQuality: 0.7, mistakes: 2 });
    }

    const metrics = tuner.analyzePerformance('player1');
    expect(metrics.gamesPlayed).toBe(5);
    expect(metrics.winRate).toBeCloseTo(0.6, 1);
  });

  test('should suggest increase after winning streak', () => {
    // Record consecutive wins
    for (let i = 0; i < 5; i++) {
      tuner.recordResult('player1', { won: true, turnQuality: 0.9, mistakes: 0 });
    }

    const decision = tuner.shouldAdjustDifficulty('player1');
    expect(decision.adjust).toBe(true);
    expect(decision.direction).toBe('up');
  });

  test('should suggest decrease after losing streak', () => {
    // Record consecutive losses
    for (let i = 0; i < 5; i++) {
      tuner.recordResult('player1', { won: false, turnQuality: 0.3, mistakes: 5 });
    }

    const decision = tuner.shouldAdjustDifficulty('player1');
    expect(decision.adjust).toBe(true);
    expect(decision.direction).toBe('down');
  });

  test('should not adjust with insufficient data', () => {
    tuner.recordResult('player1', { won: true });
    
    const decision = tuner.shouldAdjustDifficulty('player1');
    expect(decision.adjust).toBe(false);
  });

  test('should smoothly transition difficulty', () => {
    tuner.setDifficulty('player1', DifficultyLevel.EASY);
    
    // Large jump
    const newLevel = tuner.smoothTransition('player1', DifficultyLevel.HARD, 0.5);
    expect(DifficultyRank[newLevel]).toBeGreaterThan(DifficultyRank[DifficultyLevel.EASY]);
    expect(DifficultyRank[newLevel]).toBeLessThan(DifficultyRank[DifficultyLevel.HARD]);
  });

  test('should get full analysis', () => {
    tuner.recordResult('player1', { won: true, turnQuality: 0.8, mistakes: 1 });
    
    const analysis = tuner.getFullAnalysis('player1');
    expect(analysis.playerId).toBe('player1');
    expect(analysis.currentDifficulty).toBeDefined();
    expect(analysis.metrics).toBeDefined();
    expect(analysis.stats).toBeDefined();
  });
});

describe('PlayerStyleAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new PlayerStyleAnalyzer();
  });

  test('should return default style for empty history', () => {
    const style = analyzer.analyze([]);
    expect(style.aggressiveness).toBe(0.5);
    expect(style.riskTolerance).toBe(0.5);
    expect(style.strategicDepth).toBe(0.5);
  });

  test('should analyze aggressive players', () => {
    const games = [
      { won: true, actions: [{ type: 'attack' }, { type: 'attack' }, { type: 'defend' }] },
      { won: true, actions: [{ type: 'combat' }, { type: 'steal' }] }
    ];

    const style = analyzer.analyze(games);
    expect(style.aggressiveness).toBeGreaterThan(0.5);
  });

  test('should analyze defensive players', () => {
    const games = [
      { won: true, actions: [{ type: 'defend' }, { type: 'build' }, { type: 'resource' }] },
      { won: false, actions: [{ type: 'defend' }, { type: 'build' }] }
    ];

    const style = analyzer.analyze(games);
    expect(style.aggressiveness).toBeLessThan(0.6);
  });

  test('should calculate risk tolerance', () => {
    const games = [
      { riskyDecisions: 5, successfulRiskyDecisions: 4, totalDecisions: 10, won: true },
      { riskyDecisions: 3, successfulRiskyDecisions: 1, totalDecisions: 8, won: false }
    ];

    const style = analyzer.analyze(games);
    expect(style.riskTolerance).toBeGreaterThan(0);
    expect(style.riskTolerance).toBeLessThan(1);
  });

  test('should calculate strategic depth from mistakes', () => {
    const games = [
      { mistakes: 0, avgTurnQuality: 0.9, won: true },
      { mistakes: 1, avgTurnQuality: 0.8, won: true }
    ];

    const style = analyzer.analyze(games);
    expect(style.strategicDepth).toBeGreaterThan(0.7);
  });

  test('should extract preferred strategies', () => {
    const games = [
      { strategies: ['economic', 'economic', 'military'] },
      { strategies: ['economic', 'trade'] }
    ];

    const style = analyzer.analyze(games);
    expect(style.preferredStrategies).toContain('economic');
  });

  test('should adapt AI to player style', () => {
    const style = {
      aggressiveness: 0.8,
      riskTolerance: 0.2,
      strategicDepth: 0.9,
      adaptationSpeed: 0.3,
      preferredStrategies: []
    };

    const baseDifficulty = {
      decisionParams: { mistakeRate: 0.1 },
      capabilities: { maxLookAhead: 3 },
      thinkTime: { average: 3000, max: 5000 }
    };

    const adapted = analyzer.adaptAItoPlayer(style, baseDifficulty);

    // Against aggressive player (0.8 > 0.6 threshold): mistakeRate *= 1.5 = 0.15
    // Against cautious player (0.2 < 0.5 threshold): mistakeRate *= 0.5 = 0.075
    // So the final mistake rate is 0.075, less than original 0.1 due to risk tolerance effect
    // But lookahead increases for strategic player: maxLookAhead + 2 = 5
    expect(adapted.capabilities.maxLookAhead).toBeGreaterThan(baseDifficulty.capabilities.maxLookAhead);
    
    // Risk-averse player: AI becomes more precise (lower mistake rate for different reason)
    expect(adapted.decisionParams.mistakeRate).toBeLessThanOrEqual(baseDifficulty.decisionParams.mistakeRate);
  });

  test('should get style description', () => {
    const style = {
      aggressiveness: 0.8,
      riskTolerance: 0.9,
      strategicDepth: 0.7,
      preferredStrategies: ['aggressive']
    };

    const description = analyzer.getStyleDescription(style);
    expect(description).toContain('Aggressive');
    expect(description).toContain('Risk-taker');
  });
});

describe('Integration', () => {
  test('should work together as a complete system', () => {
    const tuner = new AdaptiveDifficultyTuner();

    // Simulate a player with clear improving trend
    // TREND_WINDOW is 5 - need improvement within last 5 games
    // Last 5: [false, true, true, true, true] shows clear improvement
    const games = [
      { won: false, turnQuality: 0.4, mistakes: 4 },
      { won: false, turnQuality: 0.5, mistakes: 3 },
      { won: false, turnQuality: 0.5, mistakes: 3 },
      { won: false, turnQuality: 0.6, mistakes: 2 },  // Last 5 starts here
      { won: true, turnQuality: 0.7, mistakes: 1 },
      { won: true, turnQuality: 0.8, mistakes: 1 },
      { won: true, turnQuality: 0.9, mistakes: 0 },
      { won: true, turnQuality: 0.95, mistakes: 0 }
    ];

    // Record games
    for (const game of games) {
      tuner.recordResult('player1', game);
    }

    // Get full analysis
    const analysis = tuner.getFullAnalysis('player1');
    expect(analysis.stats.gamesPlayed).toBe(8);
    expect(analysis.metrics.winRate).toBeGreaterThan(0.5);

    // Trend should be improving - last 5 games are [false, true, true, true, true]
    // first half (2): [false, true] = 1/2 = 50%
    // second half (3): [true, true, true] = 3/3 = 100%
    // diff = 50% > 15% → improving
    expect(analysis.metrics.trend).toBe('improving');
    
    // Player rating should have increased from initial 1200
    expect(analysis.stats.rating).toBeGreaterThan(1200);
  });
});
