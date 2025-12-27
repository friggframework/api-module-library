# Fenestra v0.1.0 Schema Additions - DRAFT

> Workshop document for adding 5 new capabilities to Fenestra v0.1.0

---

## 1. Declarative/JSON UI Patterns

For platforms like Slack, Google Workspace, Microsoft Teams that use JSON-based UI.

### Proposed Schema

```yaml
# Add to FenestraDocument root
declarativeSchemas:
  slack-blocks:
    name: Slack Block Kit
    version: "1.0"
    schemaUrl: https://api.slack.com/reference/block-kit/blocks
    documentation: https://api.slack.com/block-kit

    # How JSON responses are delivered
    delivery:
      method: httpResponse  # or 'webhook', 'websocket'
      contentType: application/json

    # Optional: Map JSON elements to Fenestra components for cross-platform tooling
    elementMappings:
      section:
        fenestraComponent: Card
        notes: "Container with text and optional accessory"
      button:
        fenestraComponent: Button
        notes: "Interactive button element"
      input:
        fenestraComponent: Input
        notes: "Text input field"
      divider:
        fenestraComponent: Divider
      image:
        fenestraComponent: Image

    # Validation/testing tools if available
    validator:
      tool: "Block Kit Builder"
      url: https://app.slack.com/block-kit-builder
```

### Example Usage

```yaml
# slack.fenestra.yaml
declarativeSchemas:
  block-kit:
    name: Slack Block Kit
    schemaUrl: https://api.slack.com/reference/block-kit/blocks
    elementMappings:
      section: { fenestraComponent: Card }
      button: { fenestraComponent: Button }

extensionPoints:
  - id: app-home
    extensionType: jsonResponse
    extensionTypeConfig:
      schema:
        format: block-kit  # References declarativeSchemas key
```

---

## 2. Mobile SDK Extensions

Extend the existing `SDK` object with mobile-specific fields.

### Proposed Schema Additions to SDK Object

```yaml
sdks:
  docusign-ios:
    name: DocuSign iOS SDK
    packageManager: cocoapods  # Add: cocoapods, carthage, swift-package-manager
    package: DocuSign

    # NEW: Platform specification
    platform: ios  # 'web' (default), 'ios', 'android', 'react-native', 'flutter'

    # NEW: Mobile-specific requirements
    mobile:
      minOsVersion: "13.0"
      targetOsVersion: "17.0"

      # Required device capabilities
      capabilities:
        - camera        # For document capture
        - biometrics    # For authentication

      # Required permissions
      permissions:
        - NSCameraUsageDescription: "Capture documents for signing"
        - NSFaceIDUsageDescription: "Authenticate with Face ID"

      # App store considerations
      appStore:
        reviewGuidelines: https://developer.apple.com/app-store/review/guidelines/
        requiredDisclosures:
          - dataCollection
          - thirdPartySDK

      # Framework/architecture
      architecture:
        - arm64
        - x86_64  # Simulator
      frameworks:
        - UIKit
        - SwiftUI  # Optional support
```

### Package Manager Enum Extension

```yaml
packageManager:
  enum:
    # Existing
    - npm
    - yarn
    - pip
    - maven
    - gradle
    - nuget
    - cargo
    - go
    - composer
    # NEW
    - cocoapods
    - carthage
    - swift-package-manager
    - gradle-android  # Distinguish from JVM gradle
```

---

## 3. Internationalization (i18n)

Platform-level i18n capabilities and developer requirements.

### Proposed Schema

```yaml
# Add to FenestraDocument root
i18n:
  # What the platform provides
  platformSupport:
    enabled: true

    # Languages the platform UI is available in
    availableLocales:
      - en
      - es
      - fr
      - de
      - ja
      - zh-CN
      - zh-TW

    # How locale is determined
    localeDetection:
      method: automatic  # 'automatic', 'manual', 'both'
      sources:
        - userPreference
        - browserLocale
        - accountSetting

    # RTL layout support
    rtlSupport:
      enabled: true
      languages: [ar, he, fa]

  # What platform provides for components
  componentTranslations:
    provided: true  # Platform translates built-in component labels
    scope: all      # 'all', 'partial', 'none'

  # What developers must handle
  developerRequirements:
    # How developers provide translations for their content
    translationMechanism:
      format: icu           # 'icu', 'i18next', 'gettext', 'json', 'custom'
      bundleLocation: embedded  # 'embedded', 'remote', 'platform-hosted'

    # Is localization required for marketplace?
    marketplaceRequirement:
      required: false
      minimumLocales: []    # e.g., ['en'] if at least English required

    # Locale-aware formatting
    formatting:
      dates: platform       # 'platform' (handled for you), 'developer'
      numbers: platform
      currencies: developer  # Developer must handle

  # Documentation
  documentation: https://developers.example.com/docs/i18n
```

### Example: HubSpot

```yaml
i18n:
  platformSupport:
    enabled: true
    availableLocales: [en, es, fr, de, ja, pt-BR]
    localeDetection:
      method: automatic
      sources: [userPreference, accountSetting]
    rtlSupport:
      enabled: false

  componentTranslations:
    provided: true
    scope: all

  developerRequirements:
    translationMechanism:
      format: custom
      bundleLocation: embedded
    marketplaceRequirement:
      required: false
    formatting:
      dates: platform
      numbers: platform
      currencies: platform
```

---

## 4. Compliance

Transparency about what platform handles and shared responsibilities.

### Proposed Schema

```yaml
# Add to FenestraDocument root
compliance:
  # Accessibility
  accessibility:
    # Platform's commitment
    platformStandard: WCAG 2.1 AA  # What the platform itself meets

    # What's required of extensions
    extensionRequirements:
      standard: WCAG 2.1 AA      # 'none', 'WCAG 2.0 A', 'WCAG 2.1 AA', etc.
      scope: marketplace         # 'all', 'marketplace', 'public', 'none'
      auditRequired: true        # For marketplace submission

    # What platform provides to help
    platformProvides:
      accessibleComponents: true   # Built-in components are accessible
      screenReaderTested: true
      keyboardNavigation: true
      focusManagement: true
      ariaAttributesHandled: true  # Platform handles ARIA on its components

    documentation: https://developers.example.com/accessibility

  # Security
  security:
    # Platform certifications
    platformCertifications:
      - SOC2 Type II
      - ISO 27001
      - HIPAA  # If applicable

    # What extensions must follow
    extensionRequirements:
      httpsOnly: true
      cspCompliance: true
      noInlineScripts: true
      noExternalScripts: false   # Can load external scripts?

      # Code review
      securityReview:
        required: true
        scope: marketplace

      # Data handling
      dataHandling:
        piiAllowed: true
        piiMustEncrypt: true
        dataRetentionPolicy: required  # Must declare retention

    documentation: https://developers.example.com/security

  # Privacy
  privacy:
    # Platform's data practices
    platformCompliance:
      gdpr: true
      ccpa: true

    # Data residency options
    dataResidency:
      available: true
      regions:
        - US
        - EU
        - AU

    # What extensions must handle
    extensionRequirements:
      privacyPolicyRequired: true
      consentManagement: platform  # 'platform' (handled), 'developer', 'both'
      dataProcessingAgreement: required  # For marketplace

    # User rights
    userRights:
      dataExportSupported: true
      dataDeletionSupported: true

    documentation: https://developers.example.com/privacy

  # Shared responsibility summary
  sharedResponsibility:
    platformHandles:
      - "Infrastructure security"
      - "Platform accessibility"
      - "User authentication"
      - "Data encryption at rest"

    developerHandles:
      - "Extension accessibility"
      - "Custom component ARIA"
      - "Extension data handling"
      - "Third-party integrations"

    documentation: https://developers.example.com/shared-responsibility
```

### Example: Simplified View

```yaml
# For a platform with minimal requirements
compliance:
  accessibility:
    platformStandard: WCAG 2.1 AA
    extensionRequirements:
      standard: none  # No requirement for extensions

  security:
    platformCertifications: [SOC2 Type II]
    extensionRequirements:
      httpsOnly: true
      securityReview:
        required: false

  privacy:
    platformCompliance:
      gdpr: true
    extensionRequirements:
      privacyPolicyRequired: false
```

---

## 5. AI Agent Interaction Mechanisms

Expand agent UI capabilities. Protocol-flexible but MCP-aware.

### Proposed Schema

```yaml
# Add to FenestraDocument root
agentInteraction:
  # Supported protocols
  protocols:
    mcp:
      supported: true
      version: "1.0"
      serverPackage: "@docusign/mcp-server"
      documentation: https://developers.example.com/mcp

    openai-functions:
      supported: true
      schemaFormat: openapi  # How functions are defined

    custom:
      supported: false

  # How agents can discover UI capabilities
  discovery:
    # Can agent query available UI templates?
    templateDiscovery: true

    # Can agent query available actions?
    actionDiscovery: true

    # Manifest/schema location
    manifest: https://api.example.com/.well-known/agent-ui.json

  # Context passing
  context:
    # What context can be passed to agent
    available:
      - conversationHistory
      - userIdentity
      - currentDocument
      - selectedItems

    # How context is serialized
    format: json

    # Privacy controls
    piiFiltering: automatic  # 'automatic', 'manual', 'none'

  # UI invocation
  uiInvocation:
    # How agent triggers UI
    methods:
      - templates      # Pre-defined UI templates
      - customIframe   # Custom HTML/iframe
      - deepLinks      # Open specific app screens

    # Can agent chain multiple UI interactions?
    chainingSupported: true

    # Timeout/cancellation
    interactionTimeout: 300  # seconds
    cancellationSupported: true

  # Events back to agent
  events:
    # Events the agent can receive
    supported:
      - formSubmitted
      - actionClicked
      - uiDismissed
      - errorOccurred

    # Delivery mechanism
    delivery: callback  # 'callback', 'webhook', 'polling'

  # Permissions
  permissions:
    # What agent can do
    canInvokeTemplates: true
    canOpenCustomUI: true
    canAccessUserData: true
    canPerformActions: true  # Actually do things, not just show UI

    # Approval flows
    userApprovalRequired:
      forActions: true       # User must approve actions
      forDataAccess: false   # Can access data without asking
```

### Example: DocuSign MCP

```yaml
agentInteraction:
  protocols:
    mcp:
      supported: true
      version: "1.0"
      serverPackage: "@docusign/mcp-server"

  discovery:
    templateDiscovery: true
    manifest: https://api.docusign.com/.well-known/mcp-manifest.json

  uiInvocation:
    methods: [templates, deepLinks]
    chainingSupported: true

  events:
    supported: [formSubmitted, documentSigned, uiDismissed]
    delivery: callback

  permissions:
    canInvokeTemplates: true
    canOpenCustomUI: false
    canPerformActions: true
    userApprovalRequired:
      forActions: true  # User must approve sending for signature
```

---

## Summary of Root-Level Additions

```yaml
# FenestraDocument root object additions
fenestra: "0.1.0"
info: { ... }
platform: { ... }
sdks: { ... }           # Extended with mobile fields
componentCatalog: { ... }
renderingEngines: { ... }
policies: { ... }
extensionPoints: { ... }

# NEW
declarativeSchemas: { ... }  # JSON UI patterns
i18n: { ... }                # Internationalization
compliance: { ... }          # Accessibility, security, privacy
agentInteraction: { ... }    # AI agent mechanisms
```

---

## Questions for You

1. **Declarative Schemas**: Is the `elementMappings` level of detail useful, or just noise?

2. **Mobile**: Should `permissions` be iOS/Android specific, or use a normalized list?

3. **i18n**: Is the developer requirements section clear enough about what's "your job" vs "platform's job"?

4. **Compliance**: Too detailed? I tried to make it practical for someone evaluating "can I build X on this platform?"

5. **Agent Interaction**: Is the MCP section sufficient, or do you want more detail on tool-to-UI binding?

Let me know and I'll finalize the spec additions!
