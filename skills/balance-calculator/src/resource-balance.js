/**
 * Resource Balance Calculator
 * Calculates resource production rates, relative values, and scarcity
 * 
 * @version 1.0.0
 */

'use strict';

const { Scarcity } = require('./structures');

/**
 * Calculate resource balance from game state samples
 * @param {Object} gameConfig - Game configuration with resources and production rules
 * @param {string[]} [gameConfig.resources=[]] - List of resource names
 * @param {Object} [gameConfig.productionRules={}] - Production rules for each resource
 * @param {number} [gameConfig.turns=20] - Number of turns to simulate
 * @param {number} [gameConfig.simulations=1000] - Number of simulations
 * @returns {Object} Resource balance analysis
 */
function calculateResourceBalance(gameConfig = {}) {
  const {
    resources = ['wood', 'brick', 'sheep', 'wheat', 'ore'],
    productionRules = {},
    turns = 20,
    simulations = 1000
  } = gameConfig;

  // Calculate production rates for each resource
  const productionRates = calculateProductionRates(resources, productionRules, turns, simulations);
  
  // Calculate relative values using market-based approach
  const relativeValues = calculateRelativeValues(productionRates);
  
  // Determine scarcity based on production rates
  const scarcity = calculateScarcity(productionRates);

  // Find imbalances
  const imbalances = detectResourceImbalances(productionRates, relativeValues, scarcity);

  return {
    productionRate: productionRates,
    relativeValue: relativeValues,
    scarcity,
    imbalances,
    summary: generateResourceSummary(productionRates, relativeValues, scarcity)
  };
}

/**
 * Calculate production rates for each resource
 * @param {string[]} resources - Resource names
 * @param {Object} productionRules - Production rules
 * @param {number} turns - Turns to simulate
 * @param {number} simulations - Number of simulations
 * @returns {Object.<string, {averagePerTurn: number, variance: number, distribution: string}>}
 */
function calculateProductionRates(resources, productionRules, turns, simulations) {
  const results = {};

  for (const resource of resources) {
    const rule = productionRules[resource] || { baseRate: 1, variance: 0.5 };
    const samples = [];

    for (let sim = 0; sim < simulations; sim++) {
      let totalProduction = 0;
      for (let turn = 0; turn < turns; turn++) {
        const production = simulateProduction(rule, turn);
        totalProduction += production;
      }
      samples.push(totalProduction / turns);
    }

    results[resource] = {
      averagePerTurn: mean(samples),
      variance: variance(samples),
      distribution: detectDistribution(samples)
    };
  }

  return results;
}

/**
 * Simulate production for a single turn
 * @param {Object} rule - Production rule
 * @param {number} turn - Current turn
 * @returns {number} Production amount
 */
function simulateProduction(rule, turn) {
  const { baseRate = 1, variance = 0, modifier = null } = rule;
  
  let rate = baseRate;
  
  // Apply modifiers (e.g., technology upgrades)
  if (modifier && typeof modifier === 'function') {
    rate *= modifier(turn);
  }
  
  // Add randomness based on variance
  if (variance > 0) {
    rate *= (1 + (Math.random() - 0.5) * variance * 2);
  }
  
  return Math.max(0, rate);
}

/**
 * Calculate relative values for resources
 * Based on supply/demand equilibrium
 * @param {Object} productionRates - Production rates for each resource
 * @returns {Object.<string, number>} Relative values (normalized)
 */
function calculateRelativeValues(productionRates) {
  const resources = Object.keys(productionRates);
  
  // Base values from Catan (classic equilibrium)
  const baseValues = {
    wood: 1.0,
    brick: 1.0,
    sheep: 1.0,
    wheat: 1.0,
    ore: 1.5
  };

  // Adjust based on production rates
  const totalProduction = resources.reduce((sum, r) => {
    return sum + productionRates[r].averagePerTurn;
  }, 0);

  const relativeValues = {};
  for (const resource of resources) {
    const baseValue = baseValues[resource] || 1.0;
    const productionRatio = productionRates[resource].averagePerTurn / (totalProduction / resources.length);
    
    // Lower production = higher value
    const adjustedValue = baseValue / Math.sqrt(productionRatio + 0.5);
    
    relativeValues[resource] = Math.round(adjustedValue * 100) / 100;
  }

  return relativeValues;
}

/**
 * Calculate scarcity based on production rates
 * @param {Object} productionRates - Production rates
 * @returns {Object.<string, string>} Scarcity classification
 */
function calculateScarcity(productionRates) {
  const resources = Object.keys(productionRates);
  const rates = resources.map(r => productionRates[r].averagePerTurn);
  const avgRate = mean(rates);

  const scarcity = {};
  for (const resource of resources) {
    const rate = productionRates[resource].averagePerTurn;
    const ratio = rate / avgRate;

    if (ratio < 0.7) {
      scarcity[resource] = Scarcity.RARE;
    } else if (ratio < 1.3) {
      scarcity[resource] = Scarcity.COMMON;
    } else {
      scarcity[resource] = Scarcity.UNCOMMON;
    }
  }

  return scarcity;
}

/**
 * Detect resource imbalances
 * @param {Object} productionRates - Production rates
 * @param {Object} relativeValues - Relative values
 * @param {Object} scarcity - Scarcity levels
 * @returns {Object[]} List of detected imbalances
 */
function detectResourceImbalances(productionRates, relativeValues, scarcity) {
  const imbalances = [];
  const resources = Object.keys(productionRates);
  const values = Object.values(relativeValues);

  // Check for extreme value differences
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const valueRange = maxValue / minValue;

  if (valueRange > 3) {
    imbalances.push({
      type: 'extreme_value_difference',
      severity: 'high',
      message: `Resource value range too extreme: ${valueRange.toFixed(2)}x`,
      details: { maxValue, minValue, ratio: valueRange }
    });
  }

  // Check for overpowered/underpowered resources
  const avgValue = mean(values);
  for (const resource of resources) {
    const value = relativeValues[resource];
    if (value > avgValue * 2) {
      imbalances.push({
        type: 'overpowered_resource',
        severity: 'medium',
        message: `${resource} has unusually high value: ${value}`,
        resource
      });
    } else if (value < avgValue * 0.5) {
      imbalances.push({
        type: 'underpowered_resource',
        severity: 'medium',
        message: `${resource} has unusually low value: ${value}`,
        resource
      });
    }
  }

  // Check production variance
  for (const resource of resources) {
    const { variance, averagePerTurn } = productionRates[resource];
    const cv = Math.sqrt(variance) / averagePerTurn; // Coefficient of variation
    if (cv > 1) {
      imbalances.push({
        type: 'high_production_variance',
        severity: 'low',
        message: `${resource} has high production variance: ${cv.toFixed(2)}`,
        resource
      });
    }
  }

  return imbalances;
}

/**
 * Detect distribution type from samples
 * @param {number[]} samples - Sample data
 * @returns {string} Distribution type
 */
function detectDistribution(samples) {
  if (samples.length < 10) return 'uniform';
  
  const n = samples.length;
  const sorted = [...samples].sort((a, b) => a - b);
  
  // Calculate skewness
  const avg = mean(samples);
  const std = Math.sqrt(variance(samples));
  const skewness = n > 0 ? 
    samples.reduce((sum, x) => sum + Math.pow((x - avg) / std, 3), 0) / n : 0;
  
  if (Math.abs(skewness) < 0.5) {
    return 'normal';
  } else {
    return 'skewed';
  }
}

/**
 * Generate summary of resource balance
 * @param {Object} productionRates - Production rates
 * @param {Object} relativeValues - Relative values
 * @param {Object} scarcity - Scarcity levels
 * @returns {Object} Summary object
 */
function generateResourceSummary(productionRates, relativeValues, scarcity) {
  const resources = Object.keys(productionRates);
  const totalProduction = resources.reduce((sum, r) => sum + productionRates[r].averagePerTurn, 0);
  const avgValue = mean(Object.values(relativeValues));

  return {
    totalProductionPerTurn: Math.round(totalProduction * 100) / 100,
    resourceCount: resources.length,
    avgResourceValue: Math.round(avgValue * 100) / 100,
    rareResources: resources.filter(r => scarcity[r] === Scarcity.RARE),
    commonResources: resources.filter(r => scarcity[r] === Scarcity.COMMON),
    balanced: Object.keys(scarcity).every(r => scarcity[r] === Scarcity.COMMON)
  };
}

// Statistical helpers
function mean(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function variance(arr) {
  if (arr.length < 2) return 0;
  const avg = mean(arr);
  return arr.reduce((sum, x) => sum + Math.pow(x - avg, 2), 0) / (arr.length - 1);
}

module.exports = {
  calculateResourceBalance,
  calculateProductionRates,
  calculateRelativeValues,
  calculateScarcity,
  detectResourceImbalances,
  generateResourceSummary
};
