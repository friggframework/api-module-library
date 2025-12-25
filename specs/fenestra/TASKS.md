# Fenestra Spec Development Tasks

## Current Focus: Define the 4 Extension Types

### The Four Types

| Type | Description | Platform Provides | Developer Provides |
|------|-------------|-------------------|-------------------|
| **JSON Response** | Platform-sanctioned JSON payloads to API endpoints, renders pre-built components | Endpoint, schema, component renderer | JSON conforming to schema |
| **Coded Components** | SDK/UI Kit React components, sometimes BYO allowed | Component library, build tooling | React code using SDK |
| **Iframe** | Any HTML/JS/CSS at a URL | Iframe container, sometimes postMessage API | Full web application |
| **Embedded SDK** | ??? (needs clarification) | ??? | ??? |

### Cross-cutting: JavaScript SDK

When platforms expose a JS object to interact with host UI (e.g., `window.miro`, `window.Front`).

---

## Tasks

### Phase 1: Diagrams for Each Type
- [ ] Create diagram: JSON Response type (render flow)
- [ ] Create diagram: Coded Components type (render flow)
- [ ] Create diagram: Iframe type (render flow)
- [ ] Create diagram: Embedded SDK type (render flow)
- [ ] Create diagram: JS SDK interaction pattern

### Phase 2: Map Real Ecosystems
- [ ] Google Workspace Apps → JSON Response
- [ ] Asana → JSON Response
- [ ] Gorgias → JSON Response
- [ ] HubSpot Timeline Events → JSON Response
- [ ] Pipedrive Extensions → JSON Response
- [ ] Salesforce LWC → Coded Components
- [ ] HubSpot UI Extensions → Coded Components
- [ ] Zendesk → Coded Components
- [ ] Canva SDK Apps → Coded Components
- [ ] (Identify iframe examples)
- [ ] (Identify embedded SDK examples)

### Phase 3: Update Spec Schema
- [ ] Add `extensionType` enum to spec
- [ ] Define JSON Response schema details
- [ ] Define Coded Components schema details
- [ ] Define Iframe schema details
- [ ] Define Embedded SDK schema details
- [ ] Add JS SDK exposure schema

### Phase 4: Create Example Documents
- [ ] Example: JSON Response platform
- [ ] Example: Coded Components platform
- [ ] Example: Iframe platform
- [ ] Example: Hybrid platform (multiple types)

---

## Questions to Clarify

1. **Embedded SDK/Options** - Can you give an example of this type? Is this like Stripe.js or analytics SDKs that get embedded in the dev's own app?

2. **Hybrid platforms** - Some platforms offer multiple types (e.g., HubSpot has both JSON Timeline Events AND Coded UI Extensions). Should the spec handle this per-extension-point?

---

## Ecosystem Research List

### JSON Response Type
- Google Workspace Add-ons (Cards)
- Asana App Components
- Gorgias
- HubSpot Timeline Events (legacy)
- Pipedrive Extensions
- Slack Block Kit
- Microsoft Adaptive Cards
- Zoom Apps

### Coded Components Type
- Salesforce Lightning Web Components
- HubSpot UI Extensions
- Zendesk Apps Framework
- Canva Apps SDK
- Shopify App Bridge + Polaris

### Iframe Type
- Front Plugins
- Intercom Messenger Apps
- Many older integrations

### Embedded SDK Type
- (Examples needed)

### JS SDK Flavor (cross-cutting)
- Miro Web SDK (`miro` global)
- Front SDK (`Front` global)
- Canva SDK
- Figma Plugin API
