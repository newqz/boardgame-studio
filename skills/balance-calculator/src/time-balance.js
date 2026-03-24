/**
 * Time Balance Calculator
 * Analyzes game length, phase distribution, and first player advantage
 * 
 * @version 1.0.0
 */

'use strict';

const { Significance } = require('./structures');

/**
 * @typedef {Object} PhaseInfo
 * @property {string} name - Phase name
 * @property {number} minDuration - Minimum duration in minutes
 * @property {number} maxDuration - Maximum duration in minutes
 * @property {number} probability - Probability of occurring
 */

/**
 * Calculate time balance from game configuration
 * @param {Object} gameConfig - Game configuration
 * @param {Object} [options={}] - Options
 * @param {number} [options.simulations=1000] - Number of simulations
 * @returns {Object} Time balance analysis
 */
function calculateTimeBalance(gameConfig, options = {}) {
  const {
    phases = [],
    firstPlayerMechanism = 'alternate',
    playerCount = 4,
    simulations = 1000
  } = { ...gameConfig, ...options };

  // Simulate game lengths
  const gameLengths = simulateGameLengths(gameConfig, simulations);
  
  // Calculate game length statistics
  const gameLengthStats = calculateGameLengthStats(gameLengths);
  
  // Calculate phase distribution
  const phaseDistribution = calculatePhaseDistribution(phases, gameLengths);
  
  // Calculate first player advantage
  const firstPlayerAdvantage = calculateFirstPlayerAdvantage(
    firstPlayerMechanism,
    playerCount,
    simulations
  );

  // Detect time imbalances
  const imbalances = detectTimeImbalances(gameLengthStats, phaseDistribution, firstPlayerAdvantage);

  return {
    expectedGameLength: gameLengthStats,
    phaseDistribution,
    firstPlayerAdvantage,
    imbalances,
    summary: generateTimeSummary(gameLengthStats, firstPlayerAdvantage, imbalances)
  };
}

/**
 * Simulate game lengths using Monte Carlo
 * @param {Object} gameConfig - Game configuration
 * @param {number} simulations - Number of simulations
 * @returns {number[]} List of game lengths (in turns)
 */
function simulateGameLengths(gameConfig, simulations) {
  const {
    minTurns = 10,
    maxTurns = 50,
    endCondition = { type: 'points', target: 10 },
    phases = []
  } = gameConfig;

  const lengths = [];

  for (let i = 0; i < simulations; i++) {
    let turns = 0;
    const players = Array(4).fill(null).map((_, idx) => ({
      id: idx,
      points: 0,
      resources: {}
    }));

    while (turns < maxTurns) {
      // Simulate one turn
      const currentPlayer = players[turns % players.length];
      
      // Gain points/resources based on phases
      let pointsGained = 0;
      for (const phase of phases) {
        pointsGained += simulatePhaseTurn(phase, currentPlayer);
      }
      
      // Default point gain if no phases
      if (phases.length === 0) {
        pointsGained = Math.random() < 0.3 ? 1 : 0;
      }

      currentPlayer.points += pointsGained;
      turns++;

      // Check end condition
      if (currentPlayer.points >= endCondition.target) {
        break;
      }
    }

    lengths.push(turns);
  }

  return lengths;
}

/**
 * Simulate a single phase turn
 * @param {Object} phase - Phase configuration
 * @param {Object} player - Current player
 * @returns {number} Points gained
 */
function simulatePhaseTurn(phase, player) {
  const { name, pointRate = 0.2 } = phase;
  
  // Higher point rate for later phases
  const phaseMultiplier = {
    'setup': 0,
    'resource': 0,
    'build': 0.1,
    'combat': 0.2,
    'end': 0.3
  }[name.toLowerCase()] || 0.1;

  const effectiveRate = pointRate || phaseMultiplier;
  return Math.random() < effectiveRate ? 1 : 0;
}

/**
 * Calculate game length statistics
 * @param {number[]} lengths - Game lengths
 * @returns {Object} Statistics
 */
function calculateGameLengthStats(lengths) {
  const sorted = [...lengths].sort((a, b) => a - b);
  
  return {
    min: Math.min(...lengths),
    max: Math.max(...lengths),
    average: Math.round(mean(lengths) * 10) / 10,
    median: percentile(sorted, 50),
    p25: percentile(sorted, 25),
    p75: percentile(sorted, 75),
    standardDeviation: Math.round(standardDeviation(lengths) * 10) / 10,
    coefficientOfVariation: Math.round((standardDeviation(lengths) / mean(lengths)) * 100) / 100
  };
}

/**
 * Calculate phase distribution
 * @param {PhaseInfo[]} phases - Phase configurations
 * @param {number[]} gameLengths - Game lengths
 * @returns {Object} Phase distribution
 */
function calculatePhaseDistribution(phases, gameLengths) {
  if (phases.length === 0) {
    // Generate default phases
    phases = [
      { name: 'setup', minDuration: 1, maxDuration: 5, probability: 1 },
      { name: 'resource', minDuration: 2, maxDuration: 10, probability: 1 },
      { name: 'action', minDuration: 5, maxDuration: 20, probability: 1 },
      { name: 'end', minDuration: 1, maxDuration: 3, probability: 1 }
    ];
  }

  const avgGameLength = mean(gameLengths);
  const distribution = {};

  for (const phase of phases) {
    const avgDuration = (phase.minDuration + phase.maxDuration) / 2;
    const percentageOfGame = (avgDuration / avgGameLength) * 100;
    
    distribution[phase.name] = {
      percentageOfGame: Math.round(percentageOfGame * 10) / 10,
      variance: calculatePhaseVariance(phase),
      avgDurationMinutes: avgDuration
    };
  }

  return distribution;
}

/**
 * Calculate variance for a phase
 * @param {Object} phase - Phase configuration
 * @returns {number} Variance
 */
function calculatePhaseVariance(phase) {
  const { minDuration, maxDuration } = phase;
  const range = maxDuration - minDuration;
  return Math.pow(range / 4, 2); // Assume uniform distribution
}

/**
 * Calculate first player advantage
 * @param {string} mechanism - First player selection mechanism
 * @param {number} playerCount - Number of players
 * @param {number} simulations - Number of simulations
 * @returns {Object} First player advantage analysis
 */
function calculateFirstPlayerAdvantage(mechanism, playerCount, simulations) {
  let advantage = 0;
  let significance = Significance.LOW;

  switch (mechanism) {
    case 'alternate':
      // In alternating games, first player advantage is typically low
      // First player moves first but last player has position advantage
      advantage = 2; // 2% bonus
      significance = Significance.LOW;
      break;

    case 'random':
      // Random selection means no systematic advantage
      advantage = 0;
      significance = Significance.LOW;
      break;

    case 'winner':
      // Winner of previous game goes first - high advantage potential
      advantage = 8;
      significance = Significance.HIGH;
      break;

    case 'loser':
      // Loser goes first - sometimes used to balance
      advantage = -3;
      significance = Significance.MEDIUM;
      break;

    case ' bidding':
      // Highest bidder goes first - depends on bidding dynamics
      advantage = 5;
      significance = Significance.MEDIUM;
      break;

    default:
      advantage = 3;
      significance = Significance.MEDIUM;
  }

  // Adjust significance based on advantage magnitude
  if (Math.abs(advantage) > 10) {
    significance = Significance.HIGH;
  } else if (Math.abs(advantage) > 5) {
    significance = Significance.MEDIUM;
  } else {
    significance = Significance.LOW;
  }

  return {
    winRateBonus: advantage,
    significance,
    mechanism,
    description: getAdvantageDescription(mechanism, advantage)
  };
}

/**
 * Get human-readable description of first player advantage
 * @param {string} mechanism - Mechanism type
 * @param {number} advantage - Advantage percentage
 * @returns {string} Description
 */
function getAdvantageDescription(mechanism, advantage) {
  const absAdv = Math.abs(advantage);
  const direction = advantage > 0 ? 'higher' : 'lower';
  
  const descriptions = {
    'alternate': `Alternating first player gives ~${absAdv}% ${direction} win rate due to move order`,
    'random': 'No systematic first player advantage with random selection',
    'winner': `Winner goes first creates ~${absAdv}% ${direction} win rate - high imbalance risk`,
    'loser': `Loser goes first creates slight ${direction} win rate - deliberate balancing`,
    'bidding': `Bidding for first turn creates ~${absAdv}% ${direction} win rate`
  };

  return descriptions[mechanism] || `First player has ~${absAdv}% ${direction} win rate`;
}

/**
 * Detect time-related imbalances
 * @param {Object} gameLengthStats - Game length statistics
 * @param {Object} phaseDistribution - Phase distribution
 * @param {Object} firstPlayerAdvantage - First player advantage
 * @returns {Object[]} List of detected imbalances
 */
function detectTimeImbalances(gameLengthStats, phaseDistribution, firstPlayerAdvantage) {
  const imbalances = [];

  // Check game length variation
  const cv = gameLengthStats.coefficientOfVariation;
  if (cv > 0.5) {
    imbalances.push({
      type: 'high_game_length_variance',
      severity: 'high',
      message: `Game length too variable: CV=${cv}`,
      details: gameLengthStats
    });
  } else if (cv > 0.3) {
    imbalances.push({
      type: 'moderate_game_length_variance',
      severity: 'medium',
      message: `Game length variation notable: CV=${cv}`,
      details: gameLengthStats
    });
  }

  // Check for too short/long games
  if (gameLengthStats.average < 15) {
    imbalances.push({
      type: 'games_too_short',
      severity: 'medium',
      message: `Average game too short: ${gameLengthStats.average} turns`,
      details: gameLengthStats
    });
  } else if (gameLengthStats.average > 40) {
    imbalances.push({
      type: 'games_too_long',
      severity: 'medium',
      message: `Average game too long: ${gameLengthStats.average} turns`,
      details: gameLengthStats
    });
  }

  // Check phase distribution
  for (const [phase, data] of Object.entries(phaseDistribution)) {
    if (data.percentageOfGame > 60) {
      imbalances.push({
        type: 'phase_dominance',
        severity: 'medium',
        message: `${phase} takes ${data.percentageOfGame}% of game - may cause pacing issues`,
        phase
      });
    }
  }

  // Check first player advantage
  if (firstPlayerAdvantage.significance === Significance.HIGH) {
    imbalances.push({
      type: 'high_first_player_advantage',
      severity: 'high',
      message: `First player advantage too high: ${firstPlayerAdvantage.winRateBonus}%`,
      details: firstPlayerAdvantage
    });
  } else if (firstPlayerAdvantage.significance === Significance.MEDIUM) {
    imbalances.push({
      type: 'moderate_first_player_advantage',
      severity: 'medium',
      message: `First player advantage notable: ${firstPlayerAdvantage.winRateBonus}%`,
      details: firstPlayerAdvantage
    });
  }

  return imbalances;
}

/**
 * Generate time balance summary
 * @param {Object} gameLengthStats - Game length stats
 * @param {Object} firstPlayerAdvantage - First player advantage
 * @param {Object[]} imbalances - Detected imbalances
 * @returns {Object} Summary
 */
function generateTimeSummary(gameLengthStats, firstPlayerAdvantage, imbalances) {
  const hasHighSeverity = imbalances.some(i => i.severity === 'high');
  const hasMediumSeverity = imbalances.some(i => i.severity === 'medium');

  return {
    avgGameLength: gameLengthStats.average,
    lengthVariance: gameLengthStats.coefficientOfVariation,
    firstPlayerBonus: firstPlayerAdvantage.winRateBonus,
    firstPlayerSignificance: firstPlayerAdvantage.significance,
    imbalanceCount: imbalances.length,
    hasHighSeverityIssues: hasHighSeverity,
    isBalanced: !hasHighSeverity && gameLengthStats.coefficientOfVariation < 0.3
  };
}

// Statistical helpers
function mean(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function standardDeviation(arr) {
  if (arr.length < 2) return 0;
  const avg = mean(arr);
  return Math.sqrt(arr.reduce((sum, x) => sum + Math.pow(x - avg, 2), 0) / (arr.length - 1));
}

function percentile(sortedArr, p) {
  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedArr[lower];
  return (sortedArr[lower] + sortedArr[upper]) / 2;
}

module.exports = {
  calculateTimeBalance,
  simulateGameLengths,
  calculateFirstPlayerAdvantage,
  detectTimeImbalances,
  generateTimeSummary
};
