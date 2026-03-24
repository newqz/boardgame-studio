/**
 * Strategy Balance Calculator
 * Analyzes strategy viability, win rates, and correlations
 * 
 * @version 1.0.0
 */

'use strict';

/**
 * @typedef {Object} Strategy
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {Function} playFunction - Function that executes the strategy
 */

/**
 * Calculate strategy balance through Monte Carlo simulation
 * @param {Object} gameEngine - Game engine with play method
 * @param {Strategy[]} strategies - List of strategies to evaluate
 * @param {Object} [options={}] - Configuration options
 * @param {number} [options.simulations=1000] - Number of simulations per matchup
 * @param {number} [options.playerCount=4] - Number of players per game
 * @returns {Object} Strategy balance analysis
 */
function calculateStrategyBalance(gameEngine, strategies, options = {}) {
  const {
    simulations = 1000,
    playerCount = 4
  } = options;

  // Initialize win rate tracking
  const winRates = {};
  const gameLengths = {};
  const correlations = {};

  // Initialize all strategy combinations
  for (const strategy of strategies) {
    winRates[strategy.id] = {
      vsRandom: 0,
      vsAggressive: 0,
      vsEconomic: 0,
      overall: 0
    };
    gameLengths[strategy.id] = [];
    correlations[strategy.id] = {};
  }

  // Run simulations
  for (const strategy of strategies) {
    for (const opponent of strategies) {
      let wins = 0;
      let totalGames = 0;

      for (let sim = 0; sim < simulations; sim++) {
        const result = simulateGame(gameEngine, strategy, opponent, playerCount);
        if (result.winner === strategy.id) {
          wins++;
        }
        totalGames++;

        // Track game length
        gameLengths[strategy.id].push(result.turns);
      }

      winRates[strategy.id][getMatchupKey(strategy, opponent)] = wins / totalGames;
    }
  }

  // Calculate overall win rates
  for (const strategy of strategies) {
    const totalWins = Object.values(winRates[strategy.id]).reduce((a, b) => a + b, 0);
    winRates[strategy.id].overall = totalWins / ((strategies.length) * simulations);
  }

  // Calculate strategy correlations (how similar are their outcomes)
  calculateCorrelations(strategies, winRates, correlations);

  // Find dominant strategies
  const dominantStrategies = detectDominantStrategies(winRates, strategies);

  // Find problematic strategies
  const problematicStrategies = detectProblematicStrategies(winRates, gameLengths);

  return {
    strategies: strategies.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      winRate: winRates[s.id].overall,
      avgGameLength: mean(gameLengths[s.id]),
      pickRate: 1 / strategies.length // Assumed equal for now
    })),
    winRates,
    correlation: correlations,
    dominantStrategies,
    problematicStrategies,
    summary: generateStrategySummary(winRates, dominantStrategies, problematicStrategies)
  };
}

/**
 * Simulate a single game between two strategies
 * @param {Object} gameEngine - Game engine
 * @param {Strategy} strategy1 - First player's strategy
 * @param {Strategy} strategy2 - Second player's strategy  
 * @param {number} playerCount - Total players
 * @returns {Object} Game result
 */
function simulateGame(gameEngine, strategy1, strategy2, playerCount) {
  // Create a fresh game state
  let state = (gameEngine && gameEngine.createState) ? gameEngine.createState() : createDefaultState();
  let turns = 0;
  const maxTurns = 100; // Safety limit

  while (!isGameOver(state) && turns < maxTurns) {
    // Determine current player's strategy
    const currentStrategy = turns % playerCount === 0 ? strategy1 : strategy2;
    
    // Execute one turn
    state = executeTurn(state, currentStrategy);
    turns++;
  }

  return {
    winner: determineWinner(state),
    turns,
    finalState: state
  };
}

/**
 * Create a default game state for simulation
 * @returns {Object} Default state
 */
function createDefaultState() {
  return {
    players: [
      { id: 'p1', resources: {}, points: 0 },
      { id: 'p2', resources: {}, points: 0 },
      { id: 'p3', resources: {}, points: 0 },
      { id: 'p4', resources: {}, points: 0 }
    ],
    board: { tiles: [] },
    currentPlayer: 0,
    phase: 'setup',
    turn: 0
  };
}

/**
 * Execute one turn with a strategy
 * @param {Object} state - Current game state
 * @param {Strategy} strategy - Strategy to execute
 * @returns {Object} New state
 */
function executeTurn(state, strategy) {
  // Deep clone state
  let newState = JSON.parse(JSON.stringify(state));
  
  // Execute strategy's play function if available
  if (strategy.playFunction) {
    newState = strategy.playFunction(newState);
  } else {
    // Default behavior: gain random resources and points
    const player = newState.players[newState.currentPlayer];
    const resources = ['wood', 'brick', 'sheep', 'wheat', 'ore'];
    const resource = resources[Math.floor(Math.random() * resources.length)];
    player.resources[resource] = (player.resources[resource] || 0) + 1;
    
    // Occasionally gain points
    if (Math.random() < 0.2) {
      player.points += 1;
    }
  }

  // Advance turn
  newState.currentPlayer = (newState.currentPlayer + 1) % newState.players.length;
  if (newState.currentPlayer === 0) {
    newState.turn++;
  }

  return newState;
}

/**
 * Check if game is over
 * @param {Object} state - Game state
 * @returns {boolean}
 */
function isGameOver(state) {
  // Check for victory condition (e.g., 10 points)
  for (const player of state.players) {
    if (player.points >= 10) {
      return true;
    }
  }
  return false;
}

/**
 * Determine winner from final state
 * @param {Object} state - Final game state
 * @returns {string} Winner player ID
 */
function determineWinner(state) {
  let maxPoints = -1;
  let winner = null;

  for (const player of state.players) {
    if (player.points > maxPoints) {
      maxPoints = player.points;
      winner = player.id;
    }
  }

  return winner;
}

/**
 * Get matchup key for win rate storage
 * @param {Strategy} strategy - This strategy
 * @param {Strategy} opponent - Opponent strategy
 * @returns {string} Key for matchup
 */
function getMatchupKey(strategy, opponent) {
  // Classify opponent strategy type
  const type = classifyStrategy(opponent);
  return `vs${capitalize(type)}`;
}

/**
 * Classify strategy type by name/description
 * @param {Strategy} strategy - Strategy to classify
 * @returns {string} Strategy type
 */
function classifyStrategy(strategy) {
  const name = (strategy.name + ' ' + strategy.description).toLowerCase();
  
  if (name.includes('aggressive') || name.includes('rush') || name.includes('attack')) {
    return 'Aggressive';
  } else if (name.includes('economic') || name.includes('builder') || name.includes('development')) {
    return 'Economic';
  } else {
    return 'Random';
  }
}

/**
 * Calculate correlations between strategies
 * @param {Strategy[]} strategies - All strategies
 * @param {Object} winRates - Win rates matrix
 * @param {Object} correlations - Correlation results
 */
function calculateCorrelations(strategies, winRates, correlations) {
  for (const s1 of strategies) {
    for (const s2 of strategies) {
      if (s1.id === s2.id) {
        correlations[s1.id][s2.id] = 1;
      } else {
        // Calculate correlation based on win rate differences
        const diff = Math.abs(winRates[s1.id].overall - winRates[s2.id].overall);
        correlations[s1.id][s2.id] = 1 - diff;
      }
    }
  }
}

/**
 * Detect dominant (overpowered) strategies
 * @param {Object} winRates - Win rates for all strategies
 * @param {Strategy[]} strategies - All strategies
 * @returns {Object[]} Dominant strategies
 */
function detectDominantStrategies(winRates, strategies) {
  const dominant = [];

  for (const strategy of strategies) {
    const wr = winRates[strategy.id].overall;
    
    // A strategy is dominant if it beats all others by > 10%
    const beatsAll = strategies.every(other => {
      if (other.id === strategy.id) return true;
      return winRates[strategy.id][getMatchupKey(strategy, other)] > 0.55;
    });

    if (beatsAll && wr > 0.6) {
      dominant.push({
        id: strategy.id,
        name: strategy.name,
        winRate: wr,
        severity: wr > 0.7 ? 'high' : 'medium'
      });
    }
  }

  return dominant;
}

/**
 * Detect problematic (underpowered) strategies
 * @param {Object} winRates - Win rates
 * @param {Object} gameLengths - Average game lengths
 * @returns {Object[]} Problematic strategies
 */
function detectProblematicStrategies(winRates, gameLengths) {
  const problematic = [];

  for (const [strategyId, data] of Object.entries(winRates)) {
    // Win rate below 30% is problematic
    if (data.overall < 0.3) {
      problematic.push({
        id: strategyId,
        winRate: data.overall,
        issue: 'too_weak',
        severity: data.overall < 0.2 ? 'high' : 'medium'
      });
    }
  }

  return problematic;
}

/**
 * Generate strategy balance summary
 * @param {Object} winRates - Win rates
 * @param {Object[]} dominant - Dominant strategies
 * @param {Object[]} problematic - Problematic strategies
 * @returns {Object} Summary
 */
function generateStrategySummary(winRates, dominant, problematic) {
  const allWinRates = Object.values(winRates).map(wr => wr.overall);
  const avgWinRate = mean(allWinRates);
  const winRateStdDev = standardDeviation(allWinRates);

  return {
    totalStrategies: Object.keys(winRates).length,
    averageWinRate: Math.round(avgWinRate * 100) / 100,
    winRateStandardDeviation: Math.round(winRateStdDev * 100) / 100,
    dominantStrategyCount: dominant.length,
    problematicStrategyCount: problematic.length,
    isBalanced: dominant.length === 0 && problematic.length === 0 && winRateStdDev < 0.1
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

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
  calculateStrategyBalance,
  simulateGame,
  detectDominantStrategies,
  detectProblematicStrategies,
  generateStrategySummary
};
