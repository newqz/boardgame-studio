/**
 * Balance Calculator - Main Export
 * 
 * @version 1.0.0
 */

'use strict';

const { BalanceAnalyzer, quickBalanceCheck } = require('./analyzer');
const resourceBalance = require('./resource-balance');
const strategyBalance = require('./strategy-balance');
const timeBalance = require('./time-balance');
const structures = require('./structures');

module.exports = {
  // Main analyzer class
  BalanceAnalyzer,
  
  // Quick check function
  quickBalanceCheck,
  
  // Resource balance functions
  calculateResourceBalance: resourceBalance.calculateResourceBalance,
  
  // Strategy balance functions
  calculateStrategyBalance: strategyBalance.calculateStrategyBalance,
  
  // Time balance functions
  calculateTimeBalance: timeBalance.calculateTimeBalance,
  
  // Re-export sub-modules for advanced usage
  resourceBalance,
  strategyBalance,
  timeBalance,
  
  // Enums and constants
  ...structures,
  
  // Version info
  VERSION: '1.0.0'
};
