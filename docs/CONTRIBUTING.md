# Contributing to Board Game Studio

## Code of Conduct

Please be respectful and constructive in all interactions.

## How to Contribute

### 1. Fork & Clone

```bash
git clone https://github.com/your-org/boardgame-studio.git
cd boardgame-studio
```

### 2. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 3. Make Changes

- Follow the existing code style
- Update documentation as needed
- Add tests for new features

### 4. Commit

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve issue #X"
git commit -m "docs: update README"
```

### 5. Push & Pull Request

```bash
git push origin feature/your-feature-name
```

## Commit Message Format

```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
```

## Reporting Issues

Please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- OpenClaw version and environment

## Framework Documents

When contributing to the agent framework:
- All agent definitions are in Markdown files (`.md`)
- Protocol changes must update `PROTOCOLS.md`
- New agents require documentation and model mapping
