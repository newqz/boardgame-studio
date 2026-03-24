/**
 * Game Rules Parser - Main Parser
 * Parses natural language game rules into structured data
 * 
 * @version 2.0.0
 */

'use strict';

const { extractGameInfo } = require('./extractors/game-info');
const { extractComponents } = require('./extractors/components');
const { extractPhases } = require('./extractors/phases');
const { extractActions } = require('./extractors/actions');
const { extractVictory } = require('./extractors/victory');
const { detectAmbiguities, detectEdgeCases } = require('./extractors/ambiguity');
const { GameCategory, calculateConfidence } = require('./structures');

/**
 * @typedef {import('./structures').ParsedRule} ParsedRule
 * @typedef {import('./structures').ParserOptions} ParserOptions
 * @typedef {import('./structures').Ambiguity} Ambiguity
 */

/**
 * Validate input text
 * @param {string} text - Input text
 * @returns {{ valid: boolean, error?: string }}
 */
function validateInput(text) {
  if (text === null || text === undefined) {
    return { valid: false, error: 'Input text cannot be null or undefined' };
  }
  if (typeof text !== 'string') {
    return { valid: false, error: `Input must be a string, got ${typeof text}` };
  }
  if (text.length > 1000000) {
    return { valid: false, error: 'Input text exceeds maximum length of 1,000,000 characters' };
  }
  return { valid: true };
}

/**
 * Parse game rules into structured format
 * 
 * @param {string} text - Raw rule document text
 * @param {ParserOptions} [options] - Parser options
 * @returns {ParsedRule} Structured game rules
 * 
 * @example
 * const parser = require('./parser');
 * const rules = parser.parseRules(`
 *   # Catan
 *   
 *   ## Components
 *   - 84 cards
 *   - 5 dice
 *   
 *   ## Game Flow
 *   1. Roll Dice
 *   2. Trade
 *   3. Build
 *   
 *   ## Victory
 *   First to 10 points wins.
 * `);
 */
function parseRules(text, options = {}) {
  const startTime = Date.now();
  const warnings = [];
  const unparsedSections = [];
  
  // Input validation
  const validation = validateInput(text);
  if (!validation.valid) {
    throw new Error(`Invalid input: ${validation.error}`);
  }

  // Preprocess text
  const cleanText = preprocessText(text);

  // Extract each component
  const { gameInfo, remainingText: afterInfo, confidence: gameInfoConfidence } = extractGameInfo(cleanText, options);
  
  const { components, remainingText: afterComponents } = extractComponents(afterInfo, options);
  
  const { phases, setup, remainingText: afterPhases } = extractPhases(afterComponents, options);
  
  const { actions, remainingText: afterActions } = extractActions(afterPhases, options);
  
  const { victoryConditions, edgeCases: victoryEdgeCases, remainingText: afterVictory } = extractVictory(afterActions, options);
  
  // Detect ambiguities
  const ambiguities = detectAmbiguities(cleanText, options);
  
  // Detect additional edge cases
  const additionalEdgeCases = detectEdgeCases(afterVictory);
  const allEdgeCases = [...victoryEdgeCases, ...additionalEdgeCases];

  // Check for unparsed sections
  if (afterVictory.length > 500) {
    unparsedSections.push('Remaining text may contain unprocessed rules');
  }

  // Calculate confidence scores
  const computeConfidence = options.computeConfidence !== false;
  let confidence = null;
  
  if (computeConfidence) {
    const blockingAmbiguities = ambiguities.filter(a => a.severity === 'blocking').length;
    const warningAmbiguities = ambiguities.filter(a => a.severity === 'warning').length;
    
    // Use dynamic confidence from extractors
    const gameInfoScore = gameInfoConfidence?.overall || calculateGameInfoConfidence(gameInfo);
    
    // Components confidence: based on count with quality weighting
    const componentsScore = Math.min(components.length / 5, 1) * 0.8;
    
    // Phases confidence: based on count
    const phasesScore = Math.min(phases.length / 4, 1) * 0.8;
    
    // Actions confidence: based on count
    const actionsScore = Math.min(actions.length / 3, 1) * 0.7;
    
    // Victory confidence: based on extraction success
    const victoryScore = victoryConditions.length > 0 ? 0.9 : 0.3;
    
    // Ambiguity detection confidence: based on ambiguity count
    const ambiguityScore = blockingAmbiguities > 0 ? 0.3 : 
                          warningAmbiguities > 0 ? 0.7 : 0.9;
    
    confidence = {
      overall: Math.round(((gameInfoScore + componentsScore + phasesScore + actionsScore + victoryScore + ambiguityScore) / 6) * 100) / 100,
      gameInfo: Math.round((gameInfoConfidence?.overall || gameInfoScore) * 100) / 100,
      components: Math.round(componentsScore * 100) / 100,
      phases: Math.round(phasesScore * 100) / 100,
      actions: Math.round(actionsScore * 100) / 100,
      victory: Math.round(victoryScore * 100) / 100,
      ambiguity: Math.round(ambiguityScore * 100) / 100,
      details: {
        name: gameInfoConfidence?.name || 0,
        playerCount: gameInfoConfidence?.playerCount || 0,
        ageRange: gameInfoConfidence?.ageRange || 0,
        playTime: gameInfoConfidence?.playTime || 0,
        category: gameInfoConfidence?.category || 0
      }
    };
  }

  // Generate warnings
  if (ambiguities.filter(a => a.severity === 'blocking').length > 0) {
    warnings.push('Blocking ambiguities detected - manual review required');
  }
  if (components.length === 0) {
    warnings.push('No components detected - manual review recommended');
  }
  if (phases.length === 0) {
    warnings.push('No phases detected - game flow may be unclear');
  }
  if (victoryConditions.length === 0) {
    warnings.push('No victory conditions detected - win condition unclear');
  }

  const parseTime = Date.now() - startTime;

  return {
    gameInfo,
    components,
    setup,
    phases,
    actions,
    victoryConditions,
    specialRules: [], // Could be extracted with more sophisticated parsing
    edgeCases: allEdgeCases,
    ambiguities,
    warnings,
    metadata: {
      rawTextLength: text.length,
      parseTime,
      unparsedSections,
      version: '2.0.0',
      confidence
    }
  };
}

/**
 * Calculate confidence score for game info extraction
 * @param {Object} gameInfo - Game info object
 * @returns {number} Confidence score 0-1
 */
function calculateGameInfoConfidence(gameInfo) {
  let score = 0;
  let count = 0;
  
  // Player count (high importance)
  if (gameInfo.playerCount?.min && gameInfo.playerCount?.max) {
    score += 0.9;
  } else if (gameInfo.playerCount?.min || gameInfo.playerCount?.max) {
    score += 0.5;
  }
  count++;
  
  // Age range
  if (gameInfo.ageRange && gameInfo.ageRange !== 'Unknown') {
    score += 0.7;
  }
  count++;
  
  // Play time
  if (gameInfo.playTime?.min > 0 && gameInfo.playTime?.max < 999) {
    score += 0.8;
  } else if (gameInfo.playTime?.min > 0) {
    score += 0.4;
  }
  count++;
  
  // Category
  if (gameInfo.category && gameInfo.category !== 'Unknown') {
    score += 0.6;
  }
  count++;
  
  // Game name
  if (gameInfo.name && gameInfo.name !== 'Unknown Game') {
    score += 0.8;
  }
  count++;
  
  return count > 0 ? score / count : 0;
}

/**
 * Preprocess rule text for parsing
 * @param {string} text - Raw text
 * @returns {string} Cleaned text
 */
function preprocessText(text) {
  return text
    // Remove excessive whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    // Normalize dashes
    .replace(/[–—]/g, '-')
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Remove common non-essential markers
    .replace(/^\s*>\s*/gm, '') // Blockquotes
    .replace(/```[\s\S]*?```/g, '') // Code blocks
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
}

/**
 * Validate parsed rules
 * @param {ParsedRule} rules - Parsed rules to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateRules(rules) {
  const errors = [];

  // Check required fields
  if (!rules.gameInfo) {
    errors.push('Missing gameInfo');
  }
  if (!rules.gameInfo?.name) {
    errors.push('Missing game name');
  }
  if (!rules.metadata) {
    errors.push('Missing metadata');
  }

  // Check for blocking ambiguities
  const blockingAmbiguities = rules.ambiguities?.filter(
    a => a.severity === 'blocking'
  ) || [];
  
  if (blockingAmbiguities.length > 0) {
    errors.push(`${blockingAmbiguities.length} blocking ambiguities need resolution`);
  }

  // Check completeness
  if (rules.components?.length === 0) {
    errors.push('No components extracted - rule structure may be unexpected');
  }
  if (rules.phases?.length === 0) {
    errors.push('No phases extracted - game flow unclear');
  }
  if (rules.victoryConditions?.length === 0) {
    errors.push('No victory conditions - win condition unclear');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate markdown report from parsed rules
 * @param {ParsedRule} rules - Parsed rules
 * @returns {string} Markdown report
 */
function toMarkdown(rules) {
  const lines = [];

  lines.push(`# ${rules.gameInfo.name}`);
  lines.push('');
  lines.push('## Game Information');
  lines.push(`- **Players**: ${rules.gameInfo.playerCount.min}-${rules.gameInfo.playerCount.max}`);
  lines.push(`- **Age**: ${rules.gameInfo.ageRange}`);
  lines.push(`- **Play Time**: ${rules.gameInfo.playTime.min}-${rules.gameInfo.playTime.max} minutes`);
  lines.push(`- **Category**: ${rules.gameInfo.category}`);
  lines.push('');

  if (rules.components.length > 0) {
    lines.push('## Components');
    for (const comp of rules.components) {
      const count = comp.count > 1 ? ` (${comp.count})` : '';
      lines.push(`- ${comp.name}${count}`);
    }
    lines.push('');
  }

  if (rules.setup.length > 0) {
    lines.push('## Setup');
    for (const step of rules.setup) {
      lines.push(`${step.order + 1}. ${step.description}`);
    }
    lines.push('');
  }

  if (rules.phases.length > 0) {
    lines.push('## Game Flow');
    for (const phase of rules.phases) {
      lines.push(`${phase.order + 1}. **${phase.name}**`);
      if (phase.description) {
        lines.push(`   ${phase.description}`);
      }
    }
    lines.push('');
  }

  if (rules.actions.length > 0) {
    lines.push('## Actions');
    for (const action of rules.actions) {
      lines.push(`- **${action.name}**${action.optional ? ' (optional)' : ''}`);
      if (action.description) {
        lines.push(`  ${action.description}`);
      }
      if (action.costs.length > 0) {
        lines.push(`  - Cost: ${action.costs.join(', ')}`);
      }
    }
    lines.push('');
  }

  if (rules.victoryConditions.length > 0) {
    lines.push('## Victory Conditions');
    for (const vc of rules.victoryConditions) {
      lines.push(`- **${vc.name}**: ${vc.description}`);
    }
    lines.push('');
  }

  if (rules.ambiguities.length > 0) {
    lines.push('## ⚠️ Ambiguities Detected');
    for (const amb of rules.ambiguities) {
      const icon = amb.severity === 'blocking' ? '🔴' : amb.severity === 'warning' ? '🟡' : 'ℹ️';
      lines.push(`${icon} **${amb.type}** (line ${amb.location.line})`);
      lines.push(`  - "${amb.originalText}"`);
      lines.push(`  - ${amb.message}`);
    }
    lines.push('');
  }

  if (rules.warnings.length > 0) {
    lines.push('## Warnings');
    for (const warning of rules.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Parsed in ${rules.metadata.parseTime}ms*`);

  return lines.join('\n');
}

/**
 * Export structures and enums
 */
module.exports = {
  parseRules,
  preprocessText,
  validateRules,
  validateInput,
  toMarkdown,
  GameCategory
};
