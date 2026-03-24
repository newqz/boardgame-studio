/**
 * Balance Analyzer
 * Combines all balance dimensions and generates reports
 * 
 * @version 1.0.0
 */

'use strict';

const { BalanceStatus } = require('./structures');
const { calculateResourceBalance } = require('./resource-balance');
const { calculateStrategyBalance } = require('./strategy-balance');
const { calculateTimeBalance } = require('./time-balance');

/**
 * Main balance analyzer class
 */
class BalanceAnalyzer {
  /**
   * Create a new BalanceAnalyzer
   * @param {Object} gameConfig - Game configuration
   * @param {Object} [options] - Analysis options
   */
  constructor(gameConfig, options = {}) {
    this.gameConfig = gameConfig;
    this.options = {
      simulations: 1000,
      ...options
    };
    this.results = null;
  }

  /**
   * Run full balance analysis
   * @returns {Object} Complete balance report
   */
  analyze() {
    const startTime = Date.now();

    // Run all balance calculations
    const resourceBalance = calculateResourceBalance(this.gameConfig);
    const strategyBalance = calculateStrategyBalance(
      this.gameConfig.gameEngine,
      this.gameConfig.strategies || [],
      { simulations: this.options.simulations }
    );
    const timeBalance = calculateTimeBalance(
      this.gameConfig,
      { simulations: this.options.simulations }
    );

    // Calculate overall score
    const overallScore = this.calculateOverallScore(
      resourceBalance,
      strategyBalance,
      timeBalance
    );

    // Determine balance status
    const status = this.determineStatus(overallScore, resourceBalance, strategyBalance, timeBalance);

    // Generate risks and suggestions
    const risks = this.identifyRisks(resourceBalance, strategyBalance, timeBalance);
    const suggestions = this.generateSuggestions(resourceBalance, strategyBalance, timeBalance);

    this.results = {
      overallScore,
      status,
      resourceBalance,
      strategyBalance,
      timeBalance,
      risks,
      suggestions,
      metadata: {
        analyzedAt: new Date().toISOString(),
        simulations: this.options.simulations,
        analysisTimeMs: Date.now() - startTime,
        version: '1.0.0'
      }
    };

    return this.results;
  }

  /**
   * Calculate overall balance score (0-100)
   */
  calculateOverallScore(resource, strategy, time) {
    let score = 100;

    // Deduct for resource imbalances (max -20 points)
    const resourceDeductions = this.calculateResourceDeductions(resource);
    score -= resourceDeductions;

    // Deduct for strategy imbalances (max -30 points)
    const strategyDeductions = this.calculateStrategyDeductions(strategy);
    score -= strategyDeductions;

    // Deduct for time imbalances (max -20 points)
    const timeDeductions = this.calculateTimeDeductions(time);
    score -= timeDeductions;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate score deductions from resource balance
   */
  calculateResourceDeductions(resource) {
    let deduction = 0;

    // Deduct for imbalances
    if (resource.imbalances) {
      for (const imbalance of resource.imbalances) {
        switch (imbalance.severity) {
          case 'high':
            deduction += 10;
            break;
          case 'medium':
            deduction += 5;
            break;
          case 'low':
            deduction += 2;
            break;
        }
      }
    }

    // Deduct for unbalanced resources
    if (resource.summary && !resource.summary.balanced) {
      deduction += 5;
    }

    return deduction;
  }

  /**
   * Calculate score deductions from strategy balance
   */
  calculateStrategyDeductions(strategy) {
    let deduction = 0;

    // Deduct for dominant strategies
    if (strategy.dominantStrategies && strategy.dominantStrategies.length > 0) {
      deduction += strategy.dominantStrategies.length * 10;
    }

    // Deduct for problematic strategies
    if (strategy.problematicStrategies && strategy.problematicStrategies.length > 0) {
      deduction += strategy.problematicStrategies.length * 8;
    }

    // Deduct for high win rate variance
    if (strategy.summary) {
      const stdDev = strategy.summary.winRateStandardDeviation;
      if (stdDev > 0.15) {
        deduction += 10;
      } else if (stdDev > 0.1) {
        deduction += 5;
      }
    }

    return deduction;
  }

  /**
   * Calculate score deductions from time balance
   */
  calculateTimeDeductions(time) {
    let deduction = 0;

    // Deduct for time imbalances
    if (time.imbalances) {
      for (const imbalance of time.imbalances) {
        switch (imbalance.severity) {
          case 'high':
            deduction += 8;
            break;
          case 'medium':
            deduction += 4;
            break;
          case 'low':
            deduction += 1;
            break;
        }
      }
    }

    return deduction;
  }

  /**
   * Determine overall balance status
   */
  determineStatus(score, resource, strategy, time) {
    if (score >= 80) {
      return BalanceStatus.BALANCED;
    } else if (score >= 60) {
      return BalanceStatus.NEEDS_ADJUSTMENT;
    } else {
      return BalanceStatus.UNBALANCED;
    }
  }

  /**
   * Identify risks from analysis results
   */
  identifyRisks(resource, strategy, time) {
    const risks = [];

    // Resource risks
    if (resource.imbalances) {
      for (const imbalance of resource.imbalances) {
        if (imbalance.severity === 'high') {
          risks.push(`[HIGH] ${imbalance.type}: ${imbalance.message}`);
        }
      }
    }

    // Strategy risks
    if (strategy.dominantStrategies && strategy.dominantStrategies.length > 0) {
      risks.push(`[HIGH] Dominant strategy detected: ${strategy.dominantStrategies.map(s => s.name).join(', ')}`);
    }

    if (strategy.problematicStrategies && strategy.problematicStrategies.length > 0) {
      risks.push(`[MEDIUM] Underpowered strategies: ${strategy.problematicStrategies.map(s => s.id).join(', ')}`);
    }

    // Time risks
    if (time.imbalances) {
      for (const imbalance of time.imbalances) {
        if (imbalance.severity === 'high') {
          risks.push(`[HIGH] ${imbalance.type}: ${imbalance.message}`);
        }
      }
    }

    return risks;
  }

  /**
   * Generate suggestions for improving balance
   */
  generateSuggestions(resource, strategy, time) {
    const suggestions = [];

    // Resource suggestions
    if (resource.imbalances) {
      for (const imbalance of resource.imbalances) {
        switch (imbalance.type) {
          case 'overpowered_resource':
            suggestions.push(`Reduce ${imbalance.resource} value or increase its scarcity`);
            break;
          case 'underpowered_resource':
            suggestions.push(`Buff ${imbalance.resource} or reduce its rarity`);
            break;
          case 'extreme_value_difference':
            suggestions.push('Normalize resource values - consider adjusting production rates');
            break;
          case 'high_production_variance':
            suggestions.push(`Reduce ${imbalance.resource} production variance for more consistent gameplay`);
            break;
        }
      }
    }

    // Strategy suggestions
    if (strategy.dominantStrategies && strategy.dominantStrategies.length > 0) {
      suggestions.push('Nerf dominant strategies or buff alternative strategies to restore diversity');
    }

    if (strategy.problematicStrategies && strategy.problematicStrategies.length > 0) {
      suggestions.push('Buff underpowered strategies to increase viable strategy pool');
    }

    // Time suggestions
    if (time.imbalances) {
      for (const imbalance of time.imbalances) {
        switch (imbalance.type) {
          case 'high_game_length_variance':
            suggestions.push('Stabilize game length by adjusting end-game triggering conditions');
            break;
          case 'high_first_player_advantage':
            suggestions.push('Consider alternate starting player or provide catch-up mechanics');
            break;
          case 'phase_dominance':
            suggestions.push(`Reduce ${imbalance.phase} phase duration to improve pacing`);
            break;
        }
      }
    }

    // Default suggestion if no specific issues
    if (suggestions.length === 0) {
      suggestions.push('Game appears well-balanced - monitor during playtesting for edge cases');
    }

    return suggestions;
  }

  /**
   * Generate markdown report
   * @returns {string} Markdown report
   */
  generateMarkdownReport() {
    if (!this.results) {
      this.analyze();
    }

    const r = this.results;

    let report = `# 平衡性分析报告\n\n`;
    report += `**游戏**: ${this.gameConfig.name || 'Unnamed Game'}\n`;
    report += `**分析时间**: ${r.metadata.analyzedAt}\n`;
    report += `**模拟次数**: ${r.metadata.simulations}\n\n`;

    // Overall assessment
    report += `## 总体评估\n\n`;
    report += `- **综合得分**: ${r.overallScore}/100\n`;
    report += `- **状态**: ${this.formatStatus(r.status)}\n\n`;

    // Resource balance
    report += `## 资源平衡\n\n`;
    if (r.resourceBalance.productionRate) {
      report += `### 资源价值\n\n`;
      report += `| 资源 | 相对价值 | 稀有度 | 每回合产出 |\n`;
      report += `|------|---------|--------|-----------|\n`;
      for (const [resource, data] of Object.entries(r.resourceBalance.productionRate)) {
        const value = r.resourceBalance.relativeValue?.[resource] || 1;
        const scarcity = r.resourceBalance.scarcity?.[resource] || 'common';
        report += `| ${resource} | ${value} | ${scarcity} | ${data.averagePerTurn.toFixed(2)} |\n`;
      }
      report += `\n`;
    }

    if (r.resourceBalance.imbalances && r.resourceBalance.imbalances.length > 0) {
      report += `### 发现的问题\n\n`;
      for (const issue of r.resourceBalance.imbalances) {
        report += `- **${issue.severity.toUpperCase()}**: ${issue.message}\n`;
      }
      report += `\n`;
    }

    // Strategy balance
    report += `## 策略平衡\n\n`;
    if (r.strategyBalance.strategies && r.strategyBalance.strategies.length > 0) {
      report += `### 策略胜率\n\n`;
      report += `| 策略 | 胜率 | 平均游戏时长 |\n`;
      report += `|------|------|------------|\n`;
      for (const strategy of r.strategyBalance.strategies) {
        report += `| ${strategy.name} | ${(strategy.winRate * 100).toFixed(1)}% | ${strategy.avgGameLength.toFixed(1)} |\n`;
      }
      report += `\n`;
    }

    if (r.strategyBalance.dominantStrategies && r.strategyBalance.dominantStrategies.length > 0) {
      report += `### 优势策略 ⚠️\n\n`;
      for (const s of r.strategyBalance.dominantStrategies) {
        report += `- **${s.name}**: ${(s.winRate * 100).toFixed(1)}% 胜率 (${s.severity} severity)\n`;
      }
      report += `\n`;
    }

    // Time balance
    report += `## 时间平衡\n\n`;
    if (r.timeBalance.expectedGameLength) {
      report += `### 游戏时长\n\n`;
      report += `- 平均: ${r.timeBalance.expectedGameLength.average} 回合\n`;
      report += `- 中位数: ${r.timeBalance.expectedGameLength.median} 回合\n`;
      report += `- 范围: ${r.timeBalance.expectedGameLength.min}-${r.timeBalance.expectedGameLength.max} 回合\n`;
      report += `- 变异系数: ${r.timeBalance.expectedGameLength.coefficientOfVariation}\n\n`;
    }

    if (r.timeBalance.firstPlayerAdvantage) {
      report += `### 先手优势\n\n`;
      report += `- 胜率加成: ${r.timeBalance.firstPlayerAdvantage.winRateBonus > 0 ? '+' : ''}${r.timeBalance.firstPlayerAdvantage.winRateBonus}%\n`;
      report += `- 显著性: ${r.timeBalance.firstPlayerAdvantage.significance}\n`;
      report += `- 选择机制: ${r.timeBalance.firstPlayerAdvantage.mechanism}\n\n`;
    }

    // Risks
    if (r.risks.length > 0) {
      report += `## 风险点\n\n`;
      for (const risk of r.risks) {
        report += `- ${risk}\n`;
      }
      report += `\n`;
    }

    // Suggestions
    if (r.suggestions.length > 0) {
      report += `## 优化建议\n\n`;
      for (const suggestion of r.suggestions) {
        report += `1. ${suggestion}\n`;
      }
      report += `\n`;
    }

    return report;
  }

  /**
   * Format status for display
   */
  formatStatus(status) {
    const statusMap = {
      [BalanceStatus.BALANCED]: '✅ 平衡',
      [BalanceStatus.NEEDS_ADJUSTMENT]: '⚠️ 需要调整',
      [BalanceStatus.UNBALANCED]: '❌ 严重不平衡'
    };
    return statusMap[status] || status;
  }
}

/**
 * Quick balance check function
 * @param {Object} gameConfig - Game configuration
 * @returns {Object} Quick balance assessment
 */
function quickBalanceCheck(gameConfig) {
  const analyzer = new BalanceAnalyzer(gameConfig);
  const results = analyzer.analyze();

  return {
    score: results.overallScore,
    status: results.status,
    criticalIssues: results.risks.filter(r => r.includes('[HIGH]')),
    suggestion: results.suggestions[0] || 'No specific issues found'
  };
}

module.exports = {
  BalanceAnalyzer,
  quickBalanceCheck,
  calculateResourceBalance,
  calculateStrategyBalance,
  calculateTimeBalance
};
