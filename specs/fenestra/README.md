# Fenestra Specification

<img src="https://img.shields.io/badge/Version-0.1.0-blue" alt="Version 0.1.0"> <img src="https://img.shields.io/badge/Status-Draft-yellow" alt="Status: Draft"> <img src="https://img.shields.io/badge/License-Apache%202.0-green" alt="License: Apache 2.0">

**Fenestra** (Latin for "window") is a specification for describing platform UI component ecosystems, SDK bindings, and UI rendering capabilities in a standardized, machine-readable format.

## Specification Structure

Fenestra uses a **modular architecture**: a Core specification plus optional Extensions. This mirrors the pattern used by other OAI specifications (OpenAPI + Overlay, Arazzo as a companion spec).

| Specification | Objects | Purpose |
|---------------|---------|---------|
| [**Fenestra Core**](versions/core/0.1.0.md) | ~35 | Components, SDKs, Extension Points, Policies |
| [**Agents Extension**](versions/extensions/agents/0.1.0.md) | ~18 | AI agent interaction (MCP, templates, permissions) |
| [**Compliance Extension**](versions/extensions/compliance/0.1.0.md) | ~14 | Accessibility, security, privacy requirements |
| [**I18n Extension**](versions/extensions/i18n/0.1.0.md) | ~9 | Internationalization capabilities |
| [**Declarative Extension**](versions/extensions/declarative/0.1.0.md) | ~4 | JSON-based UI schemas (Block Kit, Adaptive Cards) |

### Why Modular?

- **Core is comparable to OpenAPI** (~35 objects vs OpenAPI's 30)
- **Extensions are optional** - platforms adopt what's relevant
- **Independent versioning** - agents can evolve faster than core
- **Fills documentation gaps** - provides vocabulary for things platforms *should* document but often don't (compliance, i18n)

### JSON Schemas

| Schema | Purpose |
|--------|---------|
| [fenestra-core.schema.json](schemas/core/v0.1/fenestra-core.schema.json) | Validate Core documents |
| [fenestra-agents.schema.json](schemas/extensions/agents/v0.1/fenestra-agents.schema.json) | Validate Agents extension |
| [fenestra-compliance.schema.json](schemas/extensions/compliance/v0.1/fenestra-compliance.schema.json) | Validate Compliance extension |
| [fenestra-i18n.schema.json](schemas/extensions/i18n/v0.1/fenestra-i18n.schema.json) | Validate I18n extension |
| [fenestra-declarative.schema.json](schemas/extensions/declarative/v0.1/fenestra-declarative.schema.json) | Validate Declarative extension |

## Overview

Modern platforms (HubSpot, Salesforce, Slack, Figma, Stripe, etc.) provide UI extension points with varying degrees of flexibility. Fenestra standardizes the description of:

**Core Capabilities:**
- **Component Catalogs** - What UI components a platform provides
- **SDK Bindings** - How to import and use components from platform SDKs
- **Extension Points** - Where UI can be injected in the host platform
- **Policies** - Component requirements, custom component rules, publishing constraints
- **Rendering Engines** - How UI definitions translate to rendered interfaces

**Extension Capabilities:**
- **Agent Interaction** - How AI agents invoke UI (MCP protocol, templates, permissions)
- **Compliance** - Accessibility (WCAG), security (SOC2), privacy (GDPR) requirements
- **Internationalization** - Localization requirements, RTL support, translation mechanisms
- **Declarative Schemas** - JSON-based UI patterns (Slack Block Kit, Adaptive Cards)

## Quick Example

```yaml
fenestra: "0.1.0"
info:
  title: HubSpot UI Extensions
  version: "1.0.0"
platform:
  name: HubSpot
  documentation: https://developers.hubspot.com/docs/platform/ui-extensions-overview
sdks:
  hubspot-ui-extensions:
    name: HubSpot UI Extensions SDK
    packageManager: npm
    package: "@hubspot/ui-extensions"
policies:
  componentRequirement:
    level: required
    scope: all
  customComponents:
    allowed: false
extensionPoints:
  - id: crm-sidebar
    name: CRM Record Sidebar
    type: sidebar
    extensionType: codedComponents

# Optional extensions:
compliance:
  accessibility:
    platformStandard: "WCAG 2.1 AA"
  security:
    platformCertifications: ["SOC 2 Type II"]

i18n:
  platformSupport:
    availableLocales: ["en", "es", "fr", "de"]

agentInteraction:
  protocols:
    - name: mcp
      version: "1.0"
```

## Repository Structure

```
fenestra/
├── versions/
│   ├── core/
│   │   └── 0.1.0.md                    # Core specification
│   └── extensions/
│       ├── agents/0.1.0.md             # Agents extension
│       ├── compliance/0.1.0.md         # Compliance extension
│       ├── declarative/0.1.0.md        # Declarative extension
│       └── i18n/0.1.0.md               # I18n extension
├── schemas/
│   ├── core/v0.1/                      # Core JSON Schema
│   └── extensions/
│       ├── agents/v0.1/
│       ├── compliance/v0.1/
│       ├── declarative/v0.1/
│       └── i18n/v0.1/
├── examples/
│   └── 0.1.0/                          # Example documents
├── tools/                              # Validator CLI
├── CONTRIBUTING.md
├── MAINTAINERS.md
└── README.md
```

## Relationship to Other Specifications

Fenestra complements existing specifications:

| Specification | Describes | Fenestra Relationship |
|---------------|-----------|----------------------|
| **OpenAPI** | REST API endpoints | Companion spec; APIs can reference Fenestra for UI responses |
| **Arazzo** | API workflow sequences | Workflow steps can invoke Fenestra-described UI |
| **MCP** | Model Context Protocol | Agents extension aligns with MCP Apps patterns |
| **JSON Schema** | Data validation | Fenestra uses JSON Schema for component props |

## Examples

See the [examples](examples/0.1.0/) directory:

- [hubspot.fenestra.yaml](examples/0.1.0/hubspot.fenestra.yaml) - HubSpot UI Extensions
- [miro.fenestra.yaml](examples/0.1.0/miro.fenestra.yaml) - Miro Developer Platform
- [mcp-apps.fenestra.yaml](examples/0.1.0/mcp-apps.fenestra.yaml) - MCP Apps Host

## Tooling

### Validator CLI

```bash
cd tools && npm install
node bin/fenestra.js validate ../examples/0.1.0/hubspot.fenestra.yaml
```

### Planned Tooling

- **Generator** - Generate integration scaffolding from specs
- **Docs Generator** - Generate documentation from specs
- **Visual Designer** - Design integrations with platform-aware UI

## Use Cases

1. **Code Generation** - Generate platform-specific integration code
2. **Visual Designers** - Build design tools aware of platform constraints
3. **Validation** - Verify integrations follow platform policies
4. **Documentation** - Auto-generate consistent developer docs
5. **AI Agents** - Enable AI to understand platform UI capabilities
6. **Cross-Platform Portability** - Map components between platforms
7. **Compliance Tracking** - Document accessibility/security requirements

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Governance

- **Maintainers**: See [MAINTAINERS.md](MAINTAINERS.md)
- **Target**: OpenAPI Initiative (Linux Foundation)

## Related Resources

### OAI Specifications
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [Arazzo Specification](https://spec.openapis.org/arazzo/latest.html)

### Platform Documentation
- [HubSpot UI Extensions](https://developers.hubspot.com/docs/platform/ui-extensions-overview)
- [Slack Block Kit](https://api.slack.com/block-kit)
- [MCP Protocol](https://modelcontextprotocol.io/)

## License

Licensed under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).

---

**Fenestra** is designed for submission to the [OpenAPI Initiative](https://www.openapis.org/), a Linux Foundation Collaborative Project.
