# Fenestra Platform Specification

## Version 1.0.0

The Fenestra Platform Specification defines how to describe the complete UI extensibility ecosystem of a platform, including all available extension types, communication methods, and integration patterns.

## Platform Specification Structure

A Fenestra Platform Specification describes:

1. **Platform Identity**: Basic platform information
2. **Extension Types**: All available UI extension types
3. **Communication Channels**: Available communication methods
4. **Authentication Methods**: Supported auth patterns
5. **Deployment Models**: How extensions are distributed
6. **SDK References**: Available tools and libraries

## Schema

### <a name="fenestraPlatformObject"></a>Fenestra Platform Object

This is the root object for a platform's UI extensibility specification.

##### Fixed Fields

Field Name | Type | Description
---|:---:|---
<a name="fenestraPlatformVersion"></a>fenestra | `string` | **REQUIRED**. Fenestra specification version (e.g., "1.0.0")
<a name="platformInfo"></a>platform | [Platform Info Object](#platformInfoObject) | **REQUIRED**. Information about the platform
<a name="extensionTypes"></a>extensionTypes | [Extension Types Object](#extensionTypesObject) | **REQUIRED**. All available extension types
<a name="communicationChannels"></a>communication | [Communication Channels Object](#communicationChannelsObject) | Available communication methods
<a name="authenticationMethods"></a>authentication | [Authentication Methods Object](#authenticationMethodsObject) | Supported authentication patterns
<a name="deploymentModels"></a>deployment | [Deployment Models Object](#deploymentModelsObject) | Distribution and hosting options
<a name="sdkReferences"></a>sdks | [SDK References Object](#sdkReferencesObject) | Available development tools

##### Fenestra Platform Object Example:

```yaml
fenestra: "1.0.0"
platform:
  name: HubSpot
  description: All varieties of available HubSpot UI extensibility
  version: "v3"
  baseUrl: "https://api.hubapi.com"
  
extensionTypes:
  crm-card:
    name: CRM Cards
    description: Custom cards displayed on CRM record pages
    contexts: [contact, company, deal, ticket]
    rendering:
      - iframe
      - react-component
    communication:
      - http-api
      - serverless-functions
  
  workflow-action:
    name: Workflow Actions
    description: Custom actions within HubSpot workflows
    contexts: [workflows]
    rendering:
      - serverless-function
    communication:
      - webhook-callback
      - platform-api
```

### <a name="platformInfoObject"></a>Platform Info Object

##### Fixed Fields

Field Name | Type | Description
---|:---:|---
<a name="platformName"></a>name | `string` | **REQUIRED**. Platform name
<a name="platformDescription"></a>description | `string` | **REQUIRED**. Platform description
<a name="platformVersion"></a>version | `string` | Platform API version
<a name="platformBaseUrl"></a>baseUrl | `string` | Base API URL
<a name="platformDocumentation"></a>documentation | `string` | Link to platform documentation
<a name="platformMarketplace"></a>marketplace | `string` | Link to platform marketplace
<a name="platformSupport"></a>support | `string` | Support documentation URL

### <a name="extensionTypesObject"></a>Extension Types Object

Maps extension type IDs to their definitions.

##### Patterned Fields

Field Pattern | Type | Description
---|:---:|---
<a name="extensionTypePattern"></a>^[a-zA-Z0-9-_]+$ | [Extension Type Definition](#extensionTypeDefinition) | Extension type definition

##### Extension Type Definition

Field Name | Type | Description
---|:---:|---
<a name="extensionTypeName"></a>name | `string` | **REQUIRED**. Human-readable name
<a name="extensionTypeDescription"></a>description | `string` | **REQUIRED**. Description of the extension type
<a name="extensionTypeContexts"></a>contexts | `[string]` | Where this extension type can be used
<a name="extensionTypeRendering"></a>rendering | `[string]` | Available rendering modes
<a name="extensionTypeCommunication"></a>communication | `[string]` | Available communication channels
<a name="extensionTypeCapabilities"></a>capabilities | `[string]` | Platform capabilities available
<a name="extensionTypeTriggers"></a>triggers | `[string]` | How the extension is triggered
<a name="extensionTypeExamples"></a>examples | `[object]` | Example implementations

## Extension Type Catalog

### Common Extension Types

#### embedded-widget
Small UI components embedded within existing interfaces
- **Contexts**: sidebar, panel, card, inline
- **Rendering**: iframe, native-component, schema-driven
- **Communication**: postmessage, platform-api

#### modal-dialog
Pop-up interfaces for complex interactions
- **Contexts**: overlay, dialog, drawer
- **Rendering**: iframe, schema-driven, native-component
- **Communication**: form-submission, platform-api

#### full-page-app
Complete application interfaces within platform tabs
- **Contexts**: tab, page, workspace
- **Rendering**: iframe, spa, native-component
- **Communication**: full-api-access, navigation-events

#### schema-driven-ui
Declarative UI definitions that platforms render
- **Contexts**: message, card, form, workflow
- **Rendering**: json-schema, adaptive-cards, block-kit
- **Communication**: action-callbacks, data-submission

#### contextual-action
Context-sensitive actions and commands
- **Contexts**: menu, toolbar, shortcut, command-palette
- **Rendering**: action-handler, command-processor
- **Communication**: command-execution, result-display

#### workflow-step
Custom steps in automated workflows
- **Contexts**: workflow, automation, pipeline
- **Rendering**: serverless-function, api-endpoint
- **Communication**: webhook-callback, event-driven

#### data-visualization
Custom charts, dashboards, and reports
- **Contexts**: dashboard, report, analytics
- **Rendering**: chart-library, data-grid, canvas
- **Communication**: data-query, real-time-updates

#### communication-interface
Chat bots, messaging interfaces, notification systems
- **Contexts**: chat, notification, messaging
- **Rendering**: conversation-ui, notification-banner
- **Communication**: real-time-messaging, webhook-events

#### content-template
Custom content types, templates, and editors
- **Contexts**: editor, template, asset-library
- **Rendering**: wysiwyg-editor, template-engine
- **Communication**: content-api, asset-management

#### auth-security
Custom authentication flows and security enhancements
- **Contexts**: login, security, compliance
- **Rendering**: auth-flow, security-prompt
- **Communication**: oauth-flow, token-exchange

## Platform Examples

### HubSpot Platform Specification

```yaml
fenestra: "1.0.0"
platform:
  name: HubSpot
  description: All varieties of available HubSpot UI extensibility, from CRM UI extensions to webhooks, timeline events, workflow steps, and marketing site templates
  version: "v3"
  baseUrl: "https://api.hubapi.com"
  documentation: "https://developers.hubspot.com"
  marketplace: "https://ecosystem.hubspot.com/marketplace"

extensionTypes:
  crm-card:
    name: CRM Cards
    description: Custom cards displayed on contact, company, deal, and ticket records
    contexts: [contact-record, company-record, deal-record, ticket-record]
    rendering: [iframe, react-component]
    communication: [http-api, serverless-functions, webhooks]
    capabilities: [crm-data-access, timeline-events, property-updates]
    triggers: [record-view, property-change]
    examples:
      - name: LinkedIn Profile Card
        description: Shows LinkedIn profile data on contact records
        renderingMode: react-component
        
  timeline-event:
    name: Timeline Events
    description: Custom events displayed on CRM record timelines
    contexts: [contact-timeline, company-timeline, deal-timeline]
    rendering: [event-template, custom-html]
    communication: [timeline-api, webhooks]
    capabilities: [timeline-write, event-creation]
    triggers: [api-call, webhook-event]
    
  workflow-action:
    name: Workflow Actions
    description: Custom actions that can be used in HubSpot workflows
    contexts: [workflows, sequences]
    rendering: [serverless-function]
    communication: [webhook-callback, platform-api]
    capabilities: [workflow-execution, data-manipulation]
    triggers: [workflow-step]
    
  ui-extension:
    name: UI Extensions
    description: Custom React components for settings and configuration pages
    contexts: [settings-page, configuration-panel]
    rendering: [react-component]
    communication: [platform-api, local-storage]
    capabilities: [settings-management, user-preferences]
    triggers: [page-load, user-navigation]
    
  website-template:
    name: Website Templates
    description: Custom templates for HubSpot CMS
    contexts: [cms-pages, landing-pages, email-templates]
    rendering: [hubl-template, html-css]
    communication: [cms-api, content-delivery]
    capabilities: [content-management, seo-optimization]
    triggers: [page-request, content-publish]

communication:
  http-api:
    description: RESTful API endpoints
    authentication: [oauth2, api-key]
    rateLimit: "100 requests per 10 seconds"
    
  serverless-functions:
    description: AWS Lambda-style functions
    runtime: [nodejs, python]
    triggers: [webhook, scheduled, api-call]
    
  webhooks:
    description: Event-driven HTTP callbacks
    events: [contact.creation, deal.update, workflow.completion]
    security: [hmac-signature]

authentication:
  oauth2:
    authorizationUrl: "https://app.hubspot.com/oauth/authorize"
    tokenUrl: "https://api.hubapi.com/oauth/v1/token"
    scopes: [crm.objects.contacts.read, crm.objects.deals.write, timeline]
    
  api-key:
    location: header
    parameter: "authorization"
    format: "Bearer {token}"

deployment:
  marketplace:
    name: HubSpot App Marketplace
    url: "https://ecosystem.hubspot.com/marketplace"
    reviewProcess: true
    
  private-app:
    name: Private Apps
    url: "https://developers.hubspot.com/docs/api/private-apps"
    selfService: true

sdks:
  javascript:
    name: HubSpot JavaScript SDK
    url: "https://www.npmjs.com/package/@hubspot/api-client"
    
  react-components:
    name: HubSpot UI Library
    url: "https://github.com/HubSpot/calling-extensions-sdk"
    
  cli:
    name: HubSpot CLI
    url: "https://www.npmjs.com/package/@hubspot/cli"
```

### Slack Platform Specification

```yaml
fenestra: "1.0.0"
platform:
  name: Slack
  description: All varieties of available Slack UI extensibility, from Bot interactions to Block Kit interfaces, Workflow steps, and App Home experiences
  version: "1.7"
  baseUrl: "https://slack.com/api"
  documentation: "https://api.slack.com"
  marketplace: "https://slack.com/apps"

extensionTypes:
  bot-interaction:
    name: Bot Interactions
    description: Conversational interfaces with users and channels
    contexts: [direct-message, channel, group-message]
    rendering: [text-response, block-kit-message]
    communication: [events-api, web-api, socket-mode]
    capabilities: [message-posting, file-sharing, user-lookup]
    triggers: [mention, direct-message, keyword]
    
  block-kit-ui:
    name: Block Kit Interfaces
    description: Rich interactive interfaces using Block Kit framework
    contexts: [message, modal, home-tab, workflow-step]
    rendering: [block-kit-schema]
    communication: [interactive-components, view-submissions]
    capabilities: [form-collection, data-display, user-interaction]
    triggers: [button-click, dropdown-select, modal-open]
    
  slash-command:
    name: Slash Commands
    description: Custom commands triggered by / in message input
    contexts: [message-composer]
    rendering: [ephemeral-response, in-channel-response]
    communication: [command-webhook, response-url]
    capabilities: [command-processing, response-posting]
    triggers: [slash-command-invocation]
    
  workflow-step:
    name: Workflow Steps
    description: Custom steps for Slack Workflow Builder
    contexts: [workflow-builder]
    rendering: [step-configuration, step-execution]
    communication: [step-webhook, completion-callback]
    capabilities: [data-transformation, external-integration]
    triggers: [workflow-execution]
    
  home-tab:
    name: App Home
    description: Dedicated space for app interaction in App Home
    contexts: [app-home]
    rendering: [block-kit-view]
    communication: [app-home-events, interactive-components]
    capabilities: [personalized-content, persistent-state]
    triggers: [home-tab-open, user-interaction]
    
  shortcuts:
    name: Shortcuts
    description: Quick actions accessible from message actions or global shortcuts
    contexts: [message-action, global-shortcut]
    rendering: [modal-dialog, direct-action]
    communication: [shortcut-webhook, interactive-response]
    capabilities: [context-access, quick-actions]
    triggers: [shortcut-invocation]

communication:
  events-api:
    description: Real-time event notifications
    delivery: [webhook, socket-mode]
    events: [message.channels, app_mention, team_join]
    
  web-api:
    description: RESTful API for Slack operations
    authentication: [bot-token, user-token]
    rateLimit: "tier-based limits"
    
  socket-mode:
    description: WebSocket connection for real-time events
    authentication: [app-token]
    benefits: [no-public-endpoint, real-time]

authentication:
  oauth2:
    authorizationUrl: "https://slack.com/oauth/v2/authorize"
    tokenUrl: "https://slack.com/api/oauth.v2.access"
    scopes: [chat:write, channels:read, users:read]
    
  bot-token:
    format: "xoxb-*"
    scope: "bot-level permissions"
    
  user-token:
    format: "xoxp-*"
    scope: "user-level permissions"

deployment:
  app-directory:
    name: Slack App Directory
    url: "https://slack.com/apps"
    reviewProcess: true
    distribution: public
    
  enterprise-grid:
    name: Enterprise Grid
    distribution: organization-wide
    adminApproval: required
    
  direct-install:
    name: Direct Install
    distribution: workspace-specific
    oauth: required

sdks:
  bolt-javascript:
    name: Bolt Framework for JavaScript
    url: "https://github.com/slackapi/bolt-js"
    
  bolt-python:
    name: Bolt Framework for Python
    url: "https://github.com/slackapi/bolt-python"
    
  block-kit-builder:
    name: Block Kit Builder
    url: "https://app.slack.com/block-kit-builder"
```

### Microsoft Teams Platform Specification

```yaml
fenestra: "1.0.0"
platform:
  name: Microsoft Teams
  description: All varieties of available Microsoft Teams UI extensibility, from Bot interactions to Adaptive Cards, Tabs, Meeting apps, and Message extensions
  version: "1.16"
  baseUrl: "https://graph.microsoft.com"
  documentation: "https://docs.microsoft.com/en-us/microsoftteams/platform/"
  marketplace: "https://appsource.microsoft.com/marketplace/apps?product=office%3Bteams"

extensionTypes:
  conversational-bot:
    name: Conversational Bots
    description: AI-powered bots for chat interactions
    contexts: [personal-chat, team-chat, channel, meeting-chat]
    rendering: [text-message, adaptive-card, rich-media]
    communication: [bot-framework, graph-api, activity-feed]
    capabilities: [proactive-messaging, file-handling, authentication]
    triggers: [mention, message, command]
    
  adaptive-card:
    name: Adaptive Cards
    description: Platform-agnostic UI framework for rich content
    contexts: [chat-message, task-module, notification]
    rendering: [adaptive-card-schema]
    communication: [card-actions, submit-action, invoke-action]
    capabilities: [form-input, data-display, user-interaction]
    triggers: [card-load, user-action, data-update]
    
  tab-application:
    name: Tab Applications
    description: Full web applications embedded as tabs
    contexts: [channel-tab, personal-tab, group-tab, meeting-tab]
    rendering: [iframe, spa]
    communication: [teams-sdk, graph-api, sso]
    capabilities: [deep-linking, authentication, context-access]
    triggers: [tab-load, navigation, context-change]
    
  message-extension:
    name: Message Extensions
    description: Search and action-based extensions for messaging
    contexts: [compose-box, message-action, command-box]
    rendering: [search-results, action-card, preview-card]
    communication: [bot-framework, adaptive-card-action]
    capabilities: [external-search, content-insertion, message-processing]
    triggers: [search-query, action-invocation]
    
  task-module:
    name: Task Modules
    description: Modal popup experiences
    contexts: [adaptive-card-action, tab-action, bot-action]
    rendering: [iframe, adaptive-card]
    communication: [task-module-callback, submit-handler]
    capabilities: [form-collection, workflow-execution, data-entry]
    triggers: [button-click, action-invocation]
    
  meeting-extension:
    name: Meeting Extensions
    description: Apps that enhance meeting experiences
    contexts: [pre-meeting, in-meeting, post-meeting]
    rendering: [meeting-tab, side-panel, stage-view]
    communication: [meeting-events, real-time-media]
    capabilities: [meeting-control, content-sharing, participant-interaction]
    triggers: [meeting-event, user-action]
    
  activity-feed:
    name: Activity Feed Cards
    description: Notifications in Teams activity feed
    contexts: [activity-feed, notification-center]
    rendering: [activity-card-template]
    communication: [graph-api, activity-notification]
    capabilities: [user-notification, action-buttons, deep-linking]
    triggers: [external-event, scheduled-task]

communication:
  bot-framework:
    description: Microsoft Bot Framework for conversational AI
    channels: [teams, webchat, directline]
    authentication: [app-id, app-password]
    
  graph-api:
    description: Microsoft Graph API for Teams data
    authentication: [azure-ad-oauth]
    permissions: [delegated, application]
    
  teams-sdk:
    description: Teams JavaScript SDK for tab applications
    capabilities: [context-access, authentication, deep-linking]
    
  webhook:
    description: Incoming webhook for external notifications
    authentication: [webhook-url]
    format: [adaptive-card, office-connector-card]

authentication:
  azure-ad-oauth:
    authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    scopes: [User.Read, Chat.ReadWrite, Team.ReadBasic.All]
    
  bot-authentication:
    appId: "Azure Bot Service App ID"
    appPassword: "Azure Bot Service Secret"
    
  sso:
    description: Single Sign-On for tab applications
    tokenExchange: true
    silentAuth: true

deployment:
  app-store:
    name: Microsoft Teams App Store
    url: "https://appsource.microsoft.com"
    reviewProcess: true
    
  sideloading:
    name: Sideloading
    scope: [personal, team, organization]
    adminPolicy: configurable
    
  admin-center:
    name: Teams Admin Center
    deployment: organization-wide
    policies: [app-permission, setup-policy]

sdks:
  teams-toolkit:
    name: Teams Toolkit
    platforms: [vscode, visual-studio, cli]
    url: "https://github.com/OfficeDev/TeamsFx"
    
  javascript-sdk:
    name: Teams JavaScript SDK
    url: "https://www.npmjs.com/package/@microsoft/teams-js"
    
  bot-framework-sdk:
    name: Bot Framework SDK
    languages: [csharp, javascript, python, java]
    url: "https://github.com/Microsoft/botframework-sdk"
```

This redesigned approach allows us to define platform-wide UI extensibility specifications that capture all the different types of extensions a platform supports, rather than individual extension specifications. Each platform would have its own comprehensive Fenestra Platform Specification.