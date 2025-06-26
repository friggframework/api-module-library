# Google Analytics 4 API Module

This module provides a v1-ready integration with Google Analytics 4 (GA4) using OAuth2 authentication.

## Installation

```bash
npm install @friggframework/api-module-google-analytics-4
```

## Features

- OAuth2 authentication with Google
- Access to GA4 reporting API
- Real-time analytics data
- Custom dimensions and metrics management
- Measurement Protocol support
- Audience management
- Conversion event tracking

## Authentication

Google Analytics 4 uses OAuth2 authentication with the following scopes:
- `https://www.googleapis.com/auth/analytics` - Full analytics access
- `https://www.googleapis.com/auth/analytics.readonly` - Read-only analytics access

## Quick Start

### Initialize the Integration

```javascript
const { Definition } = require('@friggframework/api-module-google-analytics-4');

const ga4 = new Definition({
    clientId: 'your-google-client-id',
    clientSecret: 'your-google-client-secret',
    redirectUri: 'your-redirect-uri'
});
```

### OAuth2 Flow

```javascript
// Get authorization URL
const authUrl = ga4.manager.getAuthorizationUrl();
// Redirect user to authUrl

// After user authorizes, exchange code for token
const tokens = await ga4.manager.exchangeCodeForToken(authorizationCode);
ga4.manager.accessToken = tokens.access_token;
ga4.manager.refreshToken = tokens.refresh_token;
```

## API Methods

### Analytics Reporting

#### Get Properties
```javascript
const properties = await ga4.getProperties();
```

#### Run Report
```javascript
const report = await ga4.runReport('properties/123456', {
    dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'activeUsers' }]
});
```

#### Run Real-time Report
```javascript
const realtimeData = await ga4.runRealtimeReport('properties/123456', {
    dimensions: [{ name: 'country' }],
    metrics: [{ name: 'activeUsers' }]
});
```

#### Batch Run Reports
```javascript
const batchResults = await ga4.batchRunReports('properties/123456', [
    {
        dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'sessions' }]
    },
    {
        dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'newUsers' }]
    }
]);
```

### Property Management

#### Get Property Metadata
```javascript
const metadata = await ga4.getMetadata('properties/123456');
```

#### Get Custom Dimensions
```javascript
const dimensions = await ga4.getCustomDimensions('properties/123456');
```

#### Get Custom Metrics
```javascript
const metrics = await ga4.getCustomMetrics('properties/123456');
```

### Data Streams

#### Get Data Streams
```javascript
const streams = await ga4.api.getDataStreams('properties/123456');
```

#### Send Measurement Protocol Event
```javascript
await ga4.api.sendMeasurementProtocolEvent('G-XXXXXXXXXX', 'api-secret', {
    client_id: 'client-123',
    events: [{
        name: 'purchase',
        params: {
            value: 99.99,
            currency: 'USD'
        }
    }]
});
```

### Audience Management

#### Get Audiences
```javascript
const audiences = await ga4.api.getAudiences('properties/123456');
```

#### Create Audience
```javascript
const audience = await ga4.api.createAudience('properties/123456', {
    displayName: 'High Value Users',
    description: 'Users with high engagement',
    membershipDurationDays: 30,
    filterClauses: [...]
});
```

### Conversion Events

#### Get Conversion Events
```javascript
const conversions = await ga4.api.getConversionEvents('properties/123456');
```

#### Mark Event as Conversion
```javascript
const conversion = await ga4.api.createConversionEvent('properties/123456', {
    eventName: 'purchase_completed'
});
```

## Report Request Examples

### Basic Report
```javascript
const basicReport = {
    dateRanges: [{ 
        startDate: '7daysAgo', 
        endDate: 'today' 
    }],
    dimensions: [{ name: 'city' }],
    metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' }
    ]
};
```

### Filtered Report
```javascript
const filteredReport = {
    dateRanges: [{ 
        startDate: '30daysAgo', 
        endDate: 'today' 
    }],
    dimensions: [{ name: 'pageTitle' }],
    metrics: [{ name: 'screenPageViews' }],
    dimensionFilter: {
        filter: {
            fieldName: 'country',
            stringFilter: {
                value: 'United States'
            }
        }
    }
};
```

### Pivot Report
```javascript
const pivotReport = {
    dateRanges: [{ 
        startDate: '7daysAgo', 
        endDate: 'today' 
    }],
    dimensions: [
        { name: 'country' },
        { name: 'deviceCategory' }
    ],
    metrics: [{ name: 'sessions' }],
    pivots: [{
        fieldNames: ['country'],
        limit: 5
    }]
};
```

## Error Handling

```javascript
try {
    const report = await ga4.runReport('properties/123456', reportRequest);
} catch (error) {
    if (error.code === 401) {
        // Token expired, refresh it
        const newTokens = await ga4.manager.refreshAccessToken(ga4.manager.refreshToken);
        ga4.manager.accessToken = newTokens.access_token;
    } else {
        console.error('GA4 API Error:', error);
    }
}
```

## Testing Authentication

```javascript
const testResult = await ga4.testAuth();
if (testResult.success) {
    console.log('Authentication successful!', testResult.data);
} else {
    console.error('Authentication failed:', testResult.message);
}
```

## Important Notes

1. **Property IDs**: GA4 property IDs follow the format `properties/123456`
2. **Date Ranges**: Can use relative dates like '7daysAgo', 'today', or specific dates 'YYYY-MM-DD'
3. **Quotas**: GA4 API has quotas for requests per property per day
4. **Sampling**: Large datasets may be sampled in reports
5. **Real-time Limitation**: Real-time reports have limited dimensions and metrics

## Resources

- [GA4 API Documentation](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [GA4 Dimensions & Metrics](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)
- [OAuth2 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes#analytics)
- [Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4)