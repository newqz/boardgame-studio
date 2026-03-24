/**
 * Test Case Generator - Main Export
 * 
 * @version 1.0.0
 */

'use strict';

const { TestCaseGenerator, DEFAULT_CONFIG } = require('./generator');
const { TestDataGenerator } = require('./data-generator');

module.exports = {
  TestCaseGenerator,
  TestDataGenerator,
  DEFAULT_CONFIG,
  VERSION: '1.0.0'
};
