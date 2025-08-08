# Mixpanel API Module

This module provides a v1-ready integration with Mixpanel's product analytics platform using Service Account authentication.

## Installation

```bash
npm install @friggframework/api-module-mixpanel
```

## Features

- Service Account authentication (recommended)
- Event tracking and batch operations
- User profile management
- Group analytics
- JQL (JSON Query Language) queries
- Funnel and retention analysis
- Data export capabilities
- Cohort management
- Annotations and insights

## Authentication

Mixpanel uses two types of authentication:
1. **Service Account** (recommended) - For server-side API calls
2. **Project Token** - For event tracking and client-side operations

### Service Account Setup
1. Go to your Mixpanel Organization Settings
2. Create a new Service Account
3. Save the username and secret securely
4. Grant appropriate project permissions

## Quick Start

### Initialize the Integration

```javascript
const { Definition } = require('@friggframework/api-module-mixpanel');

const mixpanel = new Definition({
    serviceAccountUsername: 'your-service-account-username',
    serviceAccountSecret: 'your-service-account-secret',
    projectToken: 'your-project-token'
});
```

## API Methods

### Event Tracking

#### Track Single Event
```javascript
await mixpanel.track({
    event: 'Purchase Completed',
    distinct_id: 'user-123',
    properties: {
        amount: 99.99,
        currency: 'USD',
        items: ['product-1', 'product-2']
    }
});
```

#### Track Batch Events
```javascript
await mixpanel.trackBatch([
    {
        event: 'Page View',
        distinct_id: 'user-123',
        properties: { page: '/home' }
    },
    {
        event: 'Button Click',
        distinct_id: 'user-123',
        properties: { button: 'signup' }
    }
]);
```

### User Profile Management

#### Update User Profile
```javascript
await mixpanel.updateProfile({
    distinct_id: 'user-123',
    properties: {
        $name: 'John Doe',
        $email: 'john@example.com',
        plan: 'premium',
        signup_date: '2024-01-01'
    }
});
```

#### Batch Update Profiles
```javascript
await mixpanel.updateProfilesBatch([
    {
        distinct_id: 'user-123',
        properties: { plan: 'premium' }
    },
    {
        distinct_id: 'user-456',
        properties: { plan: 'basic' }
    }
]);
```

### Group Analytics

#### Update Group Profile
```javascript
await mixpanel.updateGroup({
    group_key: 'company',
    group_id: 'company-123',
    properties: {
        name: 'Acme Corp',
        plan: 'enterprise',
        employees: 500
    }
});
```

### Analytics Queries

#### JQL Query
```javascript
const results = await mixpanel.queryJQL({
    params: {
        from_date: '2024-01-01',
        to_date: '2024-01-31',
        event_selectors: [{
            event: 'Purchase Completed'
        }]
    }
});
```

#### Funnel Analysis
```javascript
const funnel = await mixpanel.getFunnel({
    project_id: 123456,
    funnel_id: 789,
    from_date: '2024-01-01',
    to_date: '2024-01-31'
});
```

#### Retention Analysis
```javascript
const retention = await mixpanel.getRetention({
    project_id: 123456,
    from_date: '2024-01-01',
    to_date: '2024-01-31',
    event: 'Sign Up',
    born_event: 'Sign Up'
});
```

### Data Export

#### Export Events
```javascript
const events = await mixpanel.exportEvents({
    from_date: '2024-01-01',
    to_date: '2024-01-31',
    event: ['Purchase Completed', 'Sign Up']
});
```

#### Export People
```javascript
const people = await mixpanel.exportPeople({
    project_id: 123456,
    filter_by_cohort: { id: 456 }
});
```

### Project Management

#### List Projects
```javascript
const projects = await mixpanel.listProjects();
```

#### Get Project Details
```javascript
const project = await mixpanel.getProject(123456);
```

### Cohorts

#### Get Cohorts
```javascript
const cohorts = await mixpanel.getCohorts(123456);
```

#### Create Cohort
```javascript
const cohort = await mixpanel.createCohort(123456, {
    name: 'High Value Users',
    description: 'Users who spent over $100',
    filter: {
        filter: {
            selector: {
                property: 'total_spent',
                operator: '>',
                values: [100]
            }
        }
    }
});
```

### Annotations

#### Get Annotations
```javascript
const annotations = await mixpanel.getAnnotations({
    project_id: 123456,
    from_date: '2024-01-01',
    to_date: '2024-01-31'
});
```

#### Create Annotation
```javascript
const annotation = await mixpanel.createAnnotation({
    project_id: 123456,
    date: '2024-01-15',
    description: 'Launched new feature'
});
```

### Additional Analytics

#### Segmentation
```javascript
const segmentation = await mixpanel.api.getSegmentation({
    project_id: 123456,
    event: 'Purchase Completed',
    from_date: '2024-01-01',
    to_date: '2024-01-31',
    unit: 'day'
});
```

#### Top Events
```javascript
const topEvents = await mixpanel.api.getTopEvents({
    project_id: 123456,
    type: 'general'
});
```

#### Property Values
```javascript
const values = await mixpanel.api.getPropertyValues({
    project_id: 123456,
    event: 'Purchase Completed',
    property: 'product_category'
});
```

## Error Handling

```javascript
try {
    await mixpanel.track({
        event: 'Test Event',
        distinct_id: 'test-user'
    });
} catch (error) {
    if (error.status === 401) {
        console.error('Authentication failed - check credentials');
    } else if (error.status === 429) {
        console.error('Rate limit exceeded');
    } else {
        console.error('Mixpanel API Error:', error);
    }
}
```

## Testing Authentication

```javascript
const testResult = await mixpanel.testAuth();
if (testResult.success) {
    console.log('Authentication successful!', testResult.data);
} else {
    console.error('Authentication failed:', testResult.message);
}
```

## Best Practices

1. **Use Service Accounts** for server-side operations
2. **Batch Operations** when tracking multiple events to reduce API calls
3. **Set distinct_id** consistently for accurate user tracking
4. **Use Groups** for B2B analytics (companies, teams, etc.)
5. **Export Data** regularly for backups and advanced analysis

## Rate Limits

- Standard rate limits apply based on your Mixpanel plan
- Use batch endpoints to optimize API usage
- Implement exponential backoff for rate limit errors

## GDPR Compliance

Delete user data for GDPR compliance:
```javascript
await mixpanel.api.deleteUserData({
    project_id: 123456,
    distinct_ids: ['user-123', 'user-456'],
    compliance_type: 'gdpr'
});
```

## Resources

- [Mixpanel API Documentation](https://developer.mixpanel.com/reference)
- [Service Accounts Guide](https://developer.mixpanel.com/reference/service-accounts)
- [JQL Reference](https://developer.mixpanel.com/docs/jql-overview)
- [Event Tracking Guide](https://developer.mixpanel.com/docs/javascript)