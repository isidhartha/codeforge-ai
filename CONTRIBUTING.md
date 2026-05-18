# Contributing to CodeForge AI

Thank you for your interest in contributing to CodeForge AI!

## Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes following the guidelines below
4. Run tests: `cd backend && pytest` and `cd frontend && npm test`
5. Open a Pull Request against `main`

## Code Style

### Backend (Python)
- Follow PEP 8
- Use type hints on all public functions
- Keep functions under 30 lines
- Write docstrings for all public APIs
- Use `ruff` for linting: `ruff check .`

### Frontend (TypeScript/React)
- Use TypeScript strict mode
- Functional components with hooks only
- Use Tailwind for styling; no inline styles
- Keep components under 150 lines; split if larger
- Run `npm run lint` before committing

## Commit Messages

Use the Conventional Commits format:

```
feat: add semantic search to project indexer
fix: handle WebSocket reconnection on terminal disconnect
docs: update API reference with /ws/terminal example
refactor: extract streaming logic into shared utility
test: add unit tests for code_assistant streaming
```

## Pull Request Process

1. Ensure all CI checks pass
2. Add tests for new features
3. Update documentation as needed
4. Request a review from a maintainer
5. Squash commits on merge

## Reporting Issues

Use GitHub Issues with the appropriate label:
- `bug` — something is broken
- `enhancement` — new feature request
- `documentation` — docs improvement
- `question` — help wanted

## Security

For security vulnerabilities, do NOT open a public issue. Email the maintainers directly.
