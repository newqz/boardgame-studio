/**
 * Actions Extractor
 * Extracts action types from rule text
 */

'use strict';

/**
 * @typedef {import('../structures').ActionType} ActionType
 * @typedef {import('../structures').ParserOptions} ParserOptions
 */

/**
 * Extract action types from rule text
 * @param {string} text - Rule document text
 * @param {ParserOptions} [options] - Parser options
 * @returns {{ actions: ActionType[], remainingText: string }}
 */
function extractActions(text, options = {}) {
  const actions = [];
  const seen = new Set();

  // Find actions section
  const actionHeaders = [
    /##\s*Actions?/i,
    /##\s*(?:Types?\s+of\s+)?Actions?/i,
    /##\s*Available\s+Actions?/i,
    /##\s*Player\s+Actions?/i,
    /##\s*What\s+You\s+Can\s+Do/i
  ];

  let actionsSection = '';
  for (const header of actionHeaders) {
    const match = text.match(header);
    if (match) {
      const startIndex = text.indexOf(match[0]);
      const nextSection = text.indexOf('\n## ', startIndex);
      actionsSection = nextSection > 0
        ? text.slice(startIndex, nextSection)
        : text.slice(startIndex);
      break;
    }
  }

  if (!actionsSection) {
    actionsSection = text;
  }

  // Pattern: Action names followed by descriptions
  // "Build a road: Cost 1 wood, 1 brick. Effect: Place a road."
  const actionPatterns = [
    // "**Action: Description**" or "**Action Name**"
    /\*\*([A-Za-z\s]+?)\*\*:?\s*(.+?)(?=\n\n|\*\*|$)/gi,
    // "Action Name - Description"
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[-–:]\s*(.+)$/gm,
    // "Action Name (Cost) - Effect"
    /^([A-Za-z\s]+?)\s*(?:\(([^)]+)\))?\s*[-–:]\s*(.+)$/gm
  ];

  for (const pattern of actionPatterns) {
    const matches = actionsSection.matchAll(pattern);
    for (const match of matches) {
      const name = (match[1] || '').trim();
      const rest = (match[2] || match[3] || '').trim();
      
      if (name && !isCommonWord(name) && name.length < 50) {
        const action = parseActionText(name, rest);
        const key = action.name.toLowerCase();
        
        if (!seen.has(key)) {
          seen.add(key);
          actions.push(action);
        }
      }
    }
  }

  // Also detect implicit actions (verbs that imply actions)
  const implicitActions = detectImplicitActions(text);
  for (const action of implicitActions) {
    const key = action.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      actions.push(action);
    }
  }

  return { actions, remainingText: text };
}

/**
 * Parse action text into structured action
 * @param {string} name - Action name
 * @param {string} text - Raw action description
 * @returns {ActionType}
 */
function parseActionText(name, text) {
  const action = {
    name: normalizeActionName(name),
    description: undefined,
    prerequisites: [],
    costs: [],
    effects: [],
    optional: false
  };

  // Extract cost (patterns like "Cost: X", "Costs X", "requires X")
  const costPatterns = [
    /(?:cost|costs|requires?|need|need[s]?)\s*:?\s*([^.]+)/gi,
    /([0-9]+\s+[a-z]+)\s+(?:wood|brick|stone|sheep|wheat|ore|card|coin|point)/gi
  ];

  for (const pattern of costPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const cost = match[1] || match[0];
      if (cost && !action.costs.includes(cost.trim())) {
        action.costs.push(cost.trim());
      }
    }
  }

  // Extract effects (patterns like "Effect:", "You may:", "This allows:")
  const effectPatterns = [
    /(?:effect|effects|allows?|lets?|gives?|grants?|you can)\s*:?\s*([^.]+)/gi,
    /(?:place|get|gain|receive|earn|draw|collect)\s+([^.]+)/gi
  ];

  for (const pattern of effectPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const effect = match[1] || match[0];
      if (effect && !action.effects.includes(effect.trim())) {
        action.effects.push(effect.trim());
      }
    }
  }

  // Check if optional
  if (text.match(/may|optional|can choose|optional|if you want|you may/i)) {
    action.optional = true;
  }

  // Set description if nothing else matched
  if (!action.costs.length && !action.effects.length && text) {
    action.description = text.slice(0, 200);
  }

  return action;
}

/**
 * Detect implicit actions from game text
 * @param {string} text - Rule document text
 * @returns {ActionType[]}
 */
function detectImplicitActions(text) {
  const actions = [];
  const lowerText = text.toLowerCase();

  const actionVerbs = [
    { verb: 'build', name: 'Build', effect: 'Construct or place something' },
    { verb: 'buy', name: 'Buy', effect: 'Purchase using resources' },
    { verb: 'trade', name: 'Trade', effect: 'Exchange resources with others' },
    { verb: 'roll', name: 'Roll Dice', effect: 'Roll dice for random outcomes' },
    { verb: 'draw', name: 'Draw', effect: 'Draw cards from deck' },
    { verb: 'play', name: 'Play Card', effect: 'Play a card from hand' },
    { verb: 'move', name: 'Move', effect: 'Move a piece' },
    { verb: 'attack', name: 'Attack', effect: 'Initiate combat' },
    { verb: 'defend', name: 'Defend', effect: 'Defend against attack' },
    { verb: 'score', name: 'Score', effect: 'Earn points' },
    { verb: 'discard', name: 'Discard', effect: 'Remove card from hand' },
    { verb: 'exchange', name: 'Exchange', effect: 'Swap items' },
    { verb: 'use', name: 'Use', effect: 'Use a card or token' },
    { verb: 'end turn', name: 'End Turn', effect: 'End your turn', optional: true }
  ];

  for (const { verb, name, effect, optional } of actionVerbs) {
    if (lowerText.includes(verb)) {
      actions.push({
        name,
        description: effect,
        prerequisites: [],
        costs: [],
        effects: [effect],
        optional: optional || false
      });
    }
  }

  return actions;
}

/**
 * Normalize action name
 * @param {string} name - Raw action name
 * @returns {string}
 */
function normalizeActionName(name) {
  return name
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Check if text is a common word
 * @param {string} text - Text to check
 * @returns {boolean}
 */
function isCommonWord(text) {
  const commonWords = [
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were',
    'this', 'that', 'these', 'those', 'it', 'its', 'you', 'your',
    'may', 'can', 'must', 'should', 'will', 'would', 'could'
  ];
  return commonWords.includes(text.toLowerCase());
}

module.exports = { extractActions, parseActionText, detectImplicitActions };
