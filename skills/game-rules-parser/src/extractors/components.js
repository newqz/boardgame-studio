/**
 * Components Extractor
 * Extracts game components from rule text
 */

'use strict';

const { ComponentCategory } = require('../structures');

/**
 * @typedef {import('../structures').Component} Component
 * @typedef {import('../structures').ParserOptions} ParserOptions
 */

/**
 * Extract game components from rule text
 * @param {string} text - Rule document text
 * @param {ParserOptions} [options] - Parser options
 * @returns {{ components: Component[], remainingText: string }}
 */
function extractComponents(text, options = {}) {
  const components = [];
  let remaining = text;

  // Common component patterns
  const componentPatterns = [
    // Named items with quantities: "1 game board", "84 cards", "5 dice"
    {
      pattern: /(\d+)\s+(game\s+)?(boards?|cards?|tiles?|dice|tokens?|pieces?|figures?|tokens?|markers?|tokens?)/gi,
      parse: (match) => ({
        count: parseInt(match[1], 10),
        name: (match[2] || '').trim() + ' ' + match[3].trim(),
        category: categorizeComponent(match[3])
      })
    },
    // List format: "- 1 Road card" or "* 5 Wood tokens"
    {
      pattern: /^[\-\*]\s*(\d+)\s+(.+?)(?:\s*[-–]\s*(.+))?$/gm,
      parse: (match) => ({
        count: parseInt(match[1], 10),
        name: match[2].trim(),
        description: match[3] ? match[3].trim() : undefined,
        category: categorizeComponent(match[2])
      })
    },
    // Colon format: "Board: 1", "Cards: 84"
    {
      pattern: /^([A-Za-z\s]+):\s*(\d+)\s*$/gm,
      parse: (match) => ({
        name: match[1].trim(),
        count: parseInt(match[2], 10),
        category: categorizeComponent(match[1])
      })
    }
  ];

  // Find components section
  const sectionHeaders = [
    /##\s*Components?/i,
    /##\s*Game\s+(?:Contents|Materials|Parts|Items)/i,
    /##\s*Box\s+Contents?/i,
    /##\s*What['\s]+s\s+in\s+the\s+box/i
  ];

  let componentsSection = '';
  for (const header of sectionHeaders) {
    const match = text.match(header);
    if (match) {
      const startIndex = text.indexOf(match[0]);
      // Find next ## heading or end of text
      const nextSection = text.indexOf('\n## ', startIndex);
      componentsSection = nextSection > 0
        ? text.slice(startIndex, nextSection)
        : text.slice(startIndex);
      break;
    }
  }

  // If no dedicated section, look for component-like patterns in entire text
  if (!componentsSection) {
    componentsSection = text;
  }

  // Extract components using patterns
  const seen = new Set();
  for (const { pattern, parse } of componentPatterns) {
    const matches = componentsSection.matchAll(pattern);
    for (const match of matches) {
      const parsed = parse(match);
      const key = `${parsed.name}-${parsed.count}`;
      if (!seen.has(key)) {
        seen.add(key);
        components.push(cleanComponent(parsed));
      }
    }
  }

  // Try to find list of items (common in rules)
  const listPattern = /(?:include|contains?|consists? of|consists?)\s*:?\s*\n((?:\s*[-*•]\s*.+\n)+)/gi;
  const listMatch = text.match(listPattern);
  if (listMatch) {
    const items = listMatch[1]
      .split('\n')
      .map(line => line.replace(/^[\s*\-•]+/, '').trim())
      .filter(line => line && !line.match(/^\d+$/));
    
    for (const item of items) {
      const countMatch = item.match(/^(\d+)\s+(.+)/);
      if (countMatch) {
        const key = `${countMatch[2]}-${countMatch[1]}`;
        if (!seen.has(key)) {
          seen.add(key);
          components.push({
            count: parseInt(countMatch[1], 10),
            name: countMatch[2].trim(),
            category: categorizeComponent(countMatch[2])
          });
        }
      } else if (item.length > 2 && item.length < 50) {
        const key = `${item}-1`;
        if (!seen.has(key)) {
          seen.add(key);
          components.push({
            name: item,
            count: 1,
            category: categorizeComponent(item)
          });
        }
      }
    }
  }

  return { components, remainingText: text };
}

/**
 * Categorize a component based on its name
 * @param {string} name - Component name
 * @returns {string} Component category
 */
function categorizeComponent(name) {
  const lower = name.toLowerCase();
  
  if (lower.includes('board') || lower.includes('game board')) {
    return ComponentCategory.BOARD;
  }
  if (lower.includes('card')) {
    return ComponentCategory.CARD;
  }
  if (lower.includes('tile')) {
    return ComponentCategory.TILE;
  }
  if (lower.includes('dice') || lower.includes('die')) {
    return ComponentCategory.DICE;
  }
  if (lower.includes('token') || lower.includes('marker') || lower.includes('cube')) {
    return ComponentCategory.TOKEN;
  }
  if (lower.includes('figure') || lower.includes('miniature') || lower.includes('meeple') || lower.includes('pawn')) {
    return ComponentCategory.FIGURE;
  }
  if (lower.includes('coin') || lower.includes('money') || lower.includes('gold') || lower.includes('resource')) {
    return ComponentCategory.CURRENCY;
  }
  
  return ComponentCategory.OTHER;
}

/**
 * Clean and normalize component data
 * @param {Object} component - Raw component data
 * @returns {Component} Cleaned component
 */
function cleanComponent(component) {
  return {
    name: component.name.replace(/\s+/g, ' ').trim(),
    count: component.count || 1,
    description: component.description,
    category: component.category || ComponentCategory.OTHER
  };
}

module.exports = { extractComponents, categorizeComponent };
