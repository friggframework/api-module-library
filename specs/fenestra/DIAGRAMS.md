# Fenestra Extension Types - Diagrams

This document illustrates the 4 broad extension types and how rendering flows from developer-provided assets to user-visible UI.

---

## Type 1: JSON Response

**Pattern**: Developer provides JSON conforming to platform schema → Platform renders pre-built components

**Examples**: Google Workspace Add-ons, Asana App Components, Slack Block Kit, Pipedrive, Gorgias

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PLATFORM SIDE                                  │
│                                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────────────┐│
│  │   User      │    │   Platform   │    │   Component Renderer            ││
│  │  Triggers   │───▶│   Calls      │    │   (Platform-owned)              ││
│  │   Action    │    │   Endpoint   │    │                                 ││
│  └─────────────┘    └──────┬───────┘    │  ┌─────┐ ┌─────┐ ┌─────┐       ││
│                            │            │  │Card │ │Form │ │List │ ...   ││
│                            │            │  └─────┘ └─────┘ └─────┘       ││
│                            ▼            └────────────────┬────────────────┘│
│                     ┌──────────────┐                     │                 │
│                     │   Validate   │                     │                 │
│                     │    JSON      │                     │                 │
│                     │   Schema     │                     │                 │
│                     └──────┬───────┘                     │                 │
│                            │                             │                 │
│                            ▼                             ▼                 │
│                     ┌──────────────────────────────────────┐               │
│                     │         Rendered UI in Platform       │               │
│                     └──────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
                             ▲
                             │ HTTP Response
                             │ (JSON Payload)
┌────────────────────────────┴────────────────────────────────────────────────┐
│                           DEVELOPER SIDE                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Developer's Server                               │   │
│  │                                                                      │   │
│  │   1. Receive request with context                                    │   │
│  │   2. Fetch/compute data                                              │   │
│  │   3. Return JSON matching platform schema                            │   │
│  │                                                                      │   │
│  │   Example Response:                                                  │   │
│  │   {                                                                  │   │
│  │     "type": "card",                                                  │   │
│  │     "title": "Customer Info",                                        │   │
│  │     "sections": [                                                    │   │
│  │       { "type": "keyValue", "key": "Name", "value": "John" }         │   │
│  │     ]                                                                │   │
│  │   }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Developer provides: Endpoint URL, JSON responses                           │
│  Developer does NOT provide: Any rendering code, components, or UI logic    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Characteristics**:
- No JS SDK typically needed
- Platform owns ALL rendering
- Developer only controls data and which component types to use
- Limited customization (can't create new component types)
- Fast to build, but constrained

---

## Type 2: Coded Components

**Pattern**: Developer writes React code using platform's UI Kit → Code runs in platform's runtime

**Examples**: Salesforce LWC, HubSpot UI Extensions, Zendesk Apps, Canva Apps SDK

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PLATFORM SIDE                                  │
│                                                                             │
│  ┌─────────────┐    ┌──────────────────────────────────────────────────┐   │
│  │   User      │    │              Platform Runtime                     │   │
│  │  Opens      │───▶│                                                   │   │
│  │  Extension  │    │   ┌────────────────────────────────────────────┐ │   │
│  └─────────────┘    │   │        Sandboxed Execution Environment     │ │   │
│                     │   │                                            │ │   │
│                     │   │   ┌──────────────────────────────────────┐ │ │   │
│                     │   │   │     Developer's React Code           │ │ │   │
│                     │   │   │                                      │ │ │   │
│                     │   │   │  import { Button, Card } from SDK    │ │ │   │
│                     │   │   │                                      │ │ │   │
│                     │   │   │  <Card>                              │ │ │   │
│                     │   │   │    <Button onClick={...}>            │ │ │   │
│                     │   │   │      Click me                        │ │ │   │
│                     │   │   │    </Button>                         │ │ │   │
│                     │   │   │  </Card>                             │ │ │   │
│                     │   │   └──────────────────────────────────────┘ │ │   │
│                     │   │                     │                      │ │   │
│                     │   │                     ▼                      │ │   │
│                     │   │   ┌──────────────────────────────────────┐ │ │   │
│                     │   │   │  Platform UI Kit Components          │ │ │   │
│                     │   │   │  (Button, Card, Input, Modal...)     │ │ │   │
│                     │   │   └──────────────────────────────────────┘ │ │   │
│                     │   └────────────────────────────────────────────┘ │   │
│                     │                                                   │   │
│                     │   ┌────────────────────────────────────────────┐ │   │
│                     │   │  Optional: JS SDK for host interaction     │ │   │
│                     │   │  hubspot.crm.actions.openModal()           │ │   │
│                     │   │  hubspot.ui.showToast()                    │ │   │
│                     │   └────────────────────────────────────────────┘ │   │
│                     └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                             ▲
                             │ Bundle (JS/CSS)
                             │
┌────────────────────────────┴────────────────────────────────────────────────┐
│                           DEVELOPER SIDE                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Developer's Codebase                             │   │
│  │                                                                      │   │
│  │   package.json:                                                      │   │
│  │     "@hubspot/ui-extensions": "^0.11.0"                              │   │
│  │                                                                      │   │
│  │   MyExtension.tsx:                                                   │   │
│  │     import { Button, Card, Text } from '@hubspot/ui-extensions';     │   │
│  │     import { hubspot } from '@hubspot/ui-extensions';                │   │
│  │                                                                      │   │
│  │     export function MyExtension({ context }) {                       │   │
│  │       return (                                                       │   │
│  │         <Card>                                                       │   │
│  │           <Text>Hello {context.user.name}</Text>                     │   │
│  │           <Button onClick={() => hubspot.ui.showToast('Done!')}>     │   │
│  │             Save                                                     │   │
│  │           </Button>                                                  │   │
│  │         </Card>                                                      │   │
│  │       );                                                             │   │
│  │     }                                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Developer provides: React code, component composition, business logic      │
│  Developer uses: Platform's component library (required or recommended)     │
│  Developer may NOT: Use arbitrary HTML/CSS (platform-dependent)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Characteristics**:
- Developer writes actual code (usually React/TypeScript)
- Platform provides component library (may be required or optional)
- Code runs in platform's sandboxed environment
- Often paired with JS SDK for host interactions
- More flexibility than JSON, but still constrained to SDK

**Variants**:
| Variant | BYO Components? | Example |
|---------|-----------------|---------|
| **Strict** | No - SDK only | HubSpot UI Extensions |
| **Recommended** | Yes, but SDK preferred | Canva Apps |
| **Flexible** | Yes - any React | Some Zendesk apps |

---

## Type 3: Iframe

**Pattern**: Developer provides full web app at a URL → Platform embeds in iframe

**Examples**: Front Plugins, Intercom Apps, legacy integrations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PLATFORM SIDE                                  │
│                                                                             │
│  ┌─────────────┐    ┌──────────────────────────────────────────────────┐   │
│  │   User      │    │              Platform UI                          │   │
│  │  Opens      │───▶│                                                   │   │
│  │  Extension  │    │   ┌────────────────────────────────────────────┐ │   │
│  └─────────────┘    │   │                                            │ │   │
│                     │   │   <iframe                                  │ │   │
│                     │   │     src="https://developer-app.com/ext"    │ │   │
│                     │   │     sandbox="allow-scripts allow-forms"    │ │   │
│                     │   │   >                                        │ │   │
│                     │   │   ┌──────────────────────────────────────┐ │ │   │
│                     │   │   │                                      │ │ │   │
│                     │   │   │     Developer's Web App              │ │ │   │
│                     │   │   │     (Full HTML/CSS/JS freedom)       │ │ │   │
│                     │   │   │                                      │ │ │   │
│                     │   │   └──────────────────────────────────────┘ │ │   │
│                     │   │   </iframe>                                │ │   │
│                     │   │                                            │ │   │
│                     │   └────────────────────────────────────────────┘ │   │
│                     │                         ▲                        │   │
│                     │                         │ postMessage            │   │
│                     │                         ▼                        │   │
│                     │   ┌────────────────────────────────────────────┐ │   │
│                     │   │  Optional: JS SDK (loaded in iframe)       │ │   │
│                     │   │  window.parent.postMessage(...)            │ │   │
│                     │   │  or SDK wrapper: Front.send('...')         │ │   │
│                     │   └────────────────────────────────────────────┘ │   │
│                     └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                             ▲
                             │ HTTP (HTML/JS/CSS)
                             │
┌────────────────────────────┴────────────────────────────────────────────────┐
│                           DEVELOPER SIDE                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              Developer's Hosted Web Application                      │   │
│  │                                                                      │   │
│  │   - Any framework: React, Vue, Svelte, vanilla JS, etc.              │   │
│  │   - Any styling: Tailwind, Bootstrap, custom CSS                     │   │
│  │   - Full control over rendering                                      │   │
│  │                                                                      │   │
│  │   Optional: Load platform's JS SDK for host interaction              │   │
│  │                                                                      │   │
│  │   <script src="https://platform.com/sdk.js"></script>                │   │
│  │   <script>                                                           │   │
│  │     Platform.on('context', (ctx) => {                                │   │
│  │       // Receive context from host                                   │   │
│  │     });                                                              │   │
│  │     Platform.send('action', { ... });                                │   │
│  │   </script>                                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Developer provides: Full web app (HTML, CSS, JS), hosting                  │
│  Developer controls: Everything about rendering and behavior                │
│  Platform provides: Iframe container, optional SDK for communication        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Characteristics**:
- Maximum flexibility for developer
- Platform has minimal control over UI
- Often uses postMessage for communication
- May or may not have a JS SDK
- Developer responsible for styling consistency
- Security via iframe sandbox attributes

---

## Type 4: Embedded SDK

**Pattern**: Developer embeds platform's SDK into their own application

**Examples**: Stripe Elements, Typeform Embed, Calendly, Analytics SDKs

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEVELOPER'S APPLICATION                              │
│                        (The developer IS the platform here)                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Developer's Web App                              │   │
│  │                                                                      │   │
│  │   <html>                                                             │   │
│  │     <body>                                                           │   │
│  │       <h1>My Checkout Page</h1>                                      │   │
│  │                                                                      │   │
│  │       <!-- Platform's SDK renders here -->                           │   │
│  │       ┌────────────────────────────────────────────────────────┐    │   │
│  │       │   <div id="stripe-elements">                           │    │   │
│  │       │   ┌──────────────────────────────────────────────────┐ │    │   │
│  │       │   │  ┌──────────────────┐ ┌──────────────────┐       │ │    │   │
│  │       │   │  │ Card Number      │ │ Expiry           │       │ │    │   │
│  │       │   │  │ 4242 4242 4242   │ │ 12/25            │       │ │    │   │
│  │       │   │  └──────────────────┘ └──────────────────┘       │ │    │   │
│  │       │   │  ┌──────────────────┐                            │ │    │   │
│  │       │   │  │ CVC              │        [Pay $99.00]        │ │    │   │
│  │       │   │  │ 123              │                            │ │    │   │
│  │       │   │  └──────────────────┘                            │ │    │   │
│  │       │   └──────────────────────────────────────────────────┘ │    │   │
│  │       │   </div>                                               │    │   │
│  │       │   (Stripe Elements - platform-rendered, secure)        │    │   │
│  │       └────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │       <footer>My app footer</footer>                                 │   │
│  │     </body>                                                          │   │
│  │   </html>                                                            │   │
│  │                                                                      │   │
│  │   <script src="https://js.stripe.com/v3/"></script>                  │   │
│  │   <script>                                                           │   │
│  │     const stripe = Stripe('pk_...');                                 │   │
│  │     const elements = stripe.elements();                              │   │
│  │     const card = elements.create('card');                            │   │
│  │     card.mount('#stripe-elements');                                  │   │
│  │   </script>                                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Developer provides: Host application, mount point, configuration           │
│  Platform provides: SDK that renders secure/compliant UI components         │
└─────────────────────────────────────────────────────────────────────────────┘
                             │
                             │ SDK loaded from
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLATFORM SIDE                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   Platform's Embeddable SDK (e.g., Stripe.js)                        │   │
│  │                                                                      │   │
│  │   - Renders UI components in developer's page                        │   │
│  │   - Handles sensitive data (PCI compliance for payments)             │   │
│  │   - Provides JS API for developer interaction                        │   │
│  │   - May use iframes internally for security isolation                │   │
│  │                                                                      │   │
│  │   Developer calls:                                                   │   │
│  │     stripe.confirmPayment()                                          │   │
│  │     stripe.elements.create('card', options)                          │   │
│  │     element.on('change', callback)                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Characteristics**:
- **Inverted relationship**: Developer's app is the host, platform provides embedded component
- Platform maintains control over sensitive rendering (e.g., payment fields)
- Developer integrates via JS SDK with mount points
- Often for compliance/security (PCI, authentication)
- Examples: Stripe Elements, PayPal Buttons, Plaid Link, Auth0 Lock

**Note**: This is the "reverse" of the other types - here the developer is building the platform/app, and embedding someone else's UI component.

---

## Cross-Cutting: JavaScript SDK Interaction

Many extension types include a JS SDK for interacting with the host platform:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         JS SDK INTERACTION PATTERN                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Platform Host Window                             │   │
│  │                                                                      │   │
│  │   window.platformSDK = {                                             │   │
│  │                                                                      │   │
│  │     // Context                                                       │   │
│  │     context: {                                                       │   │
│  │       user: { id, name, email },                                     │   │
│  │       record: { id, type, properties },                              │   │
│  │       locale: 'en-US'                                                │   │
│  │     },                                                               │   │
│  │                                                                      │   │
│  │     // UI Actions                                                    │   │
│  │     ui: {                                                            │   │
│  │       showToast(message, type),                                      │   │
│  │       openModal(config),                                             │   │
│  │       closePanel()                                                   │   │
│  │     },                                                               │   │
│  │                                                                      │   │
│  │     // Data Actions                                                  │   │
│  │     data: {                                                          │   │
│  │       createRecord(type, data),                                      │   │
│  │       updateRecord(id, data),                                        │   │
│  │       query(type, filters)                                           │   │
│  │     },                                                               │   │
│  │                                                                      │   │
│  │     // Events                                                        │   │
│  │     on(event, callback),                                             │   │
│  │     off(event, callback)                                             │   │
│  │   };                                                                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Examples:                                                                  │
│    - Miro: window.miro.board.createShape(...)                               │
│    - Front: Front.on('conversation', callback)                              │
│    - Figma: figma.currentPage.selection                                     │
│    - Canva: canva.design.addNativeElement(...)                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**JS SDK should document**:
- Global object name (`window.miro`, `window.Front`, etc.)
- Available namespaces (ui, data, context, etc.)
- Method signatures and return types
- Event types and payloads
- Async patterns (Promises, callbacks)

---

## Summary Table

| Type | Who Renders? | Developer Provides | BYO Styling? | JS SDK? |
|------|--------------|-------------------|--------------|---------|
| **JSON Response** | Platform | JSON payloads | No | Rarely |
| **Coded Components** | Platform (from dev code) | React code + SDK components | Limited | Often |
| **Iframe** | Developer | Full web app | Yes | Optional |
| **Embedded SDK** | Platform (in dev's app) | Mount point + config | Limited | Required |
