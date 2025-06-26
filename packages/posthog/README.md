# PostHog API Module

This module provides a v1-ready integration with PostHog's open source product analytics platform using Personal API Key and Project API Key authentication.

## Installation

```bash
npm install @friggframework/api-module-posthog
```

## Features

- Personal API Key authentication for full API access
- Project API Key for event tracking
- Event capture and batch operations
- Person identification and management
- Feature flags
- Session recordings
- Insights and analytics
- Cohort management
- A/B testing experiments
- Open source with self-hosting option

## Authentication

PostHog uses two types of API keys:
- **Personal API Key**: Full API access with customizable scopes
- **Project API Key**: Write-only key for event tracking

### Finding Your Keys
1. **Personal API Key**: Go to Account settings → Personal API Keys
2. **Project API Key**: Go to Project settings → API Keys

## Quick Start

### Initialize the Integration

```javascript
const { Definition } = require('@friggframework/api-module-posthog');

const posthog = new Definition({
    personalApiKey: 'phx_your-personal-api-key',
    projectApiKey: 'phc_your-project-api-key',
    host: 'https://app.posthog.com' // Or your self-hosted URL
});
```

## API Methods

### Event Tracking

#### Capture Single Event
```javascript
await posthog.capture({
    distinctId: 'user-123',
    event: 'Button Clicked',
    properties: {
        button_name: 'signup',
        page: '/homepage',
        $browser: 'Chrome',
        $current_url: 'https://example.com/homepage'
    }
});
```

#### Batch Events
```javascript
await posthog.batch([
    {
        distinctId: 'user-123',
        event: 'Page Viewed',
        properties: { page: '/home' }
    },
    {
        distinctId: 'user-123',
        event: 'Video Played',
        properties: { video_id: 'intro-video' }
    }
]);
```

### Person Management

#### Identify Person
```javascript
await posthog.identify({
    distinctId: 'user-123',
    properties: {
        email: 'john@example.com',
        name: 'John Doe',
        plan: 'premium',
        company: 'Acme Corp'
    },
    setOnce: {
        created_at: '2024-01-01'
    }
});
```

#### Alias Person
```javascript
await posthog.alias({
    distinctId: 'user-123',
    alias: 'john@example.com'
});
```

#### Get Person
```javascript
const person = await posthog.getPerson('user-123');
```

#### Get Persons List
```javascript
const persons = await posthog.getPersons({
    search: 'john',
    properties: { plan: 'premium' },
    limit: 100
});
```

#### Update Person
```javascript
await posthog.updatePerson('user-123', {
    last_login: new Date().toISOString(),
    total_purchases: 5
});
```

#### Delete Person (GDPR)
```javascript
await posthog.deletePerson('user-123');
```

### Feature Flags

#### Get All Feature Flags
```javascript
const flags = await posthog.getFeatureFlags();
```

#### Get Specific Feature Flag
```javascript
const flag = await posthog.getFeatureFlag(123);
```

#### Create Feature Flag
```javascript
const flag = await posthog.createFeatureFlag({
    name: 'new-dashboard',
    key: 'new-dashboard-enabled',
    filters: {
        groups: [{
            properties: [{
                key: 'plan',
                type: 'person',
                value: ['premium'],
                operator: 'exact'
            }],
            rollout_percentage: 100
        }]
    },
    active: true
});
```

#### Evaluate Feature Flags for Person
```javascript
const flags = await posthog.evaluateFeatureFlags('user-123', {
    personProperties: {
        plan: 'premium'
    }
});
```

### Insights and Analytics

#### Get Insights
```javascript
const insights = await posthog.getInsights({
    saved: true,
    user: true,
    limit: 20
});
```

#### Get Specific Insight
```javascript
const insight = await posthog.getInsight(456);
```

#### Create Insight
```javascript
const insight = await posthog.createInsight({
    name: 'Daily Active Users',
    description: 'Track DAU over time',
    filters: {
        events: [{ id: '$pageview' }],
        display: 'ActionsLineGraph',
        interval: 'day',
        date_from: '-30d'
    },
    saved: true
});
```

### Cohorts

#### Get Cohorts
```javascript
const cohorts = await posthog.getCohorts();
```

#### Create Cohort
```javascript
const cohort = await posthog.createCohort({
    name: 'Power Users',
    description: 'Users with high engagement',
    filters: {
        properties: {
            type: 'AND',
            values: [{
                key: 'total_events',
                type: 'person',
                value: 100,
                operator: 'gt'
            }]
        }
    }
});
```

### Session Recordings

#### Get Session Recordings
```javascript
const recordings = await posthog.getSessionRecordings({
    date_from: '2024-01-01',
    date_to: '2024-01-31',
    person_id: 'user-123',
    limit: 20
});
```

#### Get Specific Recording
```javascript
const recording = await posthog.getSessionRecording('session-abc-123');
```

### Events and Properties

#### Get Events
```javascript
const events = await posthog.getEvents({
    event: '$pageview',
    person_id: 'user-123',
    after: '2024-01-01T00:00:00Z',
    limit: 100
});
```

#### Get Event Definitions
```javascript
const eventDefs = await posthog.getEventDefinitions();
```

#### Get Property Definitions
```javascript
const propDefs = await posthog.getPropertyDefinitions();
```

### Dashboards

#### Get Dashboards
```javascript
const dashboards = await posthog.getDashboards();
```

#### Get Specific Dashboard
```javascript
const dashboard = await posthog.getDashboard(789);
```

### Annotations

#### Get Annotations
```javascript
const annotations = await posthog.getAnnotations({
    after: '2024-01-01',
    before: '2024-01-31'
});
```

#### Create Annotation
```javascript
const annotation = await posthog.createAnnotation({
    content: 'Product launch',
    date_marker: '2024-01-15T00:00:00Z',
    scope: 'project'
});
```

### Experiments (A/B Testing)

#### Get Experiments
```javascript
const experiments = await posthog.api.getExperiments();
```

#### Create Experiment
```javascript
const experiment = await posthog.api.createExperiment({
    name: 'Homepage CTA Test',
    description: 'Testing different CTA buttons',
    feature_flag_key: 'homepage-cta-variant',
    start_date: '2024-02-01',
    end_date: '2024-02-28',
    variants: [
        { key: 'control', name: 'Control', rollout_percentage: 50 },
        { key: 'variant-a', name: 'Variant A', rollout_percentage: 50 }
    ]
});
```

### Actions

#### Get Actions
```javascript
const actions = await posthog.api.getActions();
```

#### Create Action
```javascript
const action = await posthog.api.createAction({
    name: 'Completed Signup',
    description: 'User completed the signup process',
    steps: [{
        event: '$pageview',
        properties: [{
            key: '$current_url',
            type: 'event',
            value: 'signup/complete',
            operator: 'contains'
        }]
    }]
});
```

## Advanced Event Properties

### Standard Properties
```javascript
await posthog.capture({
    distinctId: 'user-123',
    event: 'Purchase Completed',
    properties: {
        // PostHog standard properties
        $browser: 'Chrome',
        $browser_version: '96',
        $current_url: 'https://shop.com/checkout',
        $host: 'shop.com',
        $pathname: '/checkout',
        $screen_height: 1080,
        $screen_width: 1920,
        $referrer: 'https://google.com',
        $referring_domain: 'google.com',
        $device_type: 'Desktop',
        $ip: '192.168.1.1',
        
        // Custom properties
        order_id: 'ORD-123',
        total_amount: 299.99,
        items_count: 3
    }
});
```

### Super Properties (set once, sent with all events)
```javascript
await posthog.identify({
    distinctId: 'user-123',
    properties: {
        $set: {
            plan: 'premium',
            company_id: 'comp-456'
        }
    }
});
```

## Error Handling

```javascript
try {
    await posthog.capture({
        distinctId: 'user-123',
        event: 'Test Event'
    });
} catch (error) {
    if (error.status === 401) {
        console.error('Invalid API key');
    } else if (error.status === 429) {
        console.error('Rate limit exceeded');
    } else {
        console.error('PostHog API Error:', error);
    }
}
```

## Testing Authentication

```javascript
const testResult = await posthog.testAuth();
if (testResult.success) {
    console.log('Authentication successful!');
} else {
    console.error('Authentication failed:', testResult.message);
}
```

## Self-Hosting Configuration

If you're using self-hosted PostHog:
```javascript
const posthog = new Definition({
    personalApiKey: 'your-personal-key',
    projectApiKey: 'your-project-key',
    host: 'https://posthog.yourcompany.com'
});
```

## Best Practices

1. **Use distinct IDs consistently**: Ensure the same user has the same distinct ID across sessions
2. **Include standard properties**: PostHog can extract more insights with browser and device info
3. **Use feature flags**: Control feature rollouts without deploying code
4. **Set up actions**: Define key events as actions for easier analysis
5. **Use cohorts**: Segment users for targeted analysis and feature flags
6. **Enable session recording**: Understand user behavior with visual recordings

## Rate Limits

- **Event ingestion**: No hard limits, reasonable usage expected
- **API requests**: 600 requests per minute for Personal API Keys
- **Batch size**: Maximum 1000 events per batch
- **Event size**: Maximum 1MB per event

## Autocapture

PostHog supports autocapture when using their JavaScript library. This API module focuses on server-side tracking where you have full control over what events are sent.

## Resources

- [PostHog Documentation](https://posthog.com/docs)
- [API Reference](https://posthog.com/docs/api)
- [Event Tracking Guide](https://posthog.com/docs/getting-started/send-events)
- [Feature Flags Guide](https://posthog.com/docs/feature-flags)
- [Self-Hosting Guide](https://posthog.com/docs/self-host)