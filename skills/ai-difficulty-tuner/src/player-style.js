/**
 * Player Style Analyzer
 * Analyzes player behavior patterns and style
 * 
 * @version 1.0.0
 */

'use strict';

const { getPreset } = require('./difficulty-presets');

/**
 * @typedef {Object} PlayerStyle
 * @property {number} aggressiveness - 0-1, how aggressive the player plays
 * @property {number} riskTolerance - 0-1, risk tolerance level
 * @property {number} strategicDepth - 0-1, strategic thinking depth
 * @property {number} adaptationSpeed - 0-1, how fast player adapts
 * @property {string[]} preferredStrategies - List of commonly used strategies
 */

/**
 * @typedef {Object} StyleAnalysisConfig
 * @property {number} aggressivenessThreshold - Threshold for aggressive classification
 * @property {number} riskThreshold - Threshold for risk tolerance
 * @property {number} strategyWindow - Number of games to analyze for strategies
 */

const DEFAULT_STYLE_CONFIG = Object.freeze({
  aggressivenessThreshold: 0.6,
  riskThreshold: 0.5,
  strategyWindow: 10
});

class PlayerStyleAnalyzer {
  /**
   * Create a new Player Style Analyzer
   * @param {Object} [config={}] - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_STYLE_CONFIG, ...config };
    /** @type {Map<string, PlayerStyle>} */
    this.styles = new Map();
  }

  /**
   * Analyze player style from game history
   * @param {Object[]} gameHistory - Array of game results with actions
   * @returns {PlayerStyle} Player style profile
   */
  analyze(gameHistory) {
    if (gameHistory.length === 0) {
      return this.createDefaultStyle();
    }

    return {
      aggressiveness: this.calculateAggressiveness(gameHistory),
      riskTolerance: this.calculateRiskTolerance(gameHistory),
      strategicDepth: this.calculateStrategicDepth(gameHistory),
      adaptationSpeed: this.calculateAdaptationSpeed(gameHistory),
      preferredStrategies: this.extractStrategies(gameHistory)
    };
  }

  /**
   * Create default style profile
   * @returns {PlayerStyle}
   */
  createDefaultStyle() {
    return {
      aggressiveness: 0.5,
      riskTolerance: 0.5,
      strategicDepth: 0.5,
      adaptationSpeed: 0.5,
      preferredStrategies: []
    };
  }

  /**
   * Calculate player aggressiveness (0-1)
   * Higher = more aggressive play style
   * @param {Object[]} games - Game history
   * @returns {number} Aggressiveness score
   */
  calculateAggressiveness(games) {
    // Look at attack actions vs defensive actions
    let totalActions = 0;
    let aggressiveActions = 0;

    for (const game of games) {
      if (game.actions) {
        for (const action of game.actions) {
          totalActions++;
          if (this.isAggressiveAction(action)) {
            aggressiveActions++;
          }
        }
      }
      // Also consider game-level metrics
      if (game.combatActions !== undefined) {
        aggressiveActions += game.combatActions;
        totalActions += game.combatActions + (game.defensiveActions || 0);
      }
    }

    if (totalActions === 0) {
      // Fallback: estimate from win conditions
      const aggressiveWins = games.filter(g => g.aggressiveWin || false).length;
      return aggressiveWins / games.length;
    }

    return aggressiveActions / totalActions;
  }

  /**
   * Check if an action is aggressive
   * @param {Object} action - Action object
   * @returns {boolean}
   */
  isAggressiveAction(action) {
    const aggressiveTypes = ['attack', 'combat', 'steal', 'block', 'challenge'];
    if (action.type && aggressiveTypes.includes(action.type.toLowerCase())) {
      return true;
    }
    // Check action name for aggressive keywords
    const actionStr = JSON.stringify(action).toLowerCase();
    return aggressiveTypes.some(t => actionStr.includes(t));
  }

  /**
   * Calculate risk tolerance (0-1)
   * Higher = more risk-tolerant
   * @param {Object[]} games - Game history
   * @returns {number} Risk tolerance score
   */
  calculateRiskTolerance(games) {
    let totalRiskyDecisions = 0;
    let riskySuccessful = 0;
    let totalDecisions = 0;

    for (const game of games) {
      if (game.riskyDecisions !== undefined) {
        totalRiskyDecisions += game.riskyDecisions;
        riskySuccessful += game.successfulRiskyDecisions || 0;
        totalDecisions += game.totalDecisions || game.riskyDecisions;
      }
      // Estimate from high-variance outcomes
      if (game.outcomeVariance !== undefined) {
        totalDecisions++;
        if (game.outcomeVariance > 0.5) {
          totalRiskyDecisions++;
          if (game.won) riskySuccessful++;
        }
      }
    }

    if (totalDecisions === 0) {
      return 0.5;
    }

    // Risk tolerance is ratio of risky decisions and their success rate
    const riskyRatio = totalRiskyDecisions / totalDecisions;
    const successRate = riskySuccessful / (totalRiskyDecisions || 1);

    // Combine: high risky ratio + good success = high risk tolerance
    return (riskyRatio + successRate) / 2;
  }

  /**
   * Calculate strategic depth (0-1)
   * Higher = more strategic thinking
   * @param {Object[]} games - Game history
   * @returns {number} Strategic depth score
   */
  calculateStrategicDepth(games) {
    let totalDepth = 0;
    let gamesWithDepth = 0;

    for (const game of games) {
      if (game.avgTurnQuality !== undefined) {
        totalDepth += game.avgTurnQuality;
        gamesWithDepth++;
      }
      if (game.mistakes !== undefined) {
        // Fewer mistakes = higher strategic depth
        // Assume 0 mistakes = depth 1, 5+ mistakes = depth 0
        const mistakeDepth = Math.max(0, 1 - (game.mistakes / 5));
        totalDepth += mistakeDepth;
        gamesWithDepth++;
      }
      if (game.longTermPlanning !== undefined) {
        totalDepth += game.longTermPlanning;
        gamesWithDepth++;
      }
    }

    if (gamesWithDepth === 0) {
      // Estimate from game duration - longer games often mean more strategic
      const avgDuration = games.reduce((sum, g) => sum + (g.duration || 0), 0) / games.length;
      return Math.min(1, avgDuration / 3600); // 1 hour = full depth
    }

    return totalDepth / gamesWithDepth;
  }

  /**
   * Calculate adaptation speed (0-1)
   * Higher = learns faster from previous games
   * @param {Object[]} games - Game history
   * @returns {number} Adaptation speed score
   */
  calculateAdaptationSpeed(games) {
    if (games.length < 3) {
      return 0.5; // Not enough data
    }

    // Calculate improvement from first half to second half
    const halfLength = Math.floor(games.length / 2);
    const firstHalf = games.slice(0, halfLength);
    const secondHalf = games.slice(halfLength);

    const firstHalfWins = firstHalf.filter(g => g.won).length;
    const secondHalfWins = secondHalf.filter(g => g.won).length;

    const firstHalfRate = firstHalfWins / firstHalf.length;
    const secondHalfRate = secondHalfWins / secondHalf.length;

    // Improvement rate (clamped 0-1)
    const improvement = secondHalfRate - firstHalfRate;
    const adaptationSpeed = Math.max(0, Math.min(1, 0.5 + improvement));

    return adaptationSpeed;
  }

  /**
   * Extract preferred strategies from game history
   * @param {Object[]} games - Game history
   * @returns {string[]} List of preferred strategies
   */
  extractStrategies(games) {
    /** @type {Map<string, number>} */
    const strategyCounts = new Map();

    for (const game of games) {
      if (game.strategies) {
        for (const strategy of game.strategies) {
          strategyCounts.set(strategy, (strategyCounts.get(strategy) || 0) + 1);
        }
      }
      if (game.actions) {
        // Infer strategies from actions
        const inferred = this.inferStrategies(game);
        for (const strategy of inferred) {
          strategyCounts.set(strategy, (strategyCounts.get(strategy) || 0) + 1);
        }
      }
    }

    // Sort by frequency and return top 5
    const sorted = [...strategyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([strategy]) => strategy);

    return sorted;
  }

  /**
   * Infer strategies from game actions
   * @param {Object} game - Game object with actions
   * @returns {string[]} Inferred strategies
   */
  inferStrategies(game) {
    const strategies = [];
    const actionCounts = {
      build: 0,
      trade: 0,
      combat: 0,
      resource: 0
    };

    if (game.actions) {
      for (const action of game.actions) {
        const type = action.type?.toLowerCase() || '';
        if (type.includes('build') || type.includes('construct')) {
          actionCounts.build++;
        } else if (type.includes('trade') || type.includes('exchange')) {
          actionCounts.trade++;
        } else if (type.includes('attack') || type.includes('combat')) {
          actionCounts.combat++;
        } else if (type.includes('resource') || type.includes('collect')) {
          actionCounts.resource++;
        }
      }
    }

    // Determine dominant strategy
    const max = Math.max(...Object.values(actionCounts));
    if (max > 0) {
      const dominant = Object.entries(actionCounts).find(([, count]) => count === max);
      if (dominant) {
        strategies.push(dominant[0] + '-focus');
      }
    }

    return strategies;
  }

  /**
   * Adapt AI difficulty config based on player style
   * @param {PlayerStyle} style - Player style profile
   * @param {Object} baseDifficulty - Base difficulty configuration
   * @returns {Object} Adapted difficulty configuration
   */
  adaptAItoPlayer(style, baseDifficulty) {
    const adapted = JSON.parse(JSON.stringify(baseDifficulty));

    // Against aggressive players, AI plays more defensively
    if (style.aggressiveness > this.config.aggressivenessThreshold) {
      adapted.decisionParams.mistakeRate *= 1.5; // AI makes more "mistakes"
      adapted.capabilities.maxLookAhead = Math.max(1, adapted.capabilities.maxLookAhead - 1);
    }

    // Against cautious players, AI can be stronger
    if (style.riskTolerance < (1 - this.config.riskThreshold)) {
      adapted.decisionParams.mistakeRate *= 0.5;
    }

    // Against deep strategic players, AI uses full capabilities
    if (style.strategicDepth > 0.7) {
      adapted.capabilities.maxLookAhead = Math.min(999, adapted.capabilities.maxLookAhead + 2);
      adapted.capabilities.patternRecognition = true;
    }

    // Fast adapters get less time to think (more challenging)
    if (style.adaptationSpeed > 0.7) {
      adapted.thinkTime.average *= 0.8;
      adapted.thinkTime.max *= 0.8;
    }

    // Slow adapters get more time (less challenging)
    if (style.adaptationSpeed < 0.3) {
      adapted.thinkTime.average *= 1.2;
      adapted.thinkTime.max *= 1.2;
    }

    return adapted;
  }

  /**
   * Get style description for a player
   * @param {PlayerStyle} style - Player style
   * @returns {string} Human-readable style description
   */
  getStyleDescription(style) {
    const parts = [];

    if (style.aggressiveness > 0.7) {
      parts.push('Aggressive');
    } else if (style.aggressiveness < 0.3) {
      parts.push('Defensive');
    } else {
      parts.push('Balanced');
    }

    if (style.riskTolerance > 0.7) {
      parts.push('Risk-taker');
    } else if (style.riskTolerance < 0.3) {
      parts.push('Cautious');
    }

    if (style.strategicDepth > 0.7) {
      parts.push('Strategic');
    } else if (style.strategicDepth < 0.3) {
      parts.push('Reactive');
    }

    if (style.preferredStrategies.length > 0) {
      parts.push(`Favors: ${style.preferredStrategies.slice(0, 2).join(', ')}`);
    }

    return parts.join(' | ');
  }
}

module.exports = {
  PlayerStyleAnalyzer,
  DEFAULT_STYLE_CONFIG
};
