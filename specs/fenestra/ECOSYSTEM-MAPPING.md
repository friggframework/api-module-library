# Fenestra Ecosystem Mapping

This document maps real-world platforms to the 5 extension types defined in the Fenestra specification.

---

## Type 1: JSON Response

Platform renders pre-built components from JSON payloads returned by developer's endpoint.

| Platform | JSON Format | Components | Timeout | JS SDK | Docs |
|----------|-------------|------------|---------|--------|------|
| **Google Workspace** | `google.apps.card.v1` | 15+ widgets | Not specified | No (server-side) | [Link](https://developers.google.com/workspace/add-ons/concepts/card-interfaces) |
| **Asana** | OpenAPI-based | Modal Forms, Lookups, Widgets | 10s | No | [Link](https://developers.asana.com/docs/app-components) |
| **Gorgias** | Custom JSON | 5+ element types | ~10s | No | [Link](https://developers.gorgias.com/docs/create-integrations-and-widgets-programmatically) |
| **Pipedrive** | JSON Schema | Panels, Modals | 10s | Optional (for custom UI) | [Link](https://pipedrive.readme.io/docs/app-extensions-json-panels) |
| **Slack Block Kit** | Custom JSON | 8 blocks, 10+ elements | Not specified | No | [Link](https://docs.slack.dev/block-kit/) |
| **MS Adaptive Cards** | Platform-agnostic JSON | 25+ elements | Varies | Yes (rendering) | [Link](https://adaptivecards.io/) |

### Detailed Breakdown

#### Google Workspace Add-ons
```yaml
platform: Google Workspace
type: jsonResponse
schema:
  format: google.apps.card.v1
  version: draft-07
  encoding: UTF-8
endpoint:
  method: POST
  contextProvided:
    - commonEventObject
    - authorizationEventObject
    - hostAppContext (gmail/drive/calendar)
components:
  - TextParagraph
  - TextInput
  - Button / ButtonList
  - SelectionInput (max 100 items)
  - DateTimePicker
  - DecoratedText
  - Divider
  - Grid
  - Image / Icon
limits:
  maxWidgets: 100
```

#### Slack Block Kit
```yaml
platform: Slack
type: jsonResponse
schema:
  format: custom
  structure: Array of blocks with type field
endpoint:
  method: POST
  encoding: application/x-www-form-urlencoded
  payloadTypes:
    - block_actions
    - view_submission
    - view_closed
    - shortcut
components:
  blocks:
    - section
    - header
    - actions
    - input
    - context
    - divider
    - rich_text
    - image
    - file
  elements:
    - button
    - select / multi_select
    - text_input
    - datepicker / timepicker
    - checkboxes / radio_buttons
    - overflow
limits:
  blocksPerMessage: 50
  blocksPerModal: 100
```

#### Microsoft Adaptive Cards
```yaml
platform: Microsoft Teams / Outlook / Windows
type: jsonResponse
schema:
  format: AdaptiveCard
  version: "1.5" # Teams, 1.2 for mobile
  platformAgnostic: true
components:
  elements:
    - TextBlock
    - RichTextBlock
    - Image
    - Media
    - Container
    - ColumnSet / Column
    - FactSet
    - Table (v1.5+)
  inputs:
    - Input.Text
    - Input.Number
    - Input.Date
    - Input.Time
    - Input.Toggle
    - Input.ChoiceSet
  actions:
    - Action.OpenUrl
    - Action.Submit
    - Action.ShowCard
    - Action.ToggleVisibility
    - Action.Execute
jsSdk:
  package: "@microsoft/adaptivecards"
  purpose: Client-side rendering
```

---

## Type 2: Coded Components

Developer writes code (typically React) using platform's UI Kit. Code runs in platform's runtime.

| Platform | SDK Package | Framework | BYO Allowed? | Host API | Docs |
|----------|-------------|-----------|--------------|----------|------|
| **HubSpot** | `@hubspot/ui-extensions` | React | No | SDK imports | [Link](https://developers.hubspot.com/docs/platform/ui-extensions-sdk) |
| **Salesforce LWC** | `lwc`, `lightning-base-components` | LWC (Web Components) | Restricted | `lightning/*` imports | [Link](https://developer.salesforce.com/docs/platform/lwc/overview) |
| **Canva** | `@canva/app-ui-kit` | React 19 | Yes (constrained) | `@canva/platform` | [Link](https://www.canva.dev/docs/apps/app-ui-kit/) |
| **Shopify** | CDN (Web Components) | Web Components | Discouraged | `shopify` global | [Link](https://shopify.dev/docs/api/app-bridge) |
| **Monday.com** | `@vibe/core`, `monday-sdk-js` | Agnostic (React rec.) | Yes | `mondaySDK` | [Link](https://developer.monday.com/apps/docs/vibe-design-system) |

### Detailed Breakdown

#### HubSpot UI Extensions
```yaml
platform: HubSpot
type: codedComponents
sdk:
  package: "@hubspot/ui-extensions"
  framework: React
  runtime: Sandboxed iframe
componentRequirement:
  level: required
  byoAllowed: false
  rationale: "Sandboxed iframe prevents DOM access"
components:
  standard:
    - Button, ButtonRow
    - Text, Heading
    - Input, TextArea, Select
    - Card, Tile, Flex, Box
    - Modal, Panel
    - Table, DescriptionList
    - Alert, Badge, Tag
    - LoadingSpinner, ProgressBar
  crmData:
    package: "@hubspot/ui-extensions/crm"
    components:
      - CrmAssociationTable
      - CrmPropertyList
      - CrmActionButton
hostApi:
  methods:
    - runServerlessFunction()
    - actions from SDK
```

#### Salesforce Lightning Web Components
```yaml
platform: Salesforce
type: codedComponents
sdk:
  package: lwc
  componentLibrary: lightning-base-components
  framework: LWC (Web Components based)
componentRequirement:
  level: required
  byoAllowed: restricted
  constraints:
    - No third-party web components with npm dependencies
    - Can load JS libraries via Static Resources
    - Must use lwc:dom="manual" for external DOM manipulation
components:
  categories:
    - Input components
    - Navigation components
    - Table and tree components
    - Visual components
    - Form components
    - Button variants (base, neutral, brand, destructive, success)
hostApi:
  pattern: ES6 module imports
  namespaces:
    - lightning/platformResourceLoader
    - lightning/uiRecordApi
    - lightning/navigation
```

#### Canva Apps SDK
```yaml
platform: Canva
type: codedComponents
sdk:
  package: "@canva/app-ui-kit"
  platformSdk: "@canva/platform"
  framework: React 19
componentRequirement:
  level: recommended
  byoAllowed: true
  constraints:
    - Must wrap in AppUiProvider
    - Should use design tokens for consistency
    - Public apps: strongly recommended for design guidelines
    - Team apps: optional but better UX
components:
  - Button, LinkButton
  - Rows, Text, Title
  - Select (with multi-select)
  - AudioCard, ImageCard
designTokens:
  formats:
    - JavaScript variables
    - CSS variables
    - React props
```

---

## Type 3: Iframe

Developer provides full web app at URL. Platform loads in iframe with optional SDK for communication.

| Platform | SDK Package | Global Object | Communication | Docs |
|----------|-------------|---------------|---------------|------|
| **Front** | `@frontapp/plugin-sdk` | `Front` | Observable pattern | [Link](https://dev.frontapp.com/docs/plugin-overview) |
| **Zendesk** | `zendesk_app_framework_sdk` | `ZAFClient` | get/set/invoke | [Link](https://developer.zendesk.com/api-reference/apps/apps-core-api/client_api/) |
| **Freshdesk** | `fresh_client.js` | `app` → `client` | Promise-based | [Link](https://developers.freshworks.com/docs/app-sdk/v2.3/freshdesk/) |
| **Intercom** | `@intercom/messenger-js-sdk` | `Intercom` | HTTP POST + Sheets | [Link](https://developers.intercom.com/docs/canvas-kit) |
| **Salesforce Canvas** | Canvas SDK | `Sfdc.canvas` | Signed requests | [Link](https://developer.salesforce.com/docs/atlas.en-us.platform_connect.meta/platform_connect/canvas_framework_using_sdk.htm) |
| **Figma** | `@figma/plugin-typings` | `figma` | postMessage | [Link](https://developers.figma.com/docs/plugins/) |

### Detailed Breakdown

#### Front Plugins
```yaml
platform: Front
type: iframe
extensionPoints:
  - sidebar
  - composer
sdk:
  package: "@frontapp/plugin-sdk"
  cdn: "https://dl.frontapp.com/libs/frontjs.min.js"
  globalObject: Front
communication:
  pattern: Observable
  contextTypes:
    - noConversation
    - singleConversation
    - multiConversations
  methods:
    - Front.contextUpdates (Observable)
    - context.listMessages()
    - context.createDraft()
    - context.fetchConversation()
styling:
  control: full
  platformRestrictions: none
```

#### Zendesk Apps
```yaml
platform: Zendesk
type: iframe
sdk:
  package: zendesk_app_framework_sdk
  cdn: "https://static.zdassets.com/zendesk_app_framework_sdk/2.0/zaf_sdk.min.js"
  globalObject: ZAFClient
communication:
  init: ZAFClient.init()
  methods:
    - client.get(path) # Read framework data
    - client.set(path, value) # Write framework data
    - client.invoke(method) # Run framework methods
    - client.request(options) # HTTP requests
    - client.on(event, handler) # Event listeners
componentRequirement:
  level: optional
  componentLibrary: "@zendeskgarden/*"
  byoAllowed: true
```

#### Figma Plugins
```yaml
platform: Figma
type: iframe
architecture:
  mainThread:
    - Accesses Figma scene
    - No browser APIs
    - Sandboxed
  uiIframe:
    - Accesses browser APIs
    - No Figma scene access
    - Full framework freedom
sdk:
  package: "@figma/plugin-typings"
  globalObject: figma
  uiMethods:
    - figma.showUI(html)
    - figma.ui.show() / hide() / close()
    - figma.ui.postMessage()
communication:
  pattern: postMessage between main thread and UI
componentRequirement:
  level: optional
  byoAllowed: true
  notes: "Community component libraries available"
```

---

## Type 4: Embedded SDK

Platform provides SDK that developer embeds in their own application. Platform renders secure UI components.

| Platform | SDK Package | Global Object | Purpose | Theming | Docs |
|----------|-------------|---------------|---------|---------|------|
| **Stripe Elements** | `@stripe/stripe-js` | `Stripe` | Payments | Appearance API | [Link](https://docs.stripe.com/payments/elements) |
| **Plaid Link** | `react-plaid-link` | `Plaid` | Bank linking | Dashboard config | [Link](https://plaid.com/docs/link/web/) |
| **PayPal Buttons** | CDN only | `paypal` | Payments | Style options | [Link](https://developer.paypal.com/sdk/js/reference/) |
| **Auth0 Lock** | `auth0-lock` | `Auth0Lock` | Authentication | Theme options | [Link](https://auth0.com/docs/libraries/lock) |
| **Calendly** | CDN only | `Calendly` | Scheduling | Color customization | [Link](https://help.calendly.com/hc/en-us/articles/31618265722775) |
| **Typeform** | `@typeform/embed` | `tf` | Forms | Size/behavior | [Link](https://www.typeform.com/developers/embed/) |

### Detailed Breakdown

#### Stripe Elements
```yaml
platform: Stripe
type: embeddedSdk
purpose: PCI-compliant payment collection
sdk:
  package: "@stripe/stripe-js"
  reactPackage: "@stripe/react-stripe-js"
  cdn: "https://js.stripe.com/v3/" # Must load from CDN
  globalObject: Stripe
methods:
  - loadStripe(publishableKey)
  - stripe.elements(options)
  - elements.create(type, options)
  - element.mount(selector)
  - stripe.confirmPayment(options)
communication:
  pattern: callbacks + promises
  events:
    - element.on('change', handler)
    - element.on('ready', handler)
    - element.on('focus', handler)
theming:
  system: Appearance API
  prebuiltThemes:
    - default
    - stripe
    - night
    - flat
  variables:
    - colorPrimary
    - colorBackground
    - fontFamily
    - borderRadius
  rules: CSS-like selectors
```

#### Plaid Link
```yaml
platform: Plaid
type: embeddedSdk
purpose: Bank account linking
sdk:
  package: react-plaid-link
  cdn: "https://cdn.plaid.com/link/v2/stable/link-initialize.js"
  globalObject: Plaid
methods:
  - Plaid.create(config)
  - handler.open()
  - handler.exit()
  - handler.destroy()
communication:
  pattern: callbacks
  events:
    - onSuccess(public_token, metadata)
    - onExit(err, metadata)
    - onEvent(eventName, metadata)
  eventTypes:
    - OPEN
    - TRANSITION_VIEW
    - ERROR
    - EXIT
    - HANDOFF
theming:
  location: Dashboard
  options:
    - Color schemes
    - Text strings
    - Overlay customization
```

#### Typeform Embed
```yaml
platform: Typeform
type: embeddedSdk
purpose: Embeddable forms and surveys
sdk:
  package: "@typeform/embed"
  reactPackage: "@typeform/embed-react"
  cdn: "https://embed.typeform.com/next/embed.js"
  globalObject: tf
embedTypes:
  - createWidget() # Inline
  - createPopup() # Modal
  - createSlider() # Slide-in
  - createSidetab() # Side button
methods:
  - Returns { open, close, toggle, refresh }
communication:
  pattern: callbacks
  events:
    - onReady({ formId, isClosed })
    - onStarted({ formId, responseId })
    - onQuestionChanged({ formId, ref })
    - onHeightChanged({ formId, ref, height })
    - onSubmit({ formId, responseId })
theming:
  options:
    - width / height (CSS units)
    - hideHeaders
    - autoClose (ms)
    - autoResize
  sidetab:
    - Full color/dimension customization
```

---

## Cross-Cutting: JavaScript SDK Patterns

Many platforms expose a global object for host interaction:

| Platform | Global Object | Namespaces | Async Pattern |
|----------|---------------|------------|---------------|
| Miro | `miro` | `miro.board`, `miro.ui` | Promises |
| Figma | `figma` | `figma.ui`, `figma.viewport`, `figma.clientStorage` | Sync + postMessage |
| Front | `Front` | `Front.contextUpdates` | Observable |
| Zendesk | `ZAFClient` | `client.get/set/invoke` | Promises |
| Canva | (imported) | `@canva/platform` | Imports |
| HubSpot | (imported) | `@hubspot/ui-extensions` | Imports |
| Stripe | `Stripe` | `stripe.elements` | Promises |
| PayPal | `paypal` | `paypal.Buttons`, `paypal.CardFields` | Callbacks |

### Common SDK Capabilities

```yaml
jsSdkCapabilities:
  context:
    description: "Access current state/environment"
    examples:
      - user info (id, name, email)
      - current record/object
      - locale/timezone
      - permissions/scopes

  uiActions:
    description: "Trigger platform UI elements"
    examples:
      - showToast(message)
      - openModal(config)
      - resize(dimensions)
      - closePanel()

  dataActions:
    description: "CRUD operations on platform data"
    examples:
      - createRecord(type, data)
      - updateRecord(id, data)
      - query(type, filters)
      - deleteRecord(id)

  events:
    description: "Subscribe to platform events"
    patterns:
      - sdk.on(event, callback)
      - sdk.off(event, callback)
      - Observable streams
```

---

## Hybrid Platforms

Some platforms support multiple extension types:

| Platform | Types Supported | Notes |
|----------|-----------------|-------|
| **Pipedrive** | JSON + Iframe | JSON for simple panels, iframe for custom UI |
| **HubSpot** | JSON (Timeline) + Coded | Timeline Events = JSON, UI Extensions = React |
| **Salesforce** | LWC + Canvas (iframe) | LWC for Lightning, Canvas for legacy/external |
| **Zendesk** | Coded + Iframe | Can use Garden components or full custom UI |
| **Intercom** | JSON (Canvas Kit) + Iframe (Sheets) | Canvas Kit for Messenger cards, Sheets for complex UI |

---

## Workflow & Automation Platforms

Integration/automation platforms with their own UI extension models.

| Platform | Types Supported | UI Definition | Developer Provides | Docs |
|----------|-----------------|---------------|-------------------|------|
| **Zapier** | JSON + Coded | Field defs + Interfaces | Field schemas, triggers | [Link](https://docs.zapier.com/) |
| **Make.com** | JSON (RPC) | Parameter specs | Module config, RPC endpoints | [Link](https://developers.make.com/) |
| **Power Automate** | JSON (OpenAPI + Adaptive Cards) | OpenAPI 2.0 + Card JSON | API spec, card definitions | [Link](https://learn.microsoft.com/en-us/connectors/) |
| **NetSuite** | JSON + Coded (SuiteScript + SPAs) | Point-click + SuiteScript API + JSX | Code or config | [Link](https://docs.oracle.com/en/cloud/saas/netsuite/) |

### Detailed Breakdown

#### Zapier Apps
```yaml
platform: Zapier
type: hybrid (jsonResponse + codedComponents)
approaches:
  platformUI:
    type: jsonResponse
    description: "JSON field definitions for triggers/actions"
    fieldTypes:
      - text, email, url, password
      - dropdown (static/dynamic)
      - checkbox, radio, toggle
      - date/datetime, code
    dynamicFields: true (via hidden triggers)

  interfaces:
    type: codedComponents
    description: "No-code component builder for custom pages"
    components:
      - Form, Table, Kanban
      - Button, Layout
      - Media, Rich Text, Embed

sdk:
  package: "@zapier/platform-sdk" # Optional, for CLI
  globalObject: none
  jsSdk: false # Platform controls rendering

constraints:
  - Input forms optional for triggers, required for actions
  - Dynamic fields limited in Platform UI (full support in CLI)
  - Custom styling not allowed
  - Interfaces components have predefined styling
```

#### Make.com (Integromat)
```yaml
platform: Make.com
type: jsonResponse
description: "RPC-driven parameter system for dynamic fields"

uiDefinition:
  format: Make parameter specification
  fieldTypes:
    - text (all text-based inputs)
    - select (static or RPC-generated)
    - search button (large datasets)
    - checkbox, radio, file

rpcSystem:
  description: "Remote Procedure Calls for runtime field generation"
  types:
    dynamicOptions: "Generates dropdown/search options from API"
    dynamicFields: "Fetches field definitions from server"
  output: "Array of { label, value } objects"
  nesting: true # RPCs can call other RPCs

sdk:
  package: none # REST/GraphQL to external services
  globalObject: none

constraints:
  - No npm packages; must use external API calls
  - Type conversion needed (Make uses "text" not "string")
  - Cannot build custom React components or iframe UIs
  - Field types limited to platform-supported types
```

#### Power Automate
```yaml
platform: Power Automate
type: hybrid (jsonResponse)
approaches:
  customConnectors:
    type: jsonResponse
    description: "OpenAPI 2.0 based connector definitions"
    format: OpenAPI 2.0 (Swagger)
    inputTypes:
      - All primitives (string, number, boolean, integer)
      - Array/object structures
      - Enums (dropdown options)
      - File upload/download
    maxFileSize: 1MB
    authentication: API Key, OAuth, Basic

  adaptiveCards:
    type: jsonResponse
    description: "Platform-agnostic card format"
    format: AdaptiveCard JSON
    version: "1.5" # Teams, 1.2 for mobile
    components:
      - TextBlock, RichTextBlock
      - Input.Text, Input.Number, Input.Date, Input.Time
      - Input.Toggle, Input.ChoiceSet
      - Container, ColumnSet, Table
      - Button actions (OpenUrl, Submit, ShowCard)

copilotStudio:
  type: agentUI
  description: "Ask with Adaptive Card nodes for AI interactions"

sdk:
  adaptiveCards: "@microsoft/adaptivecards"
  purpose: Client-side card rendering

constraints:
  - Connectors limited to OpenAPI 2.0 format
  - No custom code execution in connectors
  - Adaptive Cards: restricted component set, no arbitrary HTML/CSS
  - Security/compliance validation required for published connectors
```

#### NetSuite
```yaml
platform: NetSuite
type: hybrid (jsonResponse + codedComponents)
approaches:
  customization:
    type: jsonResponse
    description: "Point-and-click form customization"
    capabilities:
      - Field visibility/organization
      - Drag-and-drop UI
    codeRequired: false

  suiteScript:
    type: codedComponents
    description: "Server-side UI component rendering"
    framework: SuiteScript 2.x
    module: N/ui/serverWidget
    pageTypes:
      - Form
      - List
      - Assistant
    components:
      - Button, TextField, Textarea
      - Select (dropdown), Checkbox, Radio
      - Date/datetime, Fields with custom formatting
      - Sublist (data grid), Group/Tab organization
    rendering: Server-side to HTML

  spas:
    type: codedComponents
    description: "Modern JSX-based Single Page Applications (2025.1+)"
    framework: SuiteScript 2.1 + JSX
    uiFramework: UIF (User Interface Framework)
    components:
      - Grids, buttons, inputs, modals
      - Form handling, Layout components
    moduleSystem: ESM (ECMAScript Modules)
    tools: SuiteCloud Development Framework (SDF)

sdk:
  suiteScript: "N/ui/serverWidget, N/record"
  spas: "@netsuite/uif"
  devTools: SuiteCloud Developer Assistant (AI-powered)

constraints:
  - Customization limited to form layout/visibility
  - SuiteScript: Server-side rendering, client interaction via Client Scripts
  - SPAs require SuiteScript 2.1 (not backward compatible with 2.0)
  - Module system migration required (ESM for SPAs vs RequireJS for older code)
```

---

## Summary by Extension Type

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                            EXTENSION TYPE DISTRIBUTION                                 │
├───────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│  JSON RESPONSE      CODED COMPONENTS    IFRAME         EMBEDDED SDK    AGENT UI      │
│  ──────────────     ─────────────────   ──────         ────────────    ────────      │
│  • Google Workspace • HubSpot UI Ext    • Front        • Stripe        • MCP Apps    │
│  • Asana            • Salesforce LWC    • Zendesk      • Plaid         • Copilot     │
│  • Gorgias          • Canva             • Freshdesk    • PayPal          Studio      │
│  • Pipedrive        • Shopify           • Intercom     • Auth0                       │
│  • Slack Block Kit  • Monday.com        • Figma        • Calendly                    │
│  • Adaptive Cards   • Zendesk Garden    • Salesforce   • Typeform                    │
│  • Zapier (fields)  • Zapier Interfaces   Canvas                                     │
│  • Make.com (RPC)   • NetSuite SPAs                                                  │
│  • Power Automate   • NetSuite Script                                                │
│  • NetSuite Custom                                                                   │
│                                                                                       │
│  ════════════════════════════════════════════════════════════════════════════════   │
│  Platform renders   Platform runs       Developer app  Platform SDK    AI agent      │
│  from JSON          developer code      in iframe      in dev's app    drives UI     │
│                                                                                       │
└───────────────────────────────────────────────────────────────────────────────────────┘
```
