# Fenestra Spec Development Tasks

## Current Focus: Define the 4 Extension Types

### The Four Types

| Type | Description | Platform Provides | Developer Provides |
|------|-------------|-------------------|-------------------|
| **JSON Response** | Platform-sanctioned JSON payloads to API endpoints, renders pre-built components | Endpoint, schema, component renderer | JSON conforming to schema |
| **Coded Components** | SDK/UI Kit React components, sometimes BYO allowed | Component library, build tooling | React code using SDK |
| **Iframe** | Any HTML/JS/CSS at a URL | Iframe container, sometimes postMessage API | Full web application |
| **Embedded SDK** | Platform SDK embedded in developer's app for secure/compliant UI | SDK that renders in dev's page | Mount point, configuration, host app |

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

**Output**: [ECOSYSTEM-MAPPING.md](./ECOSYSTEM-MAPPING.md)

### Phase 3: Update Spec Schema
- [ ] Add `extensionType` enum to spec
- [ ] Define JSON Response schema details
- [ ] Define Coded Components schema details
- [ ] Define Iframe schema details
- [ ] Define Embedded SDK schema details
- [ ] Add JS SDK exposure schema

### Phase 4: Create Example Documents
- [ ] Example: JSON Response platform (Slack Block Kit)
- [ ] Example: Coded Components platform (already have HubSpot)
- [ ] Example: Iframe platform (Front)
- [ ] Example: Embedded SDK platform (Stripe)
- [ ] Example: Hybrid platform (Pipedrive or Zendesk)

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

---

## Questions Resolved

1. ~~**Embedded SDK/Options** - What is this type?~~
   **Answer**: Platform SDK embedded in developer's own app for secure UI (e.g., Stripe Elements, Plaid Link)

2. **Hybrid platforms** - How to handle?
   **Answer**: Model at extension-point level. Each extension point can have a different type.
