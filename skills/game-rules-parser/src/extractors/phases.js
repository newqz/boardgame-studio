/**
 * Phases Extractor
 * Extracts game phases and flow from rule text
 */

'use strict';

/**
 * @typedef {import('../structures').GamePhase} GamePhase
 * @typedef {import('../structures').SetupStep} SetupStep
 * @typedef {import('../structures').ParserOptions} ParserOptions
 */

/**
 * Extract game phases and setup from rule text
 * @param {string} text - Rule document text
 * @param {ParserOptions} [options] - Parser options
 * @returns {{ phases: GamePhase[], setup: SetupStep[], remainingText: string }}
 */
function extractPhases(text, options = {}) {
  const phases = [];
  const setup = [];
  let order = 0;

  // Extract setup section
  const setupResult = extractSetup(text);
  setup.push(...setupResult.steps);

  // Extract game phases
  const sectionHeaders = [
    /##\s*Game\s+Flow/i,
    /##\s*Turn\s+Structure/i,
    /##\s*How\s+to\s+Play/i,
    /##\s*Playing\s+the\s+Game/i,
    /##\s*Phases?/i,
    /##\s*Sequence\s+of\s+Play/i
  ];

  let phasesSection = '';
  for (const header of sectionHeaders) {
    const match = text.match(header);
    if (match) {
      const startIndex = text.indexOf(match[0]);
      const nextSection = text.indexOf('\n## ', startIndex);
      phasesSection = nextSection > 0
        ? text.slice(startIndex, nextSection)
        : text.slice(startIndex);
      break;
    }
  }

  if (phasesSection) {
    // Pattern: "1. Phase Name" or "Phase 1: Name" or "- Phase Name"
    const phasePatterns = [
      /^\d+\.\s*([A-Za-z\s]+?)(?:\s*[-–:]\s*(.+))?$/gm,
      /^Phase\s*(\d+):?\s*([A-Za-z\s]+?)(?:\s*[-–:]\s*(.+))?$/gim,
      /^[-*•]\s*([A-Za-z\s]+?)(?:\s*[-–:]\s*(.+))?$/gm
    ];

    for (const pattern of phasePatterns) {
      const matches = phasesSection.matchAll(pattern);
      for (const match of matches) {
        const phaseName = (match[2] || match[1] || '').trim();
        const description = (match[3] || '').trim();
        
        if (phaseName && !isCommonWord(phaseName)) {
          phases.push({
            name: normalizePhaseName(phaseName),
            order: order++,
            description: description || undefined
          });
        }
      }
    }
  }

  // If no phases found, try to infer from common game flow patterns
  if (phases.length === 0) {
    const commonPhases = detectCommonPhases(text);
    phases.push(...commonPhases.map((name, idx) => ({
      name,
      order: idx,
      description: undefined
    })));
  }

  return { phases, setup, remainingText: text };
}

/**
 * Extract setup steps from rule text
 * @param {string} text - Rule document text
 * @returns {{ steps: SetupStep[], remainingText: string }}
 */
function extractSetup(text) {
  const steps = [];
  let order = 0;

  const setupHeaders = [
    /##\s*Setup/i,
    /##\s*Getting\s+Started/i,
    /##\s*Preparing\s+the\s+Game/i,
    /##\s*Before\s+You\s+Begin/i
  ];

  let setupSection = '';
  for (const header of setupHeaders) {
    const match = text.match(header);
    if (match) {
      const startIndex = text.indexOf(match[0]);
      const nextSection = text.indexOf('\n## ', startIndex);
      setupSection = nextSection > 0
        ? text.slice(startIndex, nextSection)
        : text.slice(startIndex);
      break;
    }
  }

  if (setupSection) {
    // Pattern: numbered steps or list items
    const stepPatterns = [
      /^\d+\.\s*(.+)$/gm,
      /^[-*•]\s*(.+)$/gm
    ];

    for (const pattern of stepPatterns) {
      const matches = setupSection.matchAll(pattern);
      for (const match of matches) {
        const stepText = match[1].trim();
        if (stepText.length > 3 && stepText.length < 200) {
          steps.push({
            order: order++,
            description: stepText,
            phase: 'setup'
          });
        }
      }
    }
  }

  return { steps, remainingText: text };
}

/**
 * Detect common game phases from text patterns
 * @param {string} text - Rule document text
 * @returns {string[]} Detected phase names
 */
function detectCommonPhases(text) {
  const phases = [];
  const lowerText = text.toLowerCase();

  const phaseIndicators = [
    { name: 'Setup', keywords: ['setup', 'prepare', 'initial', 'starting', 'begin'] },
    { name: 'Draw', keywords: ['draw', 'card', 'hand'] },
    { name: 'Roll', keywords: ['roll', 'dice', 'random'] },
    { name: 'Move', keywords: ['move', 'placement', 'position', 'go to'] },
    { name: 'Action', keywords: ['action', 'play', 'spend', 'use'] },
    { name: 'Buy', keywords: ['buy', 'purchase', 'acquire', 'trade'] },
    { name: 'Build', keywords: ['build', 'construct', 'create'] },
    { name: 'Attack', keywords: ['attack', 'combat', 'fight', 'battle'] },
    { name: 'Score', keywords: ['score', 'point', 'victory', 'win'] },
    { name: 'End Turn', keywords: ['end turn', 'finish', 'complete turn'] },
    { name: 'Cleanup', keywords: ['cleanup', 'discard', 'reset'] }
  ];

  for (const { name, keywords } of phaseIndicators) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      phases.push(name);
    }
  }

  // Remove duplicates while preserving order
  return [...new Set(phases)];
}

/**
 * Check if text is a common word (not a phase name)
 * @param {string} text - Text to check
 * @returns {boolean}
 */
function isCommonWord(text) {
  const commonWords = [
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were',
    'this', 'that', 'these', 'those', 'it', 'its'
  ];
  return commonWords.includes(text.toLowerCase());
}

/**
 * Normalize phase name
 * @param {string} name - Raw phase name
 * @returns {string} Normalized name
 */
function normalizePhaseName(name) {
  return name
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

module.exports = { extractPhases, extractSetup, detectCommonPhases };
