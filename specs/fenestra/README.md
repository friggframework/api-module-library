# Fenestra Specification

> *Fenestra* (Latin for "window") - A specification for describing platform UI component ecosystems

**Version**: 0.1.0-draft
**Status**: Early draft, seeking community feedback
**Target Foundation**: [OpenAPI Initiative (OAI)](https://www.openapis.org/), a Linux Foundation Collaborative Project

---

## Overview

Fenestra is a specification for describing how platforms expose UI component ecosystems to developers building integrations, apps, and extensions. It provides a standardized, machine-readable format for documenting:

- **Component Catalogs** - What UI components a platform provides
- **SDK Bindings** - How to import/use components from platform SDKs
- **Requirement Levels** - Whether platform components are required, recommended, or optional
- **Custom Component Policies** - Whether developers can bring their own (BYO) components
- **Publishing Constraints** - Different rules for public vs private apps
- **Rendering Engines** - How UI definitions translate to rendered interfaces

## Target Foundation

Fenestra is designed for submission to the **[OpenAPI Initiative (OAI)](https://www.openapis.org/)**, a Linux Foundation Collaborative Project that governs:

- **OpenAPI Specification** - The industry standard for describing REST APIs
- **Arazzo Specification** - Workflow orchestration for API sequences (released 2024)
- **Overlay Specification** - API document composition and extension

The OAI has demonstrated success in standardizing API descriptions. Fenestra extends this model to UI component ecosystems, complementing API and workflow descriptions with UI capability descriptions.

## Relationship to Other Specifications

| Specification | Purpose | Fenestra Integration |
|--------------|---------|---------------------|
| **OpenAPI** | API description | Fenestra extends OpenAPI patterns for UI description |
| **Arazzo** | Workflow orchestration | Workflow steps can reference Fenestra UI for user interactions |
| **MCP Apps** | AI-driven UI resources | Fenestra components map to MCP App templates |
| **JSON Forms** | Schema-driven forms | Fenestra supports JSON Schema-based rendering |

## Why Fenestra?

Modern platforms provide wildly different approaches to UI extensibility:

| Platform | SDK | Requirement Level | Custom Components |
|----------|-----|-------------------|-------------------|
| **HubSpot** | `@hubspot/ui-extensions` | Required | Not allowed |
| **Canva** | `@canva/app-ui-kit` | Strongly recommended for public apps | Limited |
| **Salesforce** | Lightning Web Components | Required for Lightning Experience | Via LWC only |
| **Miro** | Web SDK + Mirotone CSS | Optional | Fully allowed |
| **Front** | `@frontapp/ui-kit` | Recommended | Allowed |

Fenestra provides a unified way to describe these differences, enabling:

1. **Tooling** - Code generators, validators, and IDE plugins that understand platform constraints
2. **Documentation** - Consistent documentation across platforms
3. **Cross-platform portability** - Map components between platforms via web standard mappings
4. **AI agents** - LLMs can understand platform UI capabilities from structured descriptions

## Specification Structure

```yaml
fenestra: "0.1.0"

info:
  title: "Platform Name UI Ecosystem"
  version: "1.0.0"

platform:
  name: "PlatformName"
  vendor: "Company"
  documentation: "https://developers.platform.com"

sdks:
  main-sdk:
    package: "@platform/ui-components"
    packageManager: npm
    exports:
      Button: { type: component }
      TextField: { type: component }

componentCatalog:
  components:
    Button:
      name: "Button"
      category: action
      sdkBinding:
        sdk: main-sdk
        export: Button
      webStandardMapping:
        htmlElement: button
        ariaRole: button

policies:
  componentRequirement:
    level: required | recommended | optional
    scope: all | publicApps | marketplaceApps

  customComponents:
    allowed: true | false
    constraints:
      - mustFollowDesignSystem
      - requiresReview

  publishing:
    privateApps:
      componentRequirement: optional
      customComponentsAllowed: true
    publicApps:
      componentRequirement: required
      reviewRequired: true
```

## Key Concepts

### Component Requirement Levels

- **required** - Must use platform components exclusively (e.g., HubSpot)
- **recommended** - Platform components preferred, alternatives allowed with caveats (e.g., Canva)
- **optional** - Platform components available but not required (e.g., Miro)

### Publishing Scope

Requirements often differ based on app visibility:

- **Private apps** - Internal use only, more flexibility
- **Public apps** - Shared with others, stricter requirements
- **Marketplace apps** - Published to official store, strictest requirements + certification

### Custom Component Policies

Platforms vary in allowing custom/BYO components:

- **Not allowed** - Must use SDK components only
- **Allowed with constraints** - Must wrap platform primitives, follow design system
- **Fully allowed** - Complete freedom (rare in enterprise platforms)

### Web Standard Mappings

Components map to web platform standards for semantic understanding:

```yaml
webStandardMapping:
  htmlElement: button      # Closest HTML element
  ariaRole: button         # ARIA role for accessibility
  semanticType: action     # UI pattern category
```

## Integration with MCP Apps

The [MCP Apps specification](https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/) enables AI-driven UI through the Model Context Protocol. Fenestra components can be:

1. **Mapped to MCP App templates** - Platform components reference predeclared templates
2. **Exposed as UI resources** - Components declared in MCP server manifests
3. **Bound to tools** - UI surfaces linked to MCP tool invocations

```yaml
mcpAppsIntegration:
  supported: true
  templateMappings:
    form: JSONFormsRenderer
    confirmation: ConfirmDialog
  communicationProtocol: jsonRpc
```

## Integration with JSON Forms

[JSON Forms](https://jsonforms.io/) enables declarative form rendering from JSON Schema. Fenestra describes how platforms support this:

```yaml
jsonFormsIntegration:
  supported: true
  rendererSet: platform     # Uses platform's own renderers
  customRenderersAllowed: true
  componentBindings:
    text: TextField
    number: NumberInput
    boolean: Checkbox
    array: DynamicList
```

## Examples

See the `/examples` directory for complete Fenestra documents describing real platforms:

- [hubspot.fenestra.yaml](./examples/hubspot.fenestra.yaml) - HubSpot UI Extensions
- [canva.fenestra.yaml](./examples/canva.fenestra.yaml) - Canva App UI Kit
- [miro.fenestra.yaml](./examples/miro.fenestra.yaml) - Miro Developer Platform

## Current Limitations & Roadmap

This is an early draft. See [ISSUES.md](./ISSUES.md) for known gaps including:

- **Declarative UI** - JSON-based UI patterns (Slack Block Kit, Adaptive Cards) not yet supported
- **Mobile Platforms** - iOS/Android SDK ecosystems not addressed
- **MCP Apps** - Integration schema needs expansion for tool-to-UI bindings
- **Compliance** - Accessibility standards, security certifications, privacy regulations
- **Policy Granularity** - Per-category and per-extension-point requirements

## Contributing

This specification is a draft under development. Contributions welcome:

1. **Review** - Read the spec and examples, provide feedback
2. **Issues** - Open issues for gaps, edge cases, or unclear sections
3. **Examples** - Add Fenestra documents for additional platforms
4. **PRs** - Submit improvements to the specification schema

## Related Work

- [MCP Apps Proposal](https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/) - UI extension for Model Context Protocol
- [JSON Forms](https://jsonforms.io/) - JSON Schema-based form rendering
- [HubSpot UI Extensions](https://developers.hubspot.com/docs/platform/ui-extensions-overview)
- [Canva App UI Kit](https://www.canva.dev/docs/apps/app-ui-kit/)
- [Salesforce LWC](https://developer.salesforce.com/developer-centers/lightning-web-components)
- [Miro Developer Platform](https://developers.miro.com/)
- [Front Plugin SDK](https://dev.frontapp.com/docs/plugin-overview)

## License

Apache 2.0
