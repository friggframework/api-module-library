# Fenestra Specification

<img src="https://img.shields.io/badge/Version-0.1.0-blue" alt="Version 0.1.0"> <img src="https://img.shields.io/badge/Status-Draft-yellow" alt="Status: Draft"> <img src="https://img.shields.io/badge/License-Apache%202.0-green" alt="License: Apache 2.0">

**Fenestra** (Latin for "window") is a specification for describing platform UI component ecosystems, SDK bindings, and UI rendering capabilities in a standardized, machine-readable format.

## The Specification

The latest published version of the specification:

| Version | Status | Release Date |
|---------|--------|--------------|
| [0.1.0](versions/0.1.0.md) | Draft | 2024-12-27 |

### JSON Schema

Validation schemas for Fenestra documents:

- [v0.1 JSON Schema](schemas/v0.1/fenestra.schema.json)

## Overview

Modern platforms (HubSpot, Salesforce, Canva, Slack, Stripe, etc.) provide UI extension points with varying degrees of flexibility. Fenestra standardizes the description of:

- **Component Catalogs** - What UI components a platform provides
- **SDK Bindings** - How to import and use components from platform SDKs
- **Extension Points** - Where UI can be injected in the host platform
- **Policies** - Component requirements, custom component rules, publishing constraints
- **Rendering Engines** - How UI definitions translate to rendered interfaces

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
    installCommand: "npm install @hubspot/ui-extensions"
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
```

## Relationship to Other Specifications

Fenestra complements existing OpenAPI Initiative specifications:

| Specification | Describes | Fenestra Relationship |
|---------------|-----------|----------------------|
| **OpenAPI** | REST API endpoints | Companion spec; APIs can reference Fenestra for UI responses |
| **Arazzo** | API workflow sequences | Workflow steps can invoke Fenestra-described UI |
| **Overlay** | API document composition | Overlays can modify Fenestra documents |
| **JSON Schema** | Data validation | Fenestra uses JSON Schema for component props |

Fenestra can exist independently of OpenAPI - a platform's UI ecosystem is separate from its API.

## Examples

See the [examples](examples/0.1.0/) directory for complete Fenestra documents:

- [hubspot.fenestra.yaml](examples/0.1.0/hubspot.fenestra.yaml) - HubSpot UI Extensions
- [miro.fenestra.yaml](examples/0.1.0/miro.fenestra.yaml) - Miro Developer Platform
- [mcp-apps.fenestra.yaml](examples/0.1.0/mcp-apps.fenestra.yaml) - MCP Apps Host

## Repository Structure

```
fenestra/
├── versions/
│   └── 0.1.0.md              # Specification document
├── schemas/
│   └── v0.1/
│       └── fenestra.schema.json  # JSON Schema for validation
├── examples/
│   └── 0.1.0/                # Example Fenestra documents
├── CONTRIBUTING.md           # Contribution guidelines
├── MAINTAINERS.md           # Maintainer information
└── README.md                # This file
```

## Use Cases

Having Fenestra specs enables:

1. **Code Generation** - Generate platform-specific integration code
2. **Visual Designers** - Build design tools aware of platform constraints
3. **Validation** - Verify integrations follow platform policies
4. **Documentation** - Auto-generate consistent developer docs
5. **AI Agents** - Enable AI to understand platform UI capabilities
6. **Cross-Platform Portability** - Map components between platforms
7. **Platform Development** - Design extensibility for new platforms

See the [specification](versions/0.1.0.md) for detailed use cases and examples.

## Tooling

Planned tooling for Fenestra:

- **Validator** - Validate Fenestra documents against the schema
- **Generator** - Generate integration scaffolding from specs
- **Docs Generator** - Generate documentation from specs
- **Visual Designer** - Design integrations with platform-aware UI

See [ISSUES.md](ISSUES.md) for the tooling roadmap.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start

1. Read the [specification](versions/0.1.0.md)
2. Review the [examples](examples/0.1.0/)
3. Open an issue for feedback or suggestions
4. Submit a pull request for improvements

## Governance

- **Maintainers**: See [MAINTAINERS.md](MAINTAINERS.md)
- **Submission Status**: Preparing for OAI submission (see [SUBMISSION.md](SUBMISSION.md))
- **Working Group**: Forming (contact maintainers to join)

## Related Resources

### OAI Specifications
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [Arazzo Specification](https://spec.openapis.org/arazzo/latest.html)
- [Overlay Specification](https://spec.openapis.org/overlay/latest.html)

### Platform Documentation
- [HubSpot UI Extensions](https://developers.hubspot.com/docs/platform/ui-extensions-overview)
- [Canva Apps SDK](https://www.canva.dev/docs/apps/app-ui-kit/)
- [Salesforce Lightning Web Components](https://developer.salesforce.com/developer-centers/lightning-web-components)
- [Slack Block Kit](https://api.slack.com/block-kit)
- [Stripe Elements](https://stripe.com/docs/stripe-js)

### Related Technologies
- [MCP Apps](https://modelcontextprotocol.io/) - AI-driven UI via Model Context Protocol
- [JSON Forms](https://jsonforms.io/) - JSON Schema-based form rendering

## License

This specification is licensed under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).

---

**Fenestra** is designed for submission to the [OpenAPI Initiative](https://www.openapis.org/), a Linux Foundation Collaborative Project.
