# Fenestra Specification Implementation Guide

This guide provides comprehensive instructions for implementing UI extensions using the Fenestra Specification across different platforms.

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Platform-Specific Implementation](#platform-specific-implementation)
4. [Common Patterns](#common-patterns)
5. [Security Best Practices](#security-best-practices)
6. [Testing and Validation](#testing-and-validation)
7. [Deployment Strategies](#deployment-strategies)
8. [Tools and SDKs](#tools-and-sdks)
9. [Migration Guide](#migration-guide)
10. [Troubleshooting](#troubleshooting)

## Overview

The Fenestra Specification provides a universal standard for describing UI extensions across platforms. This implementation guide helps developers:

- Create Fenestra-compliant extension specifications
- Implement extensions for specific platforms
- Migrate existing extensions to use Fenestra specs
- Build tools that work with Fenestra specifications

### Core Principles

1. **Platform Agnostic**: Write once, deploy to multiple platforms
2. **Developer Friendly**: Clear, readable specifications
3. **Extensible**: Support for platform-specific features
4. **Secure**: Built-in security best practices
5. **Interoperable**: Standard communication patterns

## Getting Started

### 1. Install Fenestra Tools

```bash
# Install the Fenestra CLI
npm install -g @fenestra/cli

# Verify installation
fenestra --version
```

### 2. Initialize a New Extension

```bash
# Create a new Fenestra project
fenestra init my-extension

# Generate platform-specific templates
fenestra generate --platform slack --type modal
fenestra generate --platform teams --type tab
fenestra generate --platform salesforce --type lwc
```

### 3. Basic Fenestra Specification

```yaml
fenestra: 1.0.0
info:
  title: My Extension
  version: 1.0.0
  description: A sample UI extension
extension:
  type: widget
  rendering:
    mode: iframe
    source:
      url: https://myapp.example/widget
```

### 4. Validate Your Specification

```bash
# Validate the specification
fenestra validate my-extension.fenestra.yaml

# Generate documentation
fenestra docs my-extension.fenestra.yaml
```

## Platform-Specific Implementation

### Slack Applications

#### Block Kit Schema Rendering

```yaml
extension:
  type: modal
  rendering:
    mode: schema
    schema:
      format: block-kit
      endpoint: https://api.myapp.example/slack/ui
      templates:
        - name: task-modal
          schema:
            type: modal
            title:
              type: plain_text
              text: Create Task
```

#### Implementation Steps

1. **Set up Slack App**:
   ```bash
   fenestra deploy --platform slack --app-token xoxb-your-token
   ```

2. **Handle Block Kit Interactions**:
   ```javascript
   app.action('button_click', async ({ ack, respond, body }) => {
     await ack();
     // Handle the interaction based on Fenestra spec
   });
   ```

3. **Generate Manifest**:
   ```bash
   fenestra export slack-manifest my-extension.fenestra.yaml
   ```

### Microsoft Teams

#### Adaptive Cards Implementation

```yaml
extension:
  type: tab
  rendering:
    mode: schema
    schema:
      format: adaptive-cards
      endpoint: https://api.myapp.example/teams/cards
```

#### Implementation Steps

1. **Create Teams App Package**:
   ```bash
   fenestra package teams my-extension.fenestra.yaml
   ```

2. **Handle Card Actions**:
   ```javascript
   server.post('/api/messages', (req, res) => {
     const activity = req.body;
     // Process based on Fenestra event definitions
   });
   ```

3. **Deploy to Teams**:
   ```bash
   fenestra deploy --platform teams --tenant-id your-tenant
   ```

### Salesforce Lightning

#### Lightning Web Component

```yaml
extension:
  type: panel
  rendering:
    mode: native
    sdk:
      type: lightning-web-component
      entry: c/myExtension
```

#### Implementation Steps

1. **Generate LWC Structure**:
   ```bash
   fenestra generate lwc my-extension.fenestra.yaml
   ```

2. **Implement Component**:
   ```javascript
   // myExtension.js
   import { LightningElement, api } from 'lwc';
   
   export default class MyExtension extends LightningElement {
     @api recordId;
     
     connectedCallback() {
       // Initialize based on Fenestra context
     }
   }
   ```

3. **Deploy to Salesforce**:
   ```bash
   sfdx force:source:deploy -p force-app/main/default/lwc/myExtension
   ```

### Zendesk Apps

#### ZAF Framework Integration

```yaml
extension:
  type: sidebar
  rendering:
    mode: iframe
    source:
      url: https://myapp.example/zendesk
      sandbox: [allow-scripts, allow-same-origin]
```

#### Implementation Steps

1. **Create Zendesk App**:
   ```bash
   fenestra scaffold zendesk my-extension.fenestra.yaml
   ```

2. **Initialize ZAF Client**:
   ```javascript
   const client = ZAFClient.init();
   client.invoke('resize', { width: '100%', height: '400px' });
   ```

3. **Package and Deploy**:
   ```bash
   zcli apps:package
   zcli apps:upload package.zip
   ```

### HubSpot CRM Cards

#### Custom CRM Card

```yaml
extension:
  type: embedded
  rendering:
    mode: component
    components:
      framework: react
      registry: https://cdn.myapp.example/components
```

#### Implementation Steps

1. **Create HubSpot App**:
   ```bash
   fenestra init hubspot my-extension.fenestra.yaml
   ```

2. **Implement React Component**:
   ```jsx
   const CRMCard = ({ contactId, properties }) => {
     const [data, setData] = useState(null);
     
     useEffect(() => {
       // Fetch data based on Fenestra context
     }, [contactId]);
     
     return <div>{/* Your card UI */}</div>;
   };
   ```

3. **Configure Webhook**:
   ```bash
   fenestra webhook create --platform hubspot \
     --url https://api.myapp.example/hubspot/webhook
   ```

## Common Patterns

### 1. PostMessage Communication

Many platforms use PostMessage for iframe communication:

```yaml
communication:
  channels:
    - type: postMessage
      config:
        origin: https://myapp.example
        protocol:
          format: json
          envelope:
            type: string
            payload: object
            timestamp: number
```

Implementation:
```javascript
// Parent frame
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://myapp.example') return;
  
  const { type, payload } = event.data;
  // Handle message based on Fenestra event definitions
});

// Child frame
parent.postMessage({
  type: 'data.update',
  payload: { key: 'value' },
  timestamp: Date.now()
}, '*');
```

### 2. OAuth 2.0 Authentication

Standard OAuth flow across platforms:

```yaml
security:
  - oauth2:
      flows:
        authorizationCode:
          authorizationUrl: https://platform.example/oauth/authorize
          tokenUrl: https://platform.example/oauth/token
          scopes:
            read: "Read access"
            write: "Write access"
```

### 3. Webhook Handling

Consistent webhook patterns:

```yaml
capabilities:
  compute:
    webhooks: true

triggers:
  - type: event
    config:
      webhooks:
        - data.updated
        - user.action
```

Implementation:
```javascript
app.post('/webhook', (req, res) => {
  const { type, payload } = req.body;
  
  switch (type) {
    case 'data.updated':
      // Handle data update
      break;
    case 'user.action':
      // Handle user action
      break;
  }
  
  res.status(200).send('OK');
});
```

### 4. Storage Management

Platform-agnostic storage patterns:

```yaml
capabilities:
  storage:
    platform: true
    local: true
    quota: "10MB"
```

Implementation:
```javascript
// Platform storage
await platformAPI.storage.set('key', value);
const value = await platformAPI.storage.get('key');

// Local storage fallback
if (typeof localStorage !== 'undefined') {
  localStorage.setItem('key', JSON.stringify(value));
  const value = JSON.parse(localStorage.getItem('key'));
}
```

## Security Best Practices

### 1. Content Security Policy

Define strict CSP headers:

```yaml
security:
  csp:
    defaultSrc: "'self'"
    scriptSrc: 
      - "'self'"
      - "https://trusted-cdn.example"
    connectSrc:
      - "'self'"
      - "https://api.myapp.example"
```

### 2. Origin Validation

Validate message origins:

```javascript
window.addEventListener('message', (event) => {
  const allowedOrigins = [
    'https://app.slack.com',
    'https://teams.microsoft.com',
    'https://zendesk.com'
  ];
  
  if (!allowedOrigins.some(origin => 
    event.origin.endsWith(origin))) {
    return;
  }
  
  // Process message
});
```

### 3. Token Management

Secure token handling:

```javascript
class TokenManager {
  constructor() {
    this.token = null;
    this.refreshToken = null;
    this.expiry = null;
  }
  
  async getToken() {
    if (this.isExpired()) {
      await this.refresh();
    }
    return this.token;
  }
  
  isExpired() {
    return Date.now() >= this.expiry;
  }
  
  async refresh() {
    // Refresh token logic
  }
}
```

### 4. Input Validation

Validate all inputs:

```javascript
const validateInput = (data, schema) => {
  // Use JSON Schema validation
  const valid = ajv.validate(schema, data);
  if (!valid) {
    throw new Error('Invalid input');
  }
  return data;
};
```

## Testing and Validation

### 1. Specification Validation

```bash
# Validate against Fenestra schema
fenestra validate my-extension.fenestra.yaml

# Check platform compatibility
fenestra check --platform slack my-extension.fenestra.yaml
fenestra check --platform teams my-extension.fenestra.yaml
```

### 2. Unit Testing

```javascript
// Test Fenestra communication
describe('Fenestra Communication', () => {
  test('should handle postMessage events', () => {
    const mockEvent = {
      origin: 'https://trusted-origin.com',
      data: { type: 'test', payload: {} }
    };
    
    const handler = new FenestraMessageHandler();
    expect(handler.process(mockEvent)).toBeTruthy();
  });
});
```

### 3. Integration Testing

```javascript
// Test platform integration
describe('Platform Integration', () => {
  test('should authenticate with platform', async () => {
    const auth = new PlatformAuth(fenestraSpec);
    const token = await auth.authenticate();
    expect(token).toBeDefined();
  });
});
```

### 4. End-to-End Testing

```javascript
// Using Playwright for E2E testing
test('should load extension in platform', async ({ page }) => {
  await page.goto('https://platform.example/app');
  await page.click('[data-testid="extension-trigger"]');
  
  const iframe = page.locator('iframe[src*="myapp.example"]');
  await expect(iframe).toBeVisible();
});
```

## Deployment Strategies

### 1. Multi-Platform Deployment

```bash
# Deploy to multiple platforms
fenestra deploy --platform slack,teams,salesforce

# Environment-specific deployment
fenestra deploy --env production --platform slack
fenestra deploy --env staging --platform teams
```

### 2. CI/CD Integration

```yaml
# .github/workflows/deploy.yml
name: Deploy Fenestra Extension
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Validate Fenestra Spec
        run: fenestra validate extension.fenestra.yaml
      
      - name: Deploy to Slack
        run: fenestra deploy --platform slack
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
      
      - name: Deploy to Teams
        run: fenestra deploy --platform teams
        env:
          TEAMS_APP_ID: ${{ secrets.TEAMS_APP_ID }}
```

### 3. Environment Management

```yaml
# environments/production.yaml
environment: production
platforms:
  slack:
    botToken: ${SLACK_BOT_TOKEN_PROD}
    signingSecret: ${SLACK_SIGNING_SECRET_PROD}
  teams:
    appId: ${TEAMS_APP_ID_PROD}
    tenantId: ${TEAMS_TENANT_ID_PROD}
```

### 4. Rollback Strategy

```bash
# Create deployment snapshot
fenestra snapshot create --name "v1.2.3"

# Rollback if needed
fenestra rollback --to "v1.2.2"

# List available snapshots
fenestra snapshot list
```

## Tools and SDKs

### 1. Fenestra CLI

```bash
# Install latest version
npm install -g @fenestra/cli@latest

# Available commands
fenestra init          # Initialize new project
fenestra validate      # Validate specification
fenestra generate      # Generate platform code
fenestra deploy        # Deploy to platforms
fenestra docs          # Generate documentation
fenestra test          # Run tests
```

### 2. JavaScript SDK

```javascript
import { Fenestra } from '@fenestra/sdk';

const extension = new Fenestra({
  spec: './extension.fenestra.yaml',
  platform: 'auto-detect'
});

// Initialize extension
await extension.init();

// Handle events
extension.on('data.update', (payload) => {
  console.log('Data updated:', payload);
});

// Send events
extension.emit('user.action', { action: 'click' });
```

### 3. React Components

```jsx
import { FenestraProvider, useFenestra } from '@fenestra/react';

function App() {
  return (
    <FenestraProvider spec={fenestraSpec}>
      <ExtensionContent />
    </FenestraProvider>
  );
}

function ExtensionContent() {
  const { context, emit, on } = useFenestra();
  
  useEffect(() => {
    on('data.refresh', handleDataRefresh);
  }, []);
  
  return <div>Extension content</div>;
}
```

### 4. Validation Tools

```javascript
import { validate } from '@fenestra/validator';

const result = validate(spec, {
  platform: 'slack',
  strict: true
});

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

## Migration Guide

### From Slack Bolt Framework

```javascript
// Before (Slack Bolt)
app.command('/task', async ({ ack, respond, command }) => {
  await ack();
  await respond({
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Create a new task'
        }
      }
    ]
  });
});

// After (Fenestra)
const extension = new Fenestra({
  spec: './slack-app.fenestra.yaml'
});

extension.on('slash.command', async (payload) => {
  if (payload.command === '/task') {
    await extension.respond('task-modal', payload.context);
  }
});
```

### From Teams Bot Framework

```javascript
// Before (Bot Framework)
this.onMessage(async (context, next) => {
  const card = CardFactory.adaptiveCard({
    type: 'AdaptiveCard',
    version: '1.4',
    body: [/*...*/]
  });
  
  await context.sendActivity({ attachments: [card] });
});

// After (Fenestra)
extension.on('message.received', async (payload) => {
  await extension.sendCard('welcome-card', payload.context);
});
```

### From Zendesk Apps Framework

```javascript
// Before (ZAF)
client.invoke('resize', { width: '100%', height: '400px' });
client.get('ticket.id').then(data => {
  // Handle ticket data
});

// After (Fenestra)
const extension = new Fenestra({
  spec: './zendesk-app.fenestra.yaml'
});

await extension.resize({ width: '100%', height: '400px' });
const ticketId = await extension.getContext('ticket.id');
```

## Troubleshooting

### Common Issues

#### 1. PostMessage Origin Errors

**Problem**: Messages not received due to origin mismatch
**Solution**:
```javascript
// Check allowed origins in Fenestra spec
const allowedOrigins = spec.communication.channels
  .find(c => c.type === 'postMessage')
  .config.allowedOrigins;

window.addEventListener('message', (event) => {
  if (!allowedOrigins.includes(event.origin)) {
    console.warn('Message from unauthorized origin:', event.origin);
    return;
  }
  // Process message
});
```

#### 2. OAuth Token Expiry

**Problem**: API calls failing due to expired tokens
**Solution**:
```javascript
class TokenManager {
  async makeAPICall(url, options = {}) {
    let token = await this.getToken();
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 401) {
      token = await this.refreshToken();
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`
        }
      });
    }
    
    return response;
  }
}
```

#### 3. CSP Violations

**Problem**: Content Security Policy blocking resources
**Solution**:
```yaml
# Update Fenestra spec CSP configuration
security:
  csp:
    scriptSrc:
      - "'self'"
      - "https://trusted-cdn.example"
    imgSrc:
      - "'self'"
      - "data:"
      - "https://cdn.example.com"
```

#### 4. Platform API Rate Limits

**Problem**: API calls being rate limited
**Solution**:
```javascript
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.requests = [];
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  async throttle() {
    const now = Date.now();
    this.requests = this.requests.filter(
      time => now - time < this.windowMs
    );
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(now);
  }
}
```

### Debug Mode

Enable debug logging:

```javascript
const extension = new Fenestra({
  spec: './extension.fenestra.yaml',
  debug: true
});

// Or via environment variable
process.env.FENESTRA_DEBUG = 'true';
```

### Support Resources

- **Documentation**: https://fenestra-spec.org/docs
- **Community Forum**: https://community.fenestra-spec.org
- **GitHub Issues**: https://github.com/fenestra-spec/spec/issues
- **Discord Server**: https://discord.gg/fenestra-spec

## Best Practices Summary

1. **Start Simple**: Begin with basic iframe or schema rendering
2. **Validate Early**: Use Fenestra CLI validation throughout development
3. **Security First**: Implement proper CSP, origin validation, and token management
4. **Test Across Platforms**: Validate your extension works on all target platforms
5. **Monitor Performance**: Track loading times and API response times
6. **Handle Errors Gracefully**: Implement proper error handling and fallbacks
7. **Document Everything**: Maintain clear documentation for your extensions
8. **Version Carefully**: Use semantic versioning and maintain backward compatibility

This implementation guide provides the foundation for building robust, cross-platform UI extensions using the Fenestra Specification. For specific platform details, refer to the platform-specific documentation and example implementations.