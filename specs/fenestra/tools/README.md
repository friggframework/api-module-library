# Fenestra CLI Tools

Command-line tools for working with the Fenestra Specification.

## Installation

```bash
# From npm (when published)
npm install -g @fenestra/cli

# From source
cd tools
npm install
npm link
```

## Commands

### validate

Validate a Fenestra document against the specification schema.

```bash
fenestra validate <file>
```

**Options:**
- `-s, --schema <path>` - Use a custom schema file
- `-q, --quiet` - Only output errors
- `--json` - Output results as JSON

**Examples:**

```bash
# Validate a Fenestra document
fenestra validate ./hubspot.fenestra.yaml

# Output:
# Validating: /path/to/hubspot.fenestra.yaml
#
# Document Info:
#   Title: HubSpot UI Extensions
#   Version: 1.0.0
#   Fenestra: 0.1.0
#   Platform: HubSpot
#
# ℹ 25 component(s) defined
# ℹ 3 extension point(s)
# ℹ 2 SDK(s) defined
# ℹ Policies: components: required, custom: not allowed
#
# ✓ Valid Fenestra document
#   Contains: 25 components, 3 extension points, 2 SDKs

# Quiet mode (only errors)
fenestra validate ./my-app.yaml --quiet

# JSON output for CI/CD
fenestra validate ./my-app.yaml --json

# Use custom schema
fenestra validate ./my-app.yaml --schema ./custom-schema.json
```

**Exit Codes:**
- `0` - Document is valid
- `1` - Document is invalid or error occurred

## Validation Checks

The validator performs:

1. **Schema Validation** - Validates against JSON Schema Draft 2020-12
2. **Reference Checking** - Verifies SDK references in components exist
3. **Completeness Warnings** - Warns about missing recommended fields
4. **Extension Type Validation** - Checks valid extension types

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run validator directly
node bin/fenestra.js validate ../examples/0.1.0/hubspot.fenestra.yaml
```

## License

Apache-2.0
