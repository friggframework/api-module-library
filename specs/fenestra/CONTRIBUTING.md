# Contributing to the Fenestra Specification

Thank you for your interest in contributing to the Fenestra Specification! This document provides guidelines for contributing to the specification.

## Ways to Contribute

### Report Issues

If you find an error in the specification or have a suggestion for improvement:

1. Check if an issue already exists in the [issue tracker](https://github.com/friggframework/fenestra-spec/issues)
2. If not, create a new issue with a clear description
3. Include examples when possible

### Propose Changes

For changes to the specification:

1. **Minor clarifications**: Open an issue describing the clarification needed
2. **New features**: Open a discussion or issue to gather feedback before implementation
3. **Bug fixes**: Open a pull request with a clear description of the fix

### Submit Pull Requests

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes following the style guidelines below
4. Submit a pull request

## Style Guidelines

### Specification Document

The specification document (`versions/0.1.0.md`) follows these conventions:

- Use RFC 2119 key words (MUST, SHOULD, MAY) in capitals for normative statements
- Document each object with:
  - A description paragraph
  - A "Fixed Fields" table
  - Examples in YAML format
- Use consistent table formatting
- Include anchor links for all object and field names

### Schema Files

JSON Schema files (`schemas/`) should:

- Use JSON Schema Draft 2020-12
- Include descriptions for all properties
- Define enums where applicable
- Support specification extensions via `patternProperties`

### Examples

Example files (`examples/`) should:

- Be valid according to the JSON Schema
- Demonstrate real-world use cases
- Include comments explaining key decisions

## Development Setup

```bash
# Clone the repository
git clone https://github.com/friggframework/fenestra-spec.git
cd fenestra-spec

# Install dependencies (for validation tooling)
npm install

# Validate examples against schema
npm run validate
```

## Review Process

1. All changes require review by at least one maintainer
2. Specification changes require consensus from the working group
3. CI checks must pass before merging

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Please be respectful and constructive in all interactions.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

## Questions?

- Open a [GitHub Discussion](https://github.com/friggframework/fenestra-spec/discussions)
- Join the Fenestra Working Group meetings (schedule TBD)
- Contact the maintainers

Thank you for helping improve the Fenestra Specification!
