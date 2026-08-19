# Contributing to PAR(2) Discovery Engine

Thank you for your interest in contributing to the PAR(2) Discovery Engine.

## Reporting Bugs

If you find a bug, please open a [GitHub Issue](https://github.com/mickwh2764/par2-engine/issues) with:

1. A clear description of the problem
2. Steps to reproduce
3. Expected vs actual behavior
4. Browser/OS information if relevant

## Suggesting Improvements

Feature requests and scientific suggestions are welcome via GitHub Issues. Please tag them with `enhancement`.

## Code Contributions

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-change`)
3. Make your changes
4. Run the type checker: `npx tsc --noEmit`
5. Commit with a descriptive message
6. Open a Pull Request against `main`

### Code Style

- TypeScript strict mode is enabled
- Use the existing code patterns as a guide
- Avoid `any` types where possible
- All file operations must use `sanitizePathParam()` for user-supplied paths

### Security

- Never commit credentials or secrets
- Use environment variables for configuration
- Report security vulnerabilities privately (see [SECURITY.md](SECURITY.md))

## License

By contributing, you agree that your contributions will be licensed under the project's [PolyForm Noncommercial License 1.0.0](LICENSE), and you grant the author (Michael Whiteside) the right to also license your contributions under separate commercial terms (see [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)). This dual-track arrangement keeps the project free for noncommercial use while allowing the author to offer commercial licenses.

## Contact

For questions about contributing, email mickwh@msn.com.
