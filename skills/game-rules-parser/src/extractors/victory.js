/**
 * Victory Conditions Extractor
 * Extracts winning conditions from rule text
 */

'use strict';

/**
 * @typedef {import('../structures').VictoryCondition} VictoryCondition
 * @typedef {import('../structures').EdgeCase} EdgeCase
 * @typedef {import('../structures').ParserOptions} ParserOptions
 */

/**
 * Extract victory conditions from rule text
 * @param {string} text - Rule document text
 * @param {ParserOptions} [options] - Parser options
 * @returns {{ victoryConditions: VictoryCondition[], edgeCases: EdgeCase[], remainingText: string }}
 */
function extractVictory(text, options = {}) {
  const victoryConditions = [];
  const edgeCases = [];

  // Find victory section
  const victoryHeaders = [
    /##\s*Victory\s+Conditions?/i,
    /##\s*Winning/i,
    /##\s*How\s+to\s+Win/i,
    /##\s*End\s+of\s+the\s+Game/i,
    /##\s*Scoring/i,
    /##\s*Points?/i
  ];

  let victorySection = '';
  for (const header of victoryHeaders) {
    const match = text.match(header);
    if (match) {
      const startIndex = text.indexOf(match[0]);
      const nextSection = text.indexOf('\n## ', startIndex);
      victorySection = nextSection > 0
        ? text.slice(startIndex, nextSection)
        : text.slice(startIndex);
      break;
    }
  }

  if (!victorySection) {
    victorySection = text;
  }

  // Extract victory conditions using patterns with global flag
  const victoryPatterns = [
    // "The first player to X wins"
    /first\s+(?:player\s+)?(?:to\s+)?(.+?)\s+wins?/gi,
    // "X points to win" or "first to reach X points"
    /(?:first\s+)?(?:to\s+)?reach?\s+(\d+)\s+points?\s+(?:to\s+win|winner)/gi,
    // "X is the winner" or "X wins the game"
    /(\d+)\s+points?\s+(?:is\s+)?(?:the\s+)?winner/gi,
    // Numbered conditions: "1. X wins by..."
    /^\d+\.\s*(.+?)(?:\s+wins?|is\s+the\s+winner)/gim,
    // Bullet points with win keywords
    /^[-*•]\s*(.+?)(?:\s+wins?|wins?\s+the\s+game)/gim
  ];

  // Extract using victory-specific patterns
  for (const pattern of victoryPatterns) {
    const matches = [...victorySection.matchAll(pattern)];
    for (const match of matches) {
      const conditionText = match[1] || match[0];
      const condition = parseVictoryCondition(conditionText);
      if (condition && !victoryConditions.some(v => v.name === condition.name)) {
        victoryConditions.push(condition);
      }
    }
  }

  // Also look for point structures
  const pointPatterns = [
    // "X points for Y"
    /(\d+)\s+points?\s+(?:for|when|if)\s+([^.]+)/gi,
    // "Each X is worth Y points"
    /each\s+([^.]+)\s+(?:is\s+)?worth\s+(\d+)\s+points?/gi
  ];

  for (const pattern of pointPatterns) {
    const matches = victorySection.matchAll(pattern);
    for (const match of matches) {
      const condition = {
        name: `Points for ${match[1] || match[2]}`.trim(),
        description: `${match[1] || match[2]} earns ${match[2] || match[1]} points`,
        criteria: [`${match[2] || match[1]} points`],
        isPrimary: false
      };
      if (!victoryConditions.some(v => v.name === condition.name)) {
        victoryConditions.push(condition);
      }
    }
  }

  // Extract edge cases related to victory
  const tiePatterns = [
    /(?:in\s+case\s+of\s+a\s+)?tie(?:\s+breaker)?:?\s*([^.]+)/gi,
    /if\s+there['\s]+s?\s+a\s+tie:?\s*([^.]+)/gi
  ];

  for (const pattern of tiePatterns) {
    const matches = victorySection.matchAll(pattern);
    for (const match of matches) {
      edgeCases.push({
        scenario: 'Tie in victory points',
        resolution: match[1].trim(),
        relatedRules: ['Victory Conditions']
      });
    }
  }

  // Detect game end conditions
  const gameEndPatterns = [
    /the\s+game\s+ends?\s+when:?\s*([^.]+)/gi,
    /game\s+ends?\s+after\s+([^.]+)/gi
  ];

  for (const pattern of gameEndPatterns) {
    const matches = victorySection.matchAll(pattern);
    for (const match of matches) {
      edgeCases.push({
        scenario: 'Game end trigger',
        resolution: match[1].trim(),
        relatedRules: ['Game Flow']
      });
    }
  }

  return { victoryConditions, edgeCases, remainingText: text };
}

/**
 * Parse victory condition text into structured condition
 * @param {string} text - Raw victory condition text
 * @returns {VictoryCondition}
 */
function parseVictoryCondition(text) {
  if (!text || text.length < 3) return null;

  // Extract point threshold
  const pointMatch = text.match(/(\d+)\s+points?/);
  const points = pointMatch ? parseInt(pointMatch[1], 10) : 0;

  // Determine if primary condition
  const isPrimary = text.match(/first|main|primary|main\s+goal/i) !== null;

  // Generate name
  let name = 'Victory';
  if (points > 0) {
    name = `${points} Points Victory`;
  } else if (text.match(/first\s+to/i)) {
    name = 'First to Achieve Victory';
  } else if (text.match(/most\s+points/i)) {
    name = 'Most Points Victory';
  } else if (text.match(/longest\s+road|longest/i)) {
    name = 'Longest Route Victory';
  } else if (text.match(/largest\s+army|most\s+soldiers/i)) {
    name = 'Largest Army Victory';
  }

  return {
    name,
    description: text.slice(0, 200).trim(),
    criteria: points > 0 ? [`${points} points required`] : undefined,
    isPrimary
  };
}

module.exports = { extractVictory, parseVictoryCondition };
