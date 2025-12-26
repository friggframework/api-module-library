# Fenestra Spec Development Tasks

## Current Focus: Define the 5 Extension Types

### The Five Types

| Type | Description | Platform Provides | Developer Provides |
|------|-------------|-------------------|-------------------|
| **JSON Response** | Platform-sanctioned JSON payloads to API endpoints, renders pre-built components | Endpoint, schema, component renderer | JSON conforming to schema |
| **Coded Components** | SDK/UI Kit React components, sometimes BYO allowed | Component library, build tooling | React code using SDK |
| **Iframe** | Any HTML/JS/CSS at a URL | Iframe container, sometimes postMessage API | Full web application |
| **Embedded SDK** | Platform SDK embedded in developer's app for secure/compliant UI | SDK that renders in dev's page | Mount point, configuration, host app |
| **Agent UI** | AI agent-driven UI with predeclared templates + custom iframe fallback | Template renderer, communication protocol | Template invocations, optional custom iframe |

### Cross-cutting: JavaScript SDK

When platforms expose a JS object to interact with host UI (e.g., `window.miro`, `window.Front`, `window.Stripe`).

---

## Tasks

### Phase 1: Diagrams for Each Type
- [x] Create diagram: JSON Response type (render flow)
- [x] Create diagram: Coded Components type (render flow)
- [x] Create diagram: Iframe type (render flow)
- [x] Create diagram: Embedded SDK type (render flow)
- [x] Create diagram: JS SDK interaction pattern
- [x] Create diagram: Agent UI type (render flow)

**Output**: [DIAGRAMS.md](./DIAGRAMS.md)

### Phase 2: Map Real Ecosystems
- [x] Google Workspace Apps → JSON Response
- [x] Asana → JSON Response
- [x] Gorgias → JSON Response
- [x] Pipedrive Extensions → JSON Response (hybrid)
- [x] Slack Block Kit → JSON Response
- [x] Microsoft Adaptive Cards → JSON Response
- [x] Salesforce LWC → Coded Components
- [x] HubSpot UI Extensions → Coded Components
- [x] Zendesk → Coded Components / Iframe (hybrid)
- [x] Canva SDK Apps → Coded Components
- [x] Shopify App Bridge → Coded Components
- [x] Monday.com → Coded Components
- [x] Front → Iframe
- [x] Figma → Iframe
- [x] Freshdesk → Iframe
- [x] Intercom → Iframe
- [x] Stripe Elements → Embedded SDK
- [x] Plaid Link → Embedded SDK
- [x] PayPal Buttons → Embedded SDK
- [x] Auth0 Lock → Embedded SDK
- [x] Calendly → Embedded SDK
- [x] Typeform → Embedded SDK
- [x] Zapier → JSON Response + Coded Components (hybrid) [Workflow]
- [x] Make.com → JSON Response (RPC-driven) [Workflow]
- [x] Power Automate → JSON Response (OpenAPI + Adaptive Cards) [Workflow]
- [x] NetSuite → JSON Response + Coded Components (hybrid) [ERP]

**Output**: [ECOSYSTEM-MAPPING.md](./ECOSYSTEM-MAPPING.md)

### Phase 3: Update Spec Schema
- [x] Add `extensionType` enum to spec
- [x] Define JSON Response schema details
- [x] Define Coded Components schema details
- [x] Define Iframe schema details
- [x] Define Embedded SDK schema details
- [x] Add JS SDK exposure schema
- [x] Define Agent UI schema details (AgentUIConfig, AgentUITemplate)

### Phase 4: Create Example Documents
- [ ] Example: JSON Response platform (Slack Block Kit)
- [x] Example: Coded Components platform (HubSpot)
- [ ] Example: Iframe platform (Front)
- [ ] Example: Embedded SDK platform (Stripe)
- [ ] Example: Hybrid platform (Pipedrive or Zendesk)
- [x] Example: Agent UI platform (MCP Apps)

---

## Key Findings from Research

### JSON Response Platforms
- Typically 10s timeout for endpoint responses
- No client-side JS SDK needed (purely server-side)
- Schema validation enforced by platform
- Limited customization (only predefined components)

### Coded Components Platforms
- React is dominant framework
- BYO policy varies: HubSpot (no), Canva (yes with constraints), Zendesk (yes)
- Often paired with JS SDK for host interaction
- Sandboxed execution (iframes or workers)

### Iframe Platforms
- Maximum developer flexibility
- Platform provides SDK for communication (postMessage wrapper)
- Security via sandbox attributes and CSP
- Developer responsible for styling consistency

### Embedded SDK Platforms
- Platform maintains control for security/compliance (PCI, etc.)
- Must load from platform CDN (cannot bundle)
- Theming options vary (Stripe: extensive, Plaid: limited)
- Callback/event-based communication

### Hybrid Platforms
- Pipedrive: JSON panels + iframe custom UI
- HubSpot: JSON Timeline Events + Coded UI Extensions
- Zendesk: Garden components (recommended) + any framework
- Salesforce: LWC + Canvas (iframe)
- Intercom: Canvas Kit (JSON) + Sheets (iframe)

### Agent UI Platforms (NEW)
- MCP Apps hosts: Pre-declared templates + custom iframe fallback
- Key characteristics:
  - AI agent drives the UI through structured invocations
  - Templates for common patterns (forms, confirmations, progress)
  - Custom iframe escape hatch for complex interactions
  - JSON-RPC communication protocol
  - JSON Forms for structured input collection

### Workflow/Automation Platforms (NEW)
- Zapier: JSON field definitions + Interfaces (no-code component builder)
- Make.com: RPC-driven parameter system (unique dynamic field pattern)
- Power Automate: OpenAPI 2.0 connectors + Adaptive Cards
- Key insight: All rely heavily on JSON-driven schemas
- No iframe mode: Unlike Figma/Front, these platforms maintain strict rendering control

### ERP Platforms (NEW)
- NetSuite: Point-click customization + SuiteScript + JSX SPAs (2025.1+)
- Unique characteristics:
  - Server-side UI rendering (SuiteScript 2.x)
  - Modern JSX/ESM approach (SuiteScript 2.1 SPAs)
  - AI-powered development assistant

---

## Questions Resolved

1. ~~**Embedded SDK/Options** - What is this type?~~
   **Answer**: Platform SDK embedded in developer's own app for secure UI (e.g., Stripe Elements, Plaid Link)

2. **Hybrid platforms** - How to handle?
   **Answer**: Model at extension-point level. Each extension point can have a different type.
