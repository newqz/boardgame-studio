/**
 * Ambiguity Detector
 * Detects ambiguous or unclear rules
 */

'use strict';

const { AmbiguitySeverity } = require('../structures');

/**
 * @typedef {import('../structures').Ambiguity} Ambiguity
 * @typedef {import('../structures').Interpretation} Interpretation
 * @typedef {import('../structures').EdgeCase} EdgeCase
 * @typedef {import('../structures').ParserOptions} ParserOptions
 */

/**
 * Detect ambiguities in rule text
 * @param {string} text - Rule document text
 * @param {ParserOptions} [options] - Parser options
 * @returns {Ambiguity[]}
 */
function detectAmbiguities(text, options = {}) {
  const ambiguities = [];
  const lines = text.split('\n');
  const seen = new Set();

  // Patterns that indicate ambiguity
  const ambiguityPatterns = [
    // Vague quantifiers
    {
      pattern: /\b(some|few|many|several|most|a\s+lot|some\s+number)\b/gi,
      type: 'vague_quantifier',
      severity: AmbiguitySeverity.WARNING,
      message: 'Vague quantifier may need specific numbers'
    },
    // Conditional without clear outcome
    {
      pattern: /\bif\s+.+?(?:then\s+)?(?:maybe|perhaps|might|possibly|could)\b/gi,
      type: 'uncertain_outcome',
      severity: AmbiguitySeverity.WARNING,
      message: 'Conditional with uncertain outcome'
    },
    // References to undefined terms
    {
      pattern: /\b(the\s+same|as\s+above|likewise|similarly|like\s+this)\b/gi,
      type: 'vague_reference',
      severity: AmbiguitySeverity.WARNING,
      message: 'Vague reference to unspecified content'
    },
    // Optional rules without clarification
    {
      pattern: /\b(optionally|optional|as\s+you\s+wish|if\s+you\s+want|you\s+may\s+choose)\b/gi,
      type: 'optional_unclear',
      severity: AmbiguitySeverity.INFO,
      message: 'Optional rule may need clarification'
    },
    // Conflicts or contradictions
    {
      pattern: /\b(but\s+however|on\s+the\s+other\s+hand|alternatively|or\s+maybe)\b/gi,
      type: 'potential_conflict',
      severity: AmbiguitySeverity.WARNING,
      message: 'Potential rule conflict or alternative interpretation'
    },
    // Timing ambiguities
    {
      pattern: /\b(before|after|during|at\s+the\s+same\s+time|immediately|whenever)\s+[^.!?]+\?/gi,
      type: 'timing_ambiguity',
      severity: AmbiguitySeverity.BLOCKING,
      message: 'Timing or sequencing unclear'
    },
    // "Unless" clauses
    {
      pattern: /\bunless\b[^.!?]+[.!?]/gi,
      type: 'unless_clause',
      severity: AmbiguitySeverity.WARNING,
      message: 'Unless clause may create edge cases'
    },
    // Ownership ambiguities
    {
      pattern: /\b(whoever|whichever|whose|to\s+whoever|belongs?\s+to)\b/gi,
      type: 'ownership_ambiguity',
      severity: AmbiguitySeverity.WARNING,
      message: 'Ownership or attribution unclear'
    },
    // Missing explicit ruling
    {
      pattern: /\b(this|that|it|they)\s+(?:should|may|might|must|can)\b/gi,
      type: 'pronoun_ambiguity',
      severity: AmbiguitySeverity.INFO,
      message: 'Pronoun reference may be unclear'
    }
  ];

  // Process each line
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const context = getContext(lines, lineNum);

    for (const { pattern, type, severity, message } of ambiguityPatterns) {
      const matches = line.matchAll(new RegExp(pattern.source, pattern.flags));
      
      for (const match of matches) {
        const originalText = match[0];
        const key = `${lineNum}-${type}-${originalText.slice(0, 20)}`;
        
        if (!seen.has(key)) {
          seen.add(key);
          
          const ambiguity = createAmbiguity(
            originalText,
            lineNum,
            context,
            type,
            severity,
            message
          );
          
          ambiguities.push(ambiguity);
        }
      }
    }
  }

  // Sort by severity (blocking first)
  ambiguities.sort((a, b) => {
    const severityOrder = {
      [AmbiguitySeverity.BLOCKING]: 0,
      [AmbiguitySeverity.WARNING]: 1,
      [AmbiguitySeverity.INFO]: 2
    };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return ambiguities;
}

/**
 * Create an ambiguity object
 * @param {string} originalText - The ambiguous text
 * @param {number} lineNum - Line number
 * @param {string} context - Surrounding context
 * @param {string} type - Type of ambiguity
 * @param {string} severity - Severity level
 * @param {string} message - Description message
 * @returns {Ambiguity}
 */
function createAmbiguity(originalText, lineNum, context, type, severity, message) {
  // Generate possible interpretations based on type
  const interpretations = generateInterpretations(originalText, type);
  
  return {
    originalText,
    location: {
      line: lineNum + 1, // 1-indexed for user friendliness
      context: context.slice(0, 200)
    },
    type,
    severity,
    message,
    interpretations
  };
}

/**
 * Generate possible interpretations for ambiguous text
 * @param {string} text - Ambiguous text
 * @param {string} type - Type of ambiguity
 * @returns {Interpretation[]}
 */
function generateInterpretations(text, type) {
  const interpretations = [];

  switch (type) {
    case 'vague_quantifier':
      interpretations.push(
        { reading: 'Literal interpretation', implications: [], edgeCases: [] },
        { 
          reading: 'Intentional design choice (balance mechanism)', 
          implications: ['May affect game balance'],
          edgeCases: []
        }
      );
      break;

    case 'uncertain_outcome':
      interpretations.push(
        { reading: 'Optional outcome', implications: ['May be skipped'], edgeCases: [] },
        { reading: 'Required outcome', implications: ['Must occur if condition met'], edgeCases: [] }
      );
      break;

    case 'vague_reference':
      interpretations.push(
        { reading: 'Reference to most recent item', implications: [], edgeCases: [] },
        { reading: 'Reference to a general category', implications: [], edgeCases: [] }
      );
      break;

    default:
      interpretations.push({
        reading: 'Primary interpretation',
        implications: [],
        edgeCases: []
      });
  }

  return interpretations;
}

/**
 * Get surrounding context for a line
 * @param {string[]} lines - All lines
 * @param {number} lineNum - Current line number
 * @param {number} [radius=2] - Lines before and after to include
 * @returns {string}
 */
function getContext(lines, lineNum, radius = 2) {
  const start = Math.max(0, lineNum - radius);
  const end = Math.min(lines.length, lineNum + radius + 1);
  
  return lines
    .slice(start, end)
    .map((line, idx) => {
      const marker = idx + start === lineNum ? '>' : ' ';
      return marker + line;
    })
    .join('\n');
}

/**
 * Detect edge cases from rule text
 * @param {string} text - Rule document text
 * @returns {EdgeCase[]}
 */
function detectEdgeCases(text) {
  const edgeCases = [];
  const seen = new Set();

  // Patterns that describe edge cases
  const edgeCasePatterns = [
    {
      pattern: /(?:if|when|unless)\s+[^.!?]+\band\s+[^.!?]+\band\s+[^.!?]+/gi,
      scenario: 'Complex multi-condition scenario'
    },
    {
      pattern: /\bwhat\s+happens?\s+(?:if|when)\s+[^.!?]+\?/gi,
      scenario: 'Explicit question about edge case'
    },
    {
      pattern: /(?:in\s+case\s+of|when\s+in\s+case)\s+[^.!?]+:?\s*([^.]+)/gi,
      scenario: 'Edge case handling'
    },
    {
      pattern: /\b(except|excluding|not\s+including)\s+[^.!?]+/gi,
      scenario: 'Exception scenario'
    },
    {
      pattern: /\b(more\s+than|less\s+than|exactly|at\s+least|at\s+most|no\s+more)\s+\d+/gi,
      scenario: 'Boundary condition'
    }
  ];

  for (const { pattern, scenario } of edgeCasePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const key = match[0].slice(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        edgeCases.push({
          scenario: match[0].slice(0, 200),
          resolution: undefined,
          relatedRules: []
        });
      }
    }
  }

  return edgeCases;
}

module.exports = { detectAmbiguities, detectEdgeCases };
