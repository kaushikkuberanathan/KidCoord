# Contributing to KidCoord

Thank you for your interest in contributing to KidCoord!

## Code of Conduct

- Be respectful and inclusive
- Focus on what's best for the community
- Show empathy towards other contributors

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/kidcoord.git`
3. Create a branch: `git checkout -b feature/my-feature`
4. Make your changes
5. Test thoroughly
6. Submit a pull request

## Development Setup

See [SETUP.md](./SETUP.md) for complete setup instructions.

## Code Style

### TypeScript
- Use strict mode
- Explicit return types for functions
- Meaningful variable names
- No `any` types unless absolutely necessary

### Commits
Follow conventional commits:
```
feat: add new feature
fix: bug fix
docs: documentation only
refactor: code refactoring
test: adding tests
chore: maintenance
```

### Naming Conventions
- Variables: `camelCase`
- Functions: `camelCase`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `kebab-case.ts` or `PascalCase.tsx` (components)

## Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new features
3. **Run linter**: `npm run lint`
4. **Run tests**: `npm test`
5. **Update CHECKLIST.md** to mark completed items
6. **Describe changes** clearly in PR description
7. **Link related issues**

### PR Title Format
```
feat(backend): implement availability endpoints
fix(frontend): resolve state machine validation
docs: update API documentation
```

## Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

## Code Review

Pull requests require:
- [ ] All tests passing
- [ ] Linter passing
- [ ] Documentation updated
- [ ] At least one approving review
- [ ] No merge conflicts

## Architecture Guidelines

### State Machines
- Always validate transitions
- Use utilities in `utils/stateMachine.ts`
- Add tests to `STATE_MACHINE_TESTS.md`

### Idempotency
- All write endpoints must support `Idempotency-Key`
- Use `requireIdempotency` middleware for critical endpoints
- Never duplicate side effects

### Logging
- Use structured logging (Winston)
- Include correlation IDs
- Log at appropriate levels
- Never log sensitive data

### Database
- Use parameterized queries
- Always use transactions for multi-step operations
- Add appropriate indexes
- Document schema changes

## Questions?

- Check [docs/](./docs/) for detailed documentation
- Open a GitHub issue for questions
- Tag maintainers for urgent issues

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
