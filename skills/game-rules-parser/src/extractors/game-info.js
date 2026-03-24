/**
 * Game Info Extractor
 * Extracts basic game information from rule text
 * 
 * @version 2.0.0 - Added dynamic confidence scoring
 */

'use strict';

const { GameCategory } = require('../structures');

/**
 * @typedef {import('../structures').GameInfo} GameInfo
 * @typedef {import('../structures').ParserOptions} ParserOptions
 */

/**
 * Pattern definitions with names and confidence weights
 * @type {Object}
 */
const PLAYER_PATTERNS = [
  { name: 'range-dash', pattern: /(\d+)\s*[-–]\s*(\d+)\s*(?:players?|people|persons?)/i, extract: m => ({ min: +m[1], max: +m[2] }), confidence: 0.95 },
  { name: 'range-to', pattern: /for\s*(\d+)\s*[-–]\s*(\d+)/i, extract: m => ({ min: +m[1], max: +m[2] }), confidence: 0.9 },
  { name: 'range-to-players', pattern: /(\d+)\s*to\s*(\d+)\s*(?:players?|people)/i, extract: m => ({ min: +m[1], max: +m[2] }), confidence: 0.9 },
  { name: 'exact-number', pattern: /(\d+)\s*(?:players?|people)/i, extract: m => ({ min: +m[1], max: +m[1] }), confidence: 0.5 },
];

const AGE_PATTERNS = [
  { name: 'ages-plus', pattern: /(?:age|ages)\s*(\d+)\s*\+/i, extract: m => `${m[1]}+`, confidence: 0.95 },
  { name: 'number-plus-years', pattern: /(\d+)\+\s*(?:years?|ages?)/i, extract: m => `${m[1]}+`, confidence: 0.95 },
  { name: 'for-ages', pattern: /(?:for\s*)?ages?\s*(\d+)\s*(?:and\s*up|years?\s*and\s*older)/i, extract: m => `${m[1]}+`, confidence: 0.85 },
  { name: 'suitable-for', pattern: /(?:suitable\s*for\s*)?(\d+)\s*(?:years?|ages?)\s*(?:and\s*up|and\s*older)?/i, extract: m => `${m[1]}+`, confidence: 0.8 },
];

const TIME_PATTERNS = [
  { name: 'range-minutes', pattern: /(\d+)\s*[-–]\s*(\d+)\s*(?:minutes?|mins?)/i, extract: m => ({ min: +m[1], max: +m[2] }), confidence: 0.95, isHours: false },
  { name: 'single-minutes', pattern: /(?:about|approx\.?|approximately)?\s*(\d+)\s*(?:minutes?|mins?)/i, extract: m => ({ min: +m[1], max: +m[1] }), confidence: 0.8, isHours: false },
  { name: 'range-hours', pattern: /(\d+)\s*[-–]\s*(\d+)\s*(?:hours?|hrs?)/i, extract: m => ({ min: +m[1] * 60, max: +m[2] * 60 }), confidence: 0.95, isHours: true },
  { name: 'single-hours', pattern: /(\d+)\s*(?:hours?|hrs?)/i, extract: m => ({ min: +m[1] * 60, max: +m[1] * 60 }), confidence: 0.75, isHours: true },
];

const CATEGORY_KEYWORDS = {
  [GameCategory.STRATEGY]: { keywords: ['strategy', 'strategic', 'tactical'], weight: 1.0 },
  [GameCategory.FAMILY]: { keywords: ['family', 'gateway', 'beginner', 'introductory'], weight: 1.0 },
  [GameCategory.PARTY]: { keywords: ['party', 'social', 'fun', 'laugh'], weight: 1.0 },
  [GameCategory.COOPERATIVE]: { keywords: ['cooperative', 'co-op', 'co op', 'team', 'collaborative'], weight: 1.0 },
  [GameCategory.COMPETITIVE]: { keywords: ['competitive', 'tournament', 'duel', 'vs', 'versus'], weight: 1.0 },
  [GameCategory.CARD]: { keywords: ['card', 'cards', 'deck-building', 'deck building', 'hand management'], weight: 1.0 },
  [GameCategory.DICE]: { keywords: ['dice', 'dice-rolling', 'luck', 'random'], weight: 1.0 },
  [GameCategory.TILE]: { keywords: ['tile', 'tiles', 'laying', 'placement'], weight: 1.0 },
};

/**
 * Extract game information from rule text with confidence scores
 * @param {string} text - Rule document text
 * @param {ParserOptions} [options] - Parser options
 * @returns {{ gameInfo: GameInfo, remainingText: string, confidence: number }}
 */
function extractGameInfo(text, options = {}) {
  const result = {
    name: 'Unknown Game',
    playerCount: { min: 1, max: 99 },
    ageRange: 'Unknown',
    playTime: { min: 0, max: 999 },
    category: GameCategory.STRATEGY
  };

  const confidence = {
    name: 0,
    playerCount: 0,
    ageRange: 0,
    playTime: 0,
    category: 0,
    overall: 0
  };

  let remaining = text;

  // Extract game name (usually in first heading)
  const nameMatch = text.match(/^#\s*(.+)$/m) || text.match(/^(.+?)\s*[-–]\s*Game\s*Rules?/im);
  if (nameMatch) {
    result.name = nameMatch[1].trim();
    confidence.name = nameMatch[0].startsWith('#') ? 0.95 : 0.8;
    remaining = remaining.replace(nameMatch[0], '');
  }

  // Extract player count with pattern matching
  let playerConfidence = 0;
  for (const { pattern, extract, confidence: conf } of PLAYER_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      result.playerCount = extract(match);
      playerConfidence = conf;
      break;
    }
  }
  confidence.playerCount = playerConfidence;

  // Extract age range with pattern matching
  let ageConfidence = 0;
  for (const { pattern, extract, confidence: conf } of AGE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      result.ageRange = extract(match);
      ageConfidence = conf;
      break;
    }
  }
  confidence.ageRange = ageConfidence;

  // Extract play time with pattern matching
  let timeConfidence = 0;
  for (const { pattern, extract, confidence: conf } of TIME_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      result.playTime = extract(match);
      timeConfidence = conf;
      break;
    }
  }
  confidence.playTime = timeConfidence;

  // Extract game category with keyword scoring
  const lowerText = text.toLowerCase();
  let bestCategory = GameCategory.STRATEGY;
  let bestScore = 0;
  
  for (const [category, { keywords, weight }] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(kw => lowerText.includes(kw)).length * weight;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }
  
  result.category = bestCategory;
  confidence.category = bestScore > 0 ? Math.min(bestScore / 2, 1.0) : 0.3;

  // Calculate overall confidence
  const weights = { name: 0.15, playerCount: 0.25, ageRange: 0.2, playTime: 0.2, category: 0.2 };
  confidence.overall = Object.entries(weights).reduce((sum, [key, weight]) => {
    return sum + (confidence[key] || 0) * weight;
  }, 0);

  return { gameInfo: result, remainingText: remaining, confidence };
}

module.exports = { extractGameInfo };
