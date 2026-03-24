# Changelog

All notable changes to this project will be documented in this file.

## [6.0.0] - 2026-03-24 - Production Ready

### Added
- `RULES-ENGINE.md` - Authoritative rule validation layer with FEN serialization
- `RESILIENCE.md` - Degradation/circuit-breaker model for agent failures
- `CONCURRENCY.md` - Formal concurrency model (semi-sync/async)
- `OBSERVABILITY.md` v1.2 - Runtime metrics (Top 10) and Prometheus format

### Fixed (P0)
- Validation timeout → default deny behavior
- Runtime metrics and alerting specifications
- Concurrency model definition

### Rating
- Score: 95/100 (Opus 4.6 Review)

## [5.0.0] - 2026-03-24 - Framework v5

### Added
- `AGENT-MODEL-MAPPING.md` - Explicit agent-to-model binding matrix
- `OBSERVABILITY.md` - Trace architecture, decision logging, dashboards
- Enhanced `META-MODEL.md` - Runtime architecture chapter

### Rating
- Score: 88/100 (Opus 4.6 Review)

## [4.0.0] - 2026-03-24

### Added
- `QUALITY.md` - Quality gate vs operational monitoring separation
- `EXAMPLES.md` - End-to-end examples (Catan, UNO, Mystery Land)

### Rating
- Score: 77/100

## [3.0.0] - 2026-03-24

### Added
- `PROTOCOLS.md` v2 - Reverse flow control, version control, rejection protocol
- `META-MODEL.md` - Board game DSL, complexity taxonomy

### Rating
- Score: 78/100

## [2.0.0] - 2026-03-24

### Added
- Agent role definitions (16 roles)
- Basic protocols

### Rating
- Score: 80/100

## [1.0.0] - 2026-03-24

### Initial Release

- Basic framework structure
- Agent team definition

### Rating
- Score: 70/100
