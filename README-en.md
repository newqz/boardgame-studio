# 🎮 Board Game Studio

> AI-powered factory for converting physical board games into online experiences

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%20≥18.0-brightgreen)](package.json)

## What is Board Game Studio?

Board Game Studio is an **AI Agent team** consisting of 16 specialized roles, dedicated to converting physical board games (such as Catan, UNO, Seven Wonders, etc.) into playable online software.

The team includes: rule analysis experts, balance evaluation experts, UI designers, game engine developers, multiplayer architects, AI opponent engineers, QA engineers, and more — covering the complete workflow from rule analysis to game launch.

---

## ✨ Key Features

- **Rule Parsing** — Automatically extract game mechanics and structured data from text rules
- **Balance Calculation** — Monte Carlo simulation, win rate analysis, strategy equilibrium detection
- **Multiplayer Sync** — Supports Lockstep, Client-Prediction, and other synchronization architectures
- **State Management** — Serialization, replay, disconnection recovery
- **Test Generation** — Auto-generate unit/integration/E2E test cases
- **AI Opponents** — Dynamic difficulty adjustment, adaptive learning

---

## 🛠️ Skills Library

6 independently usable skill packages:

| Skill | Description | Priority |
|-------|-------------|----------|
| [game-rules-parser](skills/game-rules-parser/) | Parse board game rule documents into structured data | P0 |
| [balance-calculator](skills/balance-calculator/) | Calculate and evaluate game balance | P0 |
| [test-case-generator](skills/test-case-generator/) | Generate test cases and test data | P0 |
| [multiplayer-sync](skills/multiplayer-sync/) | Real-time multiplayer synchronization architecture | P0 |
| [game-state-manager](skills/game-state-manager/) | Game state serialization and recovery | P1 |
| [ai-difficulty-tuner](skills/ai-difficulty-tuner/) | AI dynamic difficulty adjustment | P1 |

Each skill directory contains:
- `SKILL.md` — Skill definition and usage guide
- `src/` — Core implementation code
- `tests/` — Test cases
- `package.json` — Dependencies

---

## 📦 Installation

### Prerequisites

- **Node.js** ≥ 18.0
- **npm** ≥ 9.0

### Clone the Project

```bash
git clone https://github.com/<your-username>/boardgame-studio.git
cd boardgame-studio
```

### Install Dependencies

```bash
# Install all skills dependencies
cd skills/game-rules-parser && npm install && cd ../..
cd skills/balance-calculator && npm install && cd ../..
cd skills/test-case-generator && npm install && cd ../..
cd skills/multiplayer-sync && npm install && cd ../..
cd skills/game-state-manager && npm install && cd ../..
cd skills/ai-difficulty-tuner && npm install && cd ../..

# Or use the install script
bash scripts/install-all.sh
```

### Quick Install (All Skills)

```bash
for dir in skills/*/; do
  if [ -f "$dir/package.json" ]; then
    echo "Installing $(basename "$dir")..."
    npm install --prefix "$dir"
  fi
done
```

---

## 🚀 Quick Start

### 1. Parse Board Game Rules

```javascript
const { RuleParser } = require('./skills/game-rules-parser/src/index');

const parser = new RuleParser();
const result = await parser.parseFromFile('./rules/catan.md');

console.log(result.gameInfo);
// { name: 'Catan', playerCount: { min: 3, max: 4 }, ... }
```

### 2. Calculate Balance

```javascript
const { BalanceCalculator } = require('./skills/balance-calculator/src/index');

const calculator = new BalanceCalculator();
const report = await calculator.analyze({
  resources: ['wood', 'brick', 'sheep', 'wheat', 'ore'],
  productionRate: { wood: 0.2, brick: 0.2, ... },
  victoryPoints: 10
});

console.log(report.overallScore); // 0-100
```

### 3. Multiplayer Sync

```javascript
const { LockstepSynchronizer } = require('./skills/multiplayer-sync/src/index');

const sync = new LockstepSynchronizer({ playerCount: 4 });
sync.on('turn_executed', (data) => broadcastToPlayers(data));
sync.submitInput('player1', { type: 'roll_dice' });
```

### 4. State Management

```javascript
const { GameStateManager } = require('./skills/game-state-manager/src/index');

const manager = new GameStateManager();
manager.createGame('room-001', initialState);
const snapshot = manager.createSnapshot(state, 'Turn 5');
const delta = manager.diff(stateA, stateB);
```

### 5. Generate Test Cases

```javascript
const { TestGenerator } = require('./skills/test-case-generator/src/index');

const generator = new TestGenerator();
const cases = generator.generateFromRules(parsedRules, {
  coverage: 'full',
  types: ['unit', 'boundary', 'integration']
});

console.log(cases); // Array of test cases
```

---

## 🧪 Run Tests

```bash
# Single skill test
cd skills/game-state-manager
npm test

# All skills tests
npm test --workspaces --if-present

# With coverage
npm run test:coverage --workspaces --if-present
```

---

## 📁 Project Structure

```
boardgame-studio/
├── README.md               # This file (Chinese)
├── README-en.md            # English version
├── SOUL.md                 # Team charter
├── PROTOCOLS.md            # Agent handover protocol
├── META-MODEL.md           # Board game meta model DSL
├── EXAMPLES.md             # End-to-end examples
├── AGENT-MODEL-MAPPING.md # Agent-Model binding
│
├── *.md                    # Agent role definitions (16)
│
├── skills/                 # Skills library
│   ├── game-rules-parser/  # P0 - Rule parsing
│   ├── balance-calculator/ # P0 - Balance calculation
│   ├── test-case-generator/ # P0 - Test generation
│   ├── multiplayer-sync/   # P0 - Multiplayer sync
│   ├── game-state-manager/ # P1 - State management
│   └── ai-difficulty-tuner/ # P1 - Difficulty tuning
│
├── backend/                # Backend code (in development)
├── frontend/               # Frontend code (in development)
├── src/                    # Shared source code (in development)
├── tests/                  # Integration tests (in development)
├── design/                 # Design assets (in development)
├── devops/                 # CI/CD configuration (in development)
└── docs/                   # Documentation
```

---

## 🎯 Complexity Tiers

| Tier | Example Games | Estimated Hours | Agent Config |
|------|--------------|-----------------|--------------|
| Tier 1 | UNO, Speed | 20-40h | Simplified |
| Tier 2 | Catan, Seven Wonders | 80-120h | Standard |
| Tier 3 | Terra Mystica, Agricola | 200-400h | Enhanced |
| Tier 4 | Gloomhaven, Dark Souls | 600h+ | Full |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript / Phaser 3 |
| Backend | Node.js + Colyseus |
| Database | PostgreSQL + Redis |
| Real-time | WebSocket (Socket.io) |
| Deploy | Docker + Kubernetes |
| Monitoring | Prometheus + Grafana |
| AI | Game Tree Search (Minimax, MCTS) |

---

## 📚 Related Documentation

| Document | Description |
|----------|-------------|
| [SOUL.md](SOUL.md) | Team values and workflow |
| [PROTOCOLS.md](PROTOCOLS.md) | Agent handover protocol v3 |
| [META-MODEL.md](META-MODEL.md) | Board game meta model DSL |
| [EXAMPLES.md](EXAMPLES.md) | Catan + UNO + Terra Mystica examples |
| [OBSERVABILITY.md](OBSERVABILITY.md) | Observability framework |
| [RULES-ENGINE.md](RULES-ENGINE.md) | Rule verification layer |
| [RESILIENCE.md](RESILIENCE.md) | Fault tolerance and degradation model |
| [CONCURRENCY.md](CONCURRENCY.md) | Concurrency control |

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Create a Pull Request

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for details.

---

## 📄 License

This project is open source under the MIT License — see [LICENSE](LICENSE)

---

*Last updated: 2026-03-25*
