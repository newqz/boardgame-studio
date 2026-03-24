/**
 * Game Info Extractor
 * Extracts basic game information from rule text
 */

'use strict';

const { GameCategory } = require('../structures');

/**
 * @typedef {import('../structures').GameInfo} GameInfo
 * @typedef {import('../structures').ParserOptions} ParserOptions
 */

/**
 * Extract game information from rule text
 * @param {string} text - Rule document text
 * @param {ParserOptions} [options] - Parser options
 * @returns {{ gameInfo: GameInfo, remainingText: string }}
 */
function extractGameInfo(text, options = {}) {
  const result = {
    name: 'Unknown Game',
    playerCount: { min: 1, max: 99 },
    ageRange: 'Unknown',
    playTime: { min: 0, max: 999 },
    category: GameCategory.STRATEGY
  };

  let remaining = text;

  // Extract game name (usually in first heading)
  const nameMatch = text.match(/^#\s*(.+)$/m) || text.match(/^(.+?)\s*[-–]\s*Game\s*Rules?/im);
  if (nameMatch) {
    result.name = nameMatch[1].trim();
    remaining = remaining.replace(nameMatch[0], '');
  }

  // Extract player count
  // Patterns: "2-4 players", "3-6 people", "for 2 to 4 players"
  const playerPatterns = [
    /(\d+)\s*[-–]\s*(\d+)\s*(?:players?|people|persons?)/i,
    /for\s*(\d+)\s*[-–]\s*(\d+)/i,
    /(\d+)\s*to\s*(\d+)\s*(?:players?|people)/i,
    /(\d+)\s*(?:players?|people)\s*(?:minimum|at least|minimum)\s*(\d+)/i
  ];

  for (const pattern of playerPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.playerCount = {
        min: parseInt(match[1], 10),
        max: parseInt(match[2], 10)
      };
      break;
    }
  }

  // Extract age range
  // Patterns: "ages 8+", "age 10+", "8+ years", "for ages 10 and up"
  const agePatterns = [
    /(?:age|ages)\s*(\d+)\s*\+/i,
    /(\d+)\+\s*(?:years?|ages?)/i,
    /(?:for\s*)?ages?\s*(\d+)\s*(?:and\s*up|years?\s*and\s*older)/i,
    /(?:suitable\s*for\s*)?(\d+)\s*(?:years?|ages?)\s*(?:and\s*up|and\s*older)?/i
  ];

  for (const pattern of agePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.ageRange = `${match[1]}+`;
      break;
    }
  }

  // Extract play time
  // Patterns: "30-60 minutes", "about 60 min", "30 min", "1-2 hours"
  const timePatterns = [
    /(\d+)\s*[-–]\s*(\d+)\s*(?:minutes?|mins?)/i,
    /(?:about|approx\.?)?\s*(\d+)\s*(?:minutes?|mins?)/i,
    /(\d+)\s*[-–]\s*(\d+)\s*(?:hours?|hrs?)/i,
    /(\d+)\s*(?:hours?|hrs?)/i
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      const isHours = pattern.toString().includes('hour');
      if (isHours) {
        result.playTime = {
          min: parseInt(match[1], 10) * 60,
          max: match[2] ? parseInt(match[2], 10) * 60 : parseInt(match[1], 10) * 60
        };
      } else {
        result.playTime = {
          min: parseInt(match[1], 10),
          max: match[2] ? parseInt(match[2], 10) : parseInt(match[1], 10)
        };
      }
      break;
    }
  }

  // Extract game category
  const categoryKeywords = {
    [GameCategory.STRATEGY]: ['strategy', 'strategic', 'tactical'],
    [GameCategory.FAMILY]: ['family', 'gateway', 'beginner', 'introductory'],
    [GameCategory.PARTY]: ['party', 'social', 'fun', 'laugh'],
    [GameCategory.COOPERATIVE]: ['cooperative', 'co-op', 'team', 'collaborative'],
    [GameCategory.COMPETITIVE]: ['competitive', 'tournament', 'duel', 'vs'],
    [GameCategory.CARD]: ['card', 'cards', 'deck-building', 'hand management'],
    [GameCategory.DICE]: ['dice', 'dice-rolling', 'luck', 'random'],
    [GameCategory.TILE]: ['tile', 'tiles', 'laying', 'placement']
  };

  const lowerText = text.toLowerCase();
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    const score = keywords.filter(kw => lowerText.includes(kw)).length;
    if (score > 0) {
      result.category = category;
      break;
    }
  }

  return { gameInfo: result, remainingText: remaining };
}

module.exports = { extractGameInfo };
