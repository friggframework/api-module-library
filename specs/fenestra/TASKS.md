# Fenestra Spec Development Tasks

> **Note**: For detailed extension type descriptions, see [README.md](./README.md).
> For visual diagrams, see [DIAGRAMS.md](./DIAGRAMS.md).
> For platform research, see [ECOSYSTEM-MAPPING.md](./ECOSYSTEM-MAPPING.md).

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

## Research & Findings

See [ECOSYSTEM-MAPPING.md](./ECOSYSTEM-MAPPING.md) for detailed platform research.

**Key decisions made:**
- Hybrid platforms modeled at extension-point level (each point can have different type)
- Embedded SDK = platform SDK in developer's app (Stripe Elements, Plaid Link)
- Agent UI added as 5th type for MCP Apps pattern
