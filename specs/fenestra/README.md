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

Fenestra is **not an API specification** - it's a **Platform Capabilities Specification**. It describes UI ecosystems, not HTTP endpoints.

### Spec Family Comparison

| Specification | Describes | Example |
|---------------|-----------|---------|
| **OpenAPI** | REST API endpoints | `POST /contacts` returns `Contact` |
| **AsyncAPI** | Event-driven APIs | `order.created` event payload |
| **Arazzo** | Workflows across APIs | "Create contact, then send email" |
| **Fenestra** | UI extension ecosystems | "Platform has Button, Card, uses React SDK" |

### Can Fenestra Exist Independently?

**Yes.** A platform's UI ecosystem exists independently of its API:

```
┌─────────────────────────────────────────────────────┐
│                    HubSpot                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│   OpenAPI Doc                 Fenestra Doc          │
│   ─────────────               ────────────          │
│   • GET /contacts             • UI Extensions SDK   │
│   • POST /deals               • CRM Cards           │
│   • OAuth flows               • Component catalog   │
│   • Webhook schemas           • BYO policy: No      │
│                                                     │
│   (How to call the API)       (How to build UI)     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Relationship Models

Fenestra can relate to OpenAPI in several ways:

1. **Standalone** - Fenestra doc exists independently (most common)
2. **Companion** - Both specs describe the same platform side-by-side
3. **Cross-Reference** - OpenAPI operations reference Fenestra for UI responses
4. **Embedded** - `x-fenestra` extension embeds UI info in OpenAPI docs

| Integration | Fenestra Relation |
|-------------|-------------------|
| **OpenAPI** | Companion spec; can cross-reference via `$ref` |
| **Arazzo** | Workflow steps can invoke Fenestra-described UI for user interactions |
| **MCP Apps** | Fenestra describes host UI capabilities for agent-driven interfaces |
| **JSON Forms** | Fenestra documents which platforms support JSON Schema-based rendering |

---

## Use Cases

Having Fenestra specs for each platform enables powerful tooling and workflows.

### 1. Visual Designer with Code Generation

Build a **generative design platform** where:

```
┌─────────────────────────────────────────────────────────────────┐
│                    VISUAL DESIGNER                              │
│                                                                 │
│  ┌─────────────┐    ┌─────────────────────────────────────────┐│
│  │ Target:     │    │                                         ││
│  │ [HubSpot ▼] │    │   ┌─────────────────────────────────┐   ││
│  └─────────────┘    │   │  Card                           │   ││
│                     │   │  ┌─────────────────────────────┐│   ││
│  Components:        │   │  │ Text: "Customer Info"       ││   ││
│  ┌─────────────┐    │   │  ├─────────────────────────────┤│   ││
│  │ ☑ Button    │    │   │  │ [Input: Email     ]        ││   ││
│  │ ☑ Card      │    │   │  │ [Select: Status ▼]        ││   ││
│  │ ☑ Input     │    │   │  │                            ││   ││
│  │ ☑ Select    │    │   │  │     [Save Button]          ││   ││
│  │ ☐ CustomDiv │←───│───│  └─────────────────────────────┘│   ││
│  │   (blocked) │    │   └─────────────────────────────────┘   ││
│  └─────────────┘    │                                         ││
│                     └─────────────────────────────────────────┘│
│  Fenestra tells     Canvas reflects platform constraints       │
│  designer what's                                                │
│  allowed                                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Generate
┌─────────────────────────────────────────────────────────────────┐
│  // Generated HubSpot UI Extension                              │
│  import { Card, Input, Select, Button } from '@hubspot/ui-ext'; │
│                                                                 │
│  export function CustomerCard({ context }) {                    │
│    return (                                                     │
│      <Card>                                                     │
│        <Text>Customer Info</Text>                               │
│        <Input name="email" label="Email" />                     │
│        <Select name="status" options={...} />                   │
│        <Button onClick={...}>Save</Button>                      │
│      </Card>                                                    │
│    );                                                           │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

The designer reads the Fenestra spec to:
- **Populate the component palette** with available components
- **Block unavailable components** based on BYO policy
- **Validate designs** against platform constraints
- **Generate accurate code** with correct imports and SDK usage

### 2. Cross-Platform Portability

Design once, generate for multiple platforms:

```
┌──────────────────┐     ┌───────────────────────────────────────┐
│ Universal Design │────▶│ fenestra generate --platform hubspot  │
│   (Platform-     │     │ fenestra generate --platform canva    │
│    agnostic)     │     │ fenestra generate --platform slack    │
└──────────────────┘     └───────────────────────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
            ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
            │ HubSpot     │       │ Canva       │       │ Slack       │
            │ React Code  │       │ React Code  │       │ Block Kit   │
            │             │       │             │       │ JSON        │
            └─────────────┘       └─────────────┘       └─────────────┘
```

### 3. AI Agent Interoperability

MCP-compatible agents query UI capabilities:

```javascript
// Agent discovers what UI it can show
const capabilities = await fenestra.load('claude-desktop');

if (capabilities.templates.includes('form')) {
  // Show a form to collect user input
  await mcp.ui.showTemplate('form', {
    title: 'Enter Details',
    schema: { /* JSON Schema */ }
  });
}

if (capabilities.customUI.allowed) {
  // Fall back to custom iframe for complex UI
  await mcp.ui.openCustomUI('https://my-app.com/complex-form');
}
```

### 4. Frigg Module Integration

Frigg integration modules declare UI capabilities:

```javascript
// frigg-hubspot module
export const uiCapabilities = await fenestra.load('hubspot');

// Orchestrator knows this module can render:
// - CRM Cards (sidebar, record page)
// - UI Extensions (React components)
// - Timeline Events (JSON response)
```

### 5. Validation & Linting

Pre-flight validation before deployment:

```bash
$ fenestra validate ./my-hubspot-app --platform hubspot

✗ Error: CustomButton component not allowed
  └─ HubSpot policy: componentRequirement = required
  └─ Only @hubspot/ui-extensions components permitted

✗ Error: Using <div> directly
  └─ Must use <Box> or <Flex> from SDK

✓ 12 components validated
✗ 2 errors found
```

### 6. Documentation Generation

Auto-generate developer docs from specs:

```bash
$ fenestra docs --platform hubspot --output ./docs

Generated:
  - docs/components/Button.md
  - docs/components/Card.md
  - docs/sdk-reference.md
  - docs/policies.md
  - docs/extension-points.md
```

### 7. Migration Assistance

Help developers port between platforms:

```bash
$ fenestra migrate ./slack-app --from slack --to hubspot

Migration Report:
─────────────────
✓ section → Card (compatible)
✓ button → Button (compatible)
✗ overflow_menu → No equivalent (manual work needed)
✗ image → Image (props differ: url→src)

Estimated compatibility: 78%
```

---

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
