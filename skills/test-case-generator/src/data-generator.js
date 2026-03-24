/**
 * Test Data Generator
 * Generates random but valid test data for board games
 * 
 * @version 1.0.0
 */

'use strict';

/**
 * @typedef {Object} GameState
 * @property {number} turn - Current turn
 * @property {string} phase - Game phase
 * @property {Object} players - Player states
 * @property {Object} board - Board state
 */

/**
 * @typedef {Object} PlayerState
 * @property {string} id - Player ID
 * @property {Object} resources - Player resources
 * @property {number} score - Player score
 */

class TestDataGenerator {
  /**
   * Create a new Test Data Generator
   * @param {Object} [config={}] - Configuration
   */
  constructor(config = {}) {
    this.config = {
      minPlayers: config.minPlayers || 2,
      maxPlayers: config.maxPlayers || 6,
      resourceTypes: config.resourceTypes || ['wood', 'brick', 'sheep', 'wheat', 'ore'],
      maxResources: config.maxResources || 19,
      ...config
    };
  }

  /**
   * Generate a random game state
   * @param {string} complexity - 'simple' | 'medium' | 'full'
   * @returns {GameState}
   */
  generateRandomGameState(complexity = 'medium') {
    const playerCount = this._randomInt(this.config.minPlayers, this.config.maxPlayers);

    return {
      turn: this._randomInt(1, 50),
      phase: this._randomChoice(['setup', 'main', 'end']),
      players: this._generatePlayers(playerCount, complexity),
      board: this._generateBoard(complexity),
      deck: this._generateDeck(complexity),
      discard: this._generateDiscard(complexity)
    };
  }

  /**
   * Generate player states
   * @param {number} count - Number of players
   * @param {string} complexity - Complexity level
   * @returns {Object}
   * @private
   */
  _generatePlayers(count, complexity) {
    const players = {};

    for (let i = 0; i < count; i++) {
      const playerId = `player${i + 1}`;
      players[playerId] = {
        id: playerId,
        resources: this._generateResources(complexity),
        score: this._randomInt(0, 10),
        buildings: this._generateBuildings(complexity),
        cards: this._generateCards(complexity)
      };
    }

    return players;
  }

  /**
   * Generate resources
   * @param {string} complexity - Complexity level
   * @returns {Object}
   * @private
   */
  _generateResources(complexity) {
    const resources = {};

    for (const type of this.config.resourceTypes) {
      const max = complexity === 'simple' ? 5 : complexity === 'medium' ? 10 : this.config.maxResources;
      resources[type] = this._randomInt(0, max);
    }

    return resources;
  }

  /**
   * Generate buildings
   * @param {string} complexity - Complexity level
   * @returns {Object[]}
   * @private
   */
  _generateBuildings(complexity) {
    const count = complexity === 'simple' ? 2 : complexity === 'medium' ? 5 : 10;
    const buildings = [];

    for (let i = 0; i < count; i++) {
      buildings.push({
        type: this._randomChoice(['settlement', 'city', 'road']),
        position: this._randomInt(0, 53),
        owner: `player${this._randomInt(1, this.config.maxPlayers)}`
      });
    }

    return buildings;
  }

  /**
   * Generate cards
   * @param {string} complexity - Complexity level
   * @returns {Object[]}
   * @private
   */
  _generateCards(complexity) {
    const count = complexity === 'simple' ? 0 : complexity === 'medium' ? 2 : 5;
    const cards = [];

    const cardTypes = ['knight', 'victory', 'road', 'plenty', 'monopoly'];

    for (let i = 0; i < count; i++) {
      cards.push({
        type: this._randomChoice(cardTypes),
        played: Math.random() > 0.5
      });
    }

    return cards;
  }

  /**
   * Generate board state
   * @param {string} complexity - Complexity level
   * @returns {Object}
   * @private
   */
  _generateBoard(complexity) {
    const tiles = [];
    const tileTypes = ['wood', 'brick', 'sheep', 'wheat', 'ore', 'desert'];

    const tileCount = complexity === 'simple' ? 19 : 37;

    for (let i = 0; i < tileCount; i++) {
      tiles.push({
        type: this._randomChoice(tileTypes),
        number: this._randomInt(2, 12),
        robber: false
      });
    }

    // Place robber on desert
    const desertIndex = tiles.findIndex(t => t.type === 'desert');
    if (desertIndex !== -1) {
      tiles[desertIndex].robber = true;
    }

    return { tiles };
  }

  /**
   * Generate deck
   * @param {string} complexity - Complexity level
   * @returns {Object[]}
   * @private
   */
  _generateDeck(complexity) {
    const count = complexity === 'simple' ? 10 : complexity === 'medium' ? 25 : 50;
    const deck = [];

    const cardTypes = ['knight', 'victory', 'road', 'plenty', 'monopoly'];
    const counts = { knight: 14, victory: 5, road: 2, plenty: 2, monopoly: 2 };

    for (const [type, maxCount] of Object.entries(counts)) {
      const actualCount = Math.min(maxCount, Math.floor(count / cardTypes.length));
      for (let i = 0; i < actualCount; i++) {
        deck.push({ type });
      }
    }

    return this._shuffle(deck);
  }

  /**
   * Generate discard pile
   * @param {string} complexity - Complexity level
   * @returns {Object[]}
   * @private
   */
  _generateDiscard(complexity) {
    const count = complexity === 'simple' ? 0 : this._randomInt(0, 10);
    const discard = [];

    for (let i = 0; i < count; i++) {
      discard.push({
        type: this._randomChoice(['knight', 'victory', 'road'])
      });
    }

    return discard;
  }

  /**
   * Generate boundary test cases
   * @returns {Object[]}
   */
  generateBoundaryCases() {
    return [
      {
        name: 'empty_game',
        description: 'Game with no players',
        state: {
          turn: 0,
          phase: 'setup',
          players: {},
          board: { tiles: [] }
        }
      },
      {
        name: 'max_players',
        description: 'Game with maximum players',
        state: this.generateRandomGameState('full')
      },
      {
        name: 'no_resources',
        description: 'Players with no resources',
        state: {
          ...this.generateRandomGameState('simple'),
          players: Object.fromEntries(
            Object.entries(this.generateRandomGameState('simple').players).map(([id, p]) => [
              id,
              { ...p, resources: Object.fromEntries(this.config.resourceTypes.map(t => [t, 0])) }
            ])
          )
        }
      },
      {
        name: 'max_resources',
        description: 'Players with maximum resources',
        state: {
          ...this.generateRandomGameState('full'),
          players: Object.fromEntries(
            Object.entries(this.generateRandomGameState('full').players).map(([id, p]) => [
              id,
              { ...p, resources: Object.fromEntries(this.config.resourceTypes.map(t => [t, this.config.maxResources])) }
            ])
          )
        }
      },
      {
        name: 'final_turn',
        description: 'Game at maximum turns',
        state: {
          ...this.generateRandomGameState('medium'),
          turn: 1000
        }
      }
    ];
  }

  /**
   * Generate player combinations
   * @param {number} count - Number of combinations
   * @returns {Object[]}
   */
  generatePlayerCombinations(count = 10) {
    const combinations = [];

    for (let i = 0; i < count; i++) {
      const playerCount = this._randomInt(this.config.minPlayers, this.config.maxPlayers);
      const players = [];

      for (let j = 0; j < playerCount; j++) {
        players.push({
          id: `player${j + 1}`,
          name: `Player ${j + 1}`,
          ai: Math.random() > 0.7,
          difficulty: this._randomChoice(['easy', 'medium', 'hard'])
        });
      }

      combinations.push({
        id: `combo_${i + 1}`,
        playerCount,
        players
      });
    }

    return combinations;
  }

  /**
   * Generate dice roll distribution
   * @param {number} rolls - Number of rolls
   * @returns {Object}
   */
  generateDiceDistribution(rolls = 1000) {
    const distribution = {};

    for (let i = 2; i <= 12; i++) {
      distribution[i] = 0;
    }

    for (let i = 0; i < rolls; i++) {
      const roll = this._roll2D6();
      distribution[roll]++;
    }

    return distribution;
  }

  /**
   * Roll 2d6
   * @returns {number}
   * @private
   */
  _roll2D6() {
    return this._randomInt(1, 6) + this._randomInt(1, 6);
  }

  /**
   * Get random integer in range
   * @param {number} min - Minimum (inclusive)
   * @param {number} max - Maximum (inclusive)
   * @returns {number}
   * @private
   */
  _randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Get random choice from array
   * @param {Array} arr - Array to choose from
   * @returns {*}
   * @private
   */
  _randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Shuffle array
   * @param {Array} arr - Array to shuffle
   * @returns {Array}
   * @private
   */
  _shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

module.exports = { TestDataGenerator };
