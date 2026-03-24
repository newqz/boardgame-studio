/**
 * AI Difficulty Tuner - Main Export
 * 
 * @version 1.0.0
 */

'use strict';

const difficultyPresets = require('./difficulty-presets');
const { PlayerEloTracker } = require('./elo-tracker');
const { AdaptiveDifficultyTuner } = require('./adaptive-tuner');
const { PlayerStyleAnalyzer } = require('./player-style');

module.exports = {
  // Difficulty presets
  ...difficultyPresets,

  // Elo tracking
  PlayerEloTracker,

  // Main tuner class
  AdaptiveDifficultyTuner,

  // Style analysis
  PlayerStyleAnalyzer,

  // Version info
  VERSION: '1.0.0'
};
