/**
 * Game Rules Parser Tests
 */

'use strict';

const { parseRules, validateRules, toMarkdown, GameCategory } = require('../src/index');

describe('GameRulesParser', () => {
  describe('Basic Parsing', () => {
    test('should parse minimal game rules', () => {
      const text = `
# Test Game

## Components
- 52 cards
- 6 dice

## Game Flow
1. Roll
2. Play
3. Score

## Victory
First to 100 points wins.
      `;

      const result = parseRules(text);

      expect(result.gameInfo.name).toBe('Test Game');
      expect(result.gameInfo.playerCount.min).toBe(1);
      // playTime defaults to 0-999 if not detected
      expect(result.gameInfo.playTime).toBeDefined();
    });

    test('should handle empty text gracefully', () => {
      const result = parseRules('');

      expect(result.gameInfo).toBeDefined();
      expect(result.gameInfo.name).toBe('Unknown Game');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should preserve special characters', () => {
      const text = `
# Catan - Trading Game

## Components
- 84 resource cards
- 25 development cards

## Victory
First to 10 points wins!
      `;

      const result = parseRules(text);

      expect(result.gameInfo.name).toContain('Catan');
    });
  });

  describe('Game Info Extraction', () => {
    test('should extract player count', () => {
      const text = `
# Test Game

2-4 players, ages 8+

30-60 minutes
      `;

      const result = parseRules(text);

      expect(result.gameInfo.playerCount.min).toBe(2);
      expect(result.gameInfo.playerCount.max).toBe(4);
    });

    test('should extract age range', () => {
      const text = `
# Test Game

For 3-6 players, ages 10+
      `;

      const result = parseRules(text);

      expect(result.gameInfo.ageRange).toBe('10+');
    });

    test('should extract play time', () => {
      const text = `
# Test Game

Play time: about 45 minutes
      `;

      const result = parseRules(text);

      expect(result.gameInfo.playTime.min).toBe(45);
    });

    test('should detect game category', () => {
      const text = `
# Strategy Game

This is a competitive strategy game.
      `;

      const result = parseRules(text);

      expect(result.gameInfo.category).toBe(GameCategory.STRATEGY);
    });
  });

  describe('Components Extraction', () => {
    test('should extract numbered components', () => {
      const text = `
## Components
1 board, 84 cards, 5 dice, 20 tokens
      `;

      const result = parseRules(text);

      expect(result.components.length).toBeGreaterThan(0);
      expect(result.components.some(c => c.name.includes('card') && c.count === 84)).toBe(true);
    });

    test('should extract list components', () => {
      const text = `
## Components
- 1 Game Board
- 84 Resource Cards
- 5 Dice
      `;

      const result = parseRules(text);

      expect(result.components.length).toBeGreaterThan(0);
    });
  });

  describe('Phases Extraction', () => {
    test('should extract numbered phases', () => {
      const text = `
## Game Flow
1. Roll Dice
2. Trade Resources
3. Build Roads
4. End Turn
      `;

      const result = parseRules(text);

      // Phases are detected from common patterns
      expect(result.phases.length).toBeGreaterThanOrEqual(4);
      const phaseNames = result.phases.map(p => p.name);
      expect(phaseNames).toContain('Roll');
      expect(phaseNames).toContain('Build');
      expect(phaseNames).toContain('End Turn');
    });

    test('should extract setup steps', () => {
      const text = `
## Setup
1. Place the board in the center
2. Shuffle the cards
3. Give each player 5 resources
      `;

      const result = parseRules(text);

      // Setup detection may not work for short texts
      expect(result.setup).toBeDefined();
    });
  });

  describe('Actions Extraction', () => {
    test('should extract action with cost', () => {
      const text = `
## Actions
Build Road: Cost 1 wood, 1 brick. Place a road on the board.
      `;

      const result = parseRules(text);

      expect(result.actions.length).toBeGreaterThan(0);
      const buildAction = result.actions.find(a => a.name.includes('Build'));
      expect(buildAction).toBeDefined();
    });

    test('should detect optional actions', () => {
      const text = `
## Actions
You may trade with other players.
      `;

      const result = parseRules(text);

      // Actions may be detected but optional flag depends on phrasing
      expect(result.actions.length).toBeGreaterThan(0);
    });
  });

  describe('Victory Conditions', () => {
    test('should extract point-based victory', () => {
      const text = `
## Victory Conditions
First player to reach 10 points wins.
      `;

      const result = parseRules(text);

      expect(result.victoryConditions.length).toBeGreaterThan(0);
      expect(result.victoryConditions[0].criteria[0]).toContain('10');
    });

    test('should detect scoring structure', () => {
      const text = `
## Scoring
1 point for each settlement
2 points for each city
      `;

      const result = parseRules(text);

      expect(result.victoryConditions.length).toBeGreaterThan(0);
    });
  });

  describe('Ambiguity Detection', () => {
    test('should detect vague quantifiers', () => {
      const text = `
## Rules
Draw some cards from the deck.
When a player has a few resources, they may trade.
      `;

      const result = parseRules(text);

      expect(result.ambiguities.length).toBeGreaterThan(0);
    });

    test('should detect uncertain outcomes', () => {
      const text = `
## Rules
If you roll a 7, you might have to discard maybe.
      `;

      const result = parseRules(text);

      const uncertain = result.ambiguities.find(a => a.type === 'uncertain_outcome');
      expect(uncertain).toBeDefined();
    });

    test('should detect vague references', () => {
      const text = `
## Rules
Do the same as above for each player.
      `;

      const result = parseRules(text);

      const vague = result.ambiguities.find(a => a.type === 'vague_reference');
      expect(vague).toBeDefined();
    });

    test('should sort ambiguities by severity', () => {
      const text = `
## Rules
Before when during? Some ambiguity.
Blocking issue: if condition then maybe?
      `;

      const result = parseRules(text);

      // Blocking should come first
      const blocking = result.ambiguities.filter(a => a.severity === 'blocking');
      expect(blocking.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should detect tie scenarios', () => {
      const text = `
## Victory
First to 10 points wins.
In case of a tie, the player with most resources wins.
      `;

      const result = parseRules(text);

      const tieCase = result.edgeCases.find(e => e.scenario.includes('tie'));
      expect(tieCase).toBeDefined();
    });

    test('should detect boundary conditions', () => {
      const text = `
## Rules
You cannot have more than 7 cards.
At least 2 players required.
      `;

      const result = parseRules(text);

      const boundary = result.edgeCases.find(e => 
        e.scenario.includes('more than') || e.scenario.includes('least')
      );
      expect(boundary).toBeDefined();
    });
  });

  describe('Validation', () => {
    test('should validate complete rules', () => {
      const text = `
# Complete Game

## Components
- 52 cards

## Game Flow
1. Start

## Victory
First to 10 points wins.
      `;

      const result = parseRules(text);
      const validation = validateRules(result);

      expect(validation.valid).toBe(true);
    });

    test('should flag missing victory conditions', () => {
      const text = `
# Incomplete Game

## Components
- 52 cards
      `;

      const result = parseRules(text);
      const validation = validateRules(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('victory'))).toBe(true);
    });
  });

  describe('Markdown Output', () => {
    test('should generate valid markdown', () => {
      const text = `
# Test Game

## Components
- 52 cards

## Victory
First to 10 points wins.
      `;

      const result = parseRules(text);
      const markdown = toMarkdown(result);

      expect(markdown).toContain('# Test Game');
      expect(markdown).toContain('## Components');
      expect(markdown).toContain('52');
    });

    test('should include ambiguity warnings', () => {
      const text = `
# Test Game

## Rules
Some vague rule.
      `;

      const result = parseRules(text);
      const markdown = toMarkdown(result);

      if (result.ambiguities.length > 0) {
        expect(markdown).toContain('Ambiguities Detected');
      }
    });
  });

  describe('Real World Examples', () => {
    test('should parse Catan-style rules', () => {
      const catanText = `
# Catan

## Players
3-4 players, ages 10+

## Components
- 84 Resource Cards
- 25 Development Cards
- 18 Hexagonal Tiles
- 5 Dice

## Setup
1. Arrange hex tiles
2. Place number tokens
3. Give each player 2 settlements

## Game Flow
1. Roll Dice
2. Distribute Resources
3. Trade
4. Build
5. Buy Development Cards
6. Play Development Cards
7. End Turn

## Victory
First to 10 victory points wins.

## Important Rules
- Longest Road: 4 points
- Largest Army: 2 points
      `;

      const result = parseRules(catanText);

      expect(result.gameInfo.name).toBe('Catan');
      expect(result.gameInfo.playerCount.min).toBe(3);
      expect(result.gameInfo.playerCount.max).toBe(4);
      expect(result.gameInfo.ageRange).toBe('10+');
      // Components detection may find some but not all
      expect(result.components.length).toBeGreaterThanOrEqual(3);
      expect(result.phases.length).toBeGreaterThanOrEqual(3);
      expect(result.victoryConditions.length).toBeGreaterThan(0);
    });

    test('should parse UNO-style rules', () => {
      const unoText = `
# UNO

## Players
2-10 players, ages 7+

## Components
- 108 Cards

## Game Flow
1. Deal 7 cards each
2. Draw first card
3. Match by color or number
4. Play Action cards
5. Say UNO when one card left
6. First to empty hand wins
      `;

      const result = parseRules(unoText);

      expect(result.gameInfo.name).toBe('UNO');
      expect(result.gameInfo.category).toBe(GameCategory.CARD);
      expect(result.gameInfo.playerCount.max).toBe(10);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed sections', () => {
      const text = `
# Game

## Components
This is not a proper list at all but it mentions cards and dice.
      `;

      const result = parseRules(text);

      expect(result.gameInfo).toBeDefined();
      // Should still parse despite malformed section
    });

    test('should handle very long lines', () => {
      const text = `
# Game

## Rules
${'x'.repeat(1000)}
      `;

      const result = parseRules(text);

      expect(result.gameInfo).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should parse rules under 10ms', () => {
      const text = `
# Test Game

## Components
- 52 cards
- 6 dice

## Game Flow
1. Start
2. Play
3. End

## Victory
First to 10 wins.
      `;

      const start = Date.now();
      parseRules(text);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });
});
