# Amplitude API Module

This module provides a v1-ready integration with Amplitude's product analytics platform using API Key and Secret Key authentication.

## Installation

```bash
npm install @friggframework/api-module-amplitude
```

## Features

- API Key and Secret Key authentication
- Event tracking and batch operations
- User identification and properties
- Group analytics
- Revenue tracking
- Data export capabilities
- Chart and dashboard analytics
- Cohort management
- GDPR compliance
- Annotations and releases

## Authentication

Amplitude uses API Key and Secret Key authentication:
- **API Key**: Public key for data ingestion (tracking events)
- **Secret Key**: Private key for data export and management APIs

### Finding Your Keys
1. Log in to your Amplitude project
2. Navigate to Settings → Projects
3. Select your project
4. Find API Key and Secret Key in the project settings

## Quick Start

### Initialize the Integration

```javascript
const { Definition } = require('@friggframework/api-module-amplitude');

const amplitude = new Definition({
    apiKey: 'your-api-key',
    secretKey: 'your-secret-key'
});
```

## API Methods

### Event Tracking

#### Track Single Event
```javascript
await amplitude.trackEvent({
    user_id: 'user-123',
    event_type: 'Button Clicked',
    event_properties: {
        button_name: 'signup',
        page: 'homepage'
    },
    user_properties: {
        plan: 'premium',
        signup_date: '2024-01-01'
    }
});
```

#### Track Multiple Events
```javascript
await amplitude.trackEvents([
    {
        user_id: 'user-123',
        event_type: 'Page Viewed',
        event_properties: { page: '/home' }
    },
    {
        user_id: 'user-123',
        event_type: 'Feature Used',
        event_properties: { feature: 'search' }
    }
]);
```

### User Management

#### Identify User
```javascript
await amplitude.identify({
    user_id: 'user-123',
    user_properties: {
        name: 'John Doe',
        email: 'john@example.com',
        plan: 'premium',
        company: 'Acme Corp'
    }
});
```

#### Set User Properties
```javascript
await amplitude.setUserProperties({
    user_id: 'user-123',
    properties: {
        last_login: new Date().toISOString(),
        total_purchases: 5
    }
});
```

### Group Analytics

#### Set Group Properties
```javascript
await amplitude.setGroupProperties({
    group_type: 'company',
    group_name: 'acme-corp',
    group_properties: {
        plan: 'enterprise',
        employees: 500,
        industry: 'Technology'
    }
});
```

### Revenue Tracking

#### Track Revenue Event
```javascript
await amplitude.trackRevenue({
    user_id: 'user-123',
    revenue: 99.99,
    price: 99.99,
    quantity: 1,
    productId: 'SKU-123',
    revenueType: 'subscription',
    event_properties: {
        currency: 'USD',
        payment_method: 'credit_card'
    }
});
```

### Analytics Queries

#### Event Segmentation
```javascript
const segmentation = await amplitude.getEventSegmentation({
    events: [{
        event_type: 'Page Viewed'
    }],
    start: '20240101',
    end: '20240131',
    segment_by: 'country'
});
```

#### Funnel Analysis
```javascript
const funnel = await amplitude.getFunnelAnalysis({
    events: [
        { event_type: 'Sign Up Started' },
        { event_type: 'Sign Up Completed' },
        { event_type: 'First Purchase' }
    ],
    start: '20240101',
    end: '20240131'
});
```

#### Retention Analysis
```javascript
const retention = await amplitude.getRetentionAnalysis({
    start_event: {
        event_type: 'Sign Up'
    },
    return_event: {
        event_type: 'App Open'
    },
    start: '20240101',
    end: '20240131'
});
```

#### User Composition
```javascript
const composition = await amplitude.getUserComposition({
    start: '20240101',
    end: '20240131',
    property: 'plan'
});
```

### Data Export

#### Export Raw Data
```javascript
const exportData = await amplitude.exportData({
    start: '20240101T00',
    end: '20240101T23'
});
```

#### Get User Activity
```javascript
const activity = await amplitude.getUserActivity('user-123', {
    offset: 0,
    limit: 100
});
```

### User Search

#### Search for Users
```javascript
const users = await amplitude.searchUsers('john@example.com');
```

### Cohort Management

#### Get All Cohorts
```javascript
const cohorts = await amplitude.getCohorts();
```

#### Get Cohort Members
```javascript
const members = await amplitude.getCohortMembers('cohort-123', {
    props: 1,  // Include user properties
    limit: 1000
});
```

### Charts and Dashboards

#### Get Charts
```javascript
const charts = await amplitude.getCharts();
```

#### Get Chart Data
```javascript
const chartData = await amplitude.getChartData('chart-123');
```

### Annotations

#### Get Annotations
```javascript
const annotations = await amplitude.getAnnotations();
```

#### Create Annotation
```javascript
const annotation = await amplitude.createAnnotation({
    date: '2024-01-15',
    label: 'Feature Launch',
    details: 'Launched new dashboard feature'
});
```

### GDPR Compliance

#### Delete User Data
```javascript
const deletion = await amplitude.deleteUserData({
    user_ids: ['user-123', 'user-456'],
    requester: 'privacy@company.com'
});
```

## Advanced Event Tracking

### With Device Information
```javascript
await amplitude.trackEvent({
    user_id: 'user-123',
    device_id: 'device-abc',
    event_type: 'App Opened',
    platform: 'iOS',
    os_name: 'ios',
    os_version: '15.0',
    device_brand: 'Apple',
    device_manufacturer: 'Apple',
    device_model: 'iPhone 13',
    carrier: 'Verizon',
    country: 'United States',
    region: 'California',
    city: 'San Francisco',
    language: 'en-US'
});
```

### With Location
```javascript
await amplitude.trackEvent({
    user_id: 'user-123',
    event_type: 'Store Visit',
    location_lat: 37.7749,
    location_lng: -122.4194,
    ip: '192.168.1.1'
});
```

### With Session Tracking
```javascript
await amplitude.trackEvent({
    user_id: 'user-123',
    event_type: 'Session Start',
    session_id: Date.now(),
    event_id: 1,
    insert_id: 'unique-insert-id'
});
```

## Error Handling

```javascript
try {
    await amplitude.trackEvent({
        user_id: 'user-123',
        event_type: 'Test Event'
    });
} catch (error) {
    if (error.status === 400) {
        console.error('Invalid event data:', error.message);
    } else if (error.status === 401) {
        console.error('Invalid API keys');
    } else if (error.status === 429) {
        console.error('Rate limit exceeded');
    } else {
        console.error('Amplitude API Error:', error);
    }
}
```

## Testing Authentication

```javascript
const testResult = await amplitude.testAuth();
if (testResult.success) {
    console.log('Authentication successful!');
} else {
    console.error('Authentication failed:', testResult.message);
}
```

## Best Practices

1. **Always include user_id or device_id**: At least one identifier is required
2. **Use consistent event naming**: Follow a naming convention like "Noun Verb"
3. **Track revenue accurately**: Include all revenue fields for proper attribution
4. **Batch events when possible**: Reduce API calls for better performance
5. **Include relevant properties**: Add context that helps with analysis
6. **Use groups for B2B**: Track company-level metrics with group properties

## Rate Limits

- **Event Upload**: 1000 events per second per device
- **Batch Size**: Maximum 1000 events per batch
- **Export API**: 4 concurrent requests
- **Dashboard API**: 360 requests per hour

## Event Properties Best Practices

Common event properties to include:
```javascript
{
    // Product events
    product_id: 'SKU-123',
    product_name: 'Running Shoes',
    product_category: 'Footwear',
    price: 99.99,
    currency: 'USD',
    
    // User context
    user_type: 'premium',
    ab_test_group: 'variant_a',
    
    // Technical context
    app_version: '2.1.0',
    sdk_version: '1.0.0',
    
    // Business context
    promotion_id: 'SUMMER2024',
    referrer: 'google'
}
```

## Resources

- [Amplitude Documentation](https://www.docs.developers.amplitude.com/)
- [HTTP API V2 Reference](https://www.docs.developers.amplitude.com/analytics/apis/http-v2-api/)
- [Export API Reference](https://www.docs.developers.amplitude.com/analytics/apis/export-api/)
- [Dashboard REST API](https://www.docs.developers.amplitude.com/analytics/apis/dashboard-rest-api/)
- [Best Practices](https://help.amplitude.com/hc/en-us/articles/115001643283)