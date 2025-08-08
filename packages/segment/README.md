# Segment API Module

This module provides a v1-ready integration with Segment's customer data platform using Write Key authentication for server-side tracking.

## Installation

```bash
npm install @friggframework/api-module-segment
```

## Features

- Write Key authentication for server-side tracking
- All core tracking methods (identify, track, page, screen, group, alias)
- Batch operations for high-volume data
- Historical data import
- GDPR compliance with user deletion
- E-commerce event helpers
- Workspace management (with workspace token)

## Authentication

Segment uses Write Key authentication for the tracking API. The Write Key is specific to each source in your Segment workspace.

### Finding Your Write Key
1. Log in to your Segment workspace
2. Navigate to Sources
3. Select your source
4. Go to Settings → API Keys
5. Copy the Write Key

## Quick Start

### Initialize the Integration

```javascript
const { Definition } = require('@friggframework/api-module-segment');

const segment = new Definition({
    writeKey: 'your-write-key'
});
```

## API Methods

### Core Tracking Methods

#### Identify User
```javascript
await segment.identify({
    userId: 'user-123',
    traits: {
        name: 'John Doe',
        email: 'john@example.com',
        plan: 'premium',
        createdAt: '2024-01-01T00:00:00Z'
    }
});
```

#### Track Event
```javascript
await segment.track({
    userId: 'user-123',
    event: 'Item Purchased',
    properties: {
        item_id: 'SKU-123',
        price: 29.99,
        quantity: 2
    }
});
```

#### Page View
```javascript
await segment.page({
    userId: 'user-123',
    name: 'Product Page',
    category: 'Ecommerce',
    properties: {
        path: '/products/shoes',
        referrer: 'https://google.com',
        search: 'running shoes',
        title: 'Running Shoes - Store'
    }
});
```

#### Screen View (Mobile)
```javascript
await segment.screen({
    userId: 'user-123',
    name: 'Home Screen',
    properties: {
        variation: 'A'
    }
});
```

#### Group Association
```javascript
await segment.group({
    userId: 'user-123',
    groupId: 'company-456',
    traits: {
        name: 'Acme Corp',
        industry: 'Technology',
        employees: 500
    }
});
```

#### Alias User IDs
```javascript
await segment.alias({
    previousId: 'anonymous-789',
    userId: 'user-123'
});
```

### Batch Operations

#### Send Multiple Events
```javascript
await segment.batch([
    {
        type: 'identify',
        userId: 'user-123',
        traits: { plan: 'premium' }
    },
    {
        type: 'track',
        userId: 'user-123',
        event: 'Subscription Started',
        properties: { plan: 'premium', value: 99 }
    }
]);
```

### Historical Data Import

#### Import Past Events
```javascript
await segment.import([
    {
        type: 'track',
        userId: 'user-123',
        event: 'Sign Up',
        timestamp: '2023-01-01T00:00:00Z',
        properties: { source: 'organic' }
    },
    {
        type: 'track',
        userId: 'user-123',
        event: 'First Purchase',
        timestamp: '2023-01-15T00:00:00Z',
        properties: { value: 49.99 }
    }
]);
```

### Helper Methods

#### Identify User (Simplified)
```javascript
await segment.identifyUser('user-123', {
    name: 'John Doe',
    email: 'john@example.com'
});
```

#### Track Event (Simplified)
```javascript
await segment.trackEvent('user-123', 'Button Clicked', {
    button: 'signup',
    location: 'header'
});
```

#### Track Page View (Simplified)
```javascript
await segment.trackPage('user-123', 'Home Page', {
    path: '/',
    referrer: 'https://google.com'
});
```

### E-commerce Events

#### Order Completed
```javascript
await segment.trackOrderCompleted('user-123', {
    orderId: 'ORDER-456',
    total: 299.99,
    shipping: 10,
    tax: 25.50,
    discount: 20,
    coupon: 'SAVE20',
    products: [
        {
            product_id: 'SKU-123',
            name: 'Running Shoes',
            price: 149.99,
            quantity: 2
        }
    ]
});
```

#### Product Viewed
```javascript
await segment.trackProductViewed('user-123', {
    productId: 'SKU-123',
    name: 'Running Shoes',
    category: 'Footwear',
    brand: 'Nike',
    price: 149.99,
    currency: 'USD',
    url: 'https://store.com/products/running-shoes',
    imageUrl: 'https://store.com/images/shoes.jpg'
});
```

### Workspace Management (Requires Workspace Token)

#### Get Sources
```javascript
const sources = await segment.getSources('workspace-token');
```

#### Get Destinations
```javascript
const destinations = await segment.getDestinations('workspace-token');
```

#### Get Tracking Plan
```javascript
const trackingPlan = await segment.getTrackingPlan('workspace-token');
```

### GDPR Compliance

#### Delete User Data
```javascript
await segment.deleteUser({
    userId: 'user-123',
    regulation: 'GDPR'
}, 'workspace-token');
```

## Working with Context

Add context to any tracking call:
```javascript
await segment.track({
    userId: 'user-123',
    event: 'Purchase',
    properties: { value: 99.99 },
    context: {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        locale: 'en-US',
        timezone: 'America/New_York',
        app: {
            name: 'MyApp',
            version: '1.0.0'
        },
        device: {
            type: 'mobile',
            manufacturer: 'Apple',
            model: 'iPhone 13'
        }
    }
});
```

## Using Anonymous IDs

Track users before they sign up:
```javascript
// Before sign up
await segment.track({
    anonymousId: 'anonymous-abc-123',
    event: 'Product Viewed',
    properties: { product_id: 'SKU-123' }
});

// After sign up, link the IDs
await segment.alias({
    previousId: 'anonymous-abc-123',
    userId: 'user-123'
});
```

## Integrations Control

Control which destinations receive data:
```javascript
await segment.track({
    userId: 'user-123',
    event: 'Test Event',
    integrations: {
        'Google Analytics': false,  // Disable GA
        'Mixpanel': true,          // Ensure Mixpanel gets it
        'All': false,              // Disable all except specified
        'Amplitude': true          // Enable Amplitude
    }
});
```

## Error Handling

```javascript
try {
    await segment.track({
        userId: 'user-123',
        event: 'Purchase'
    });
} catch (error) {
    if (error.status === 400) {
        console.error('Invalid request:', error.message);
    } else if (error.status === 401) {
        console.error('Invalid write key');
    } else if (error.status === 429) {
        console.error('Rate limit exceeded');
    } else {
        console.error('Segment API Error:', error);
    }
}
```

## Batch Validation

```javascript
const batch = [
    { type: 'track', userId: 'user-1', event: 'Test' },
    { type: 'identify', userId: 'user-2', traits: { name: 'Jane' } }
];

const validation = segment.api.validateBatch(batch);
if (!validation.valid) {
    console.error('Batch validation errors:', validation.errors);
}
```

## Testing Authentication

```javascript
const testResult = await segment.testAuth();
if (testResult.success) {
    console.log('Authentication successful!');
} else {
    console.error('Authentication failed:', testResult.message);
}
```

## Best Practices

1. **Use userId when available**: Always prefer userId over anonymousId for logged-in users
2. **Batch for performance**: Use batch endpoint for multiple events (max 500 per batch)
3. **Include timestamps**: Especially important for historical imports
4. **Set context**: Include device, location, and app information when relevant
5. **Use semantic events**: Follow Segment's spec for e-commerce and standard events

## Rate Limits

- **Tracking API**: No hard rate limits, but respect reasonable usage
- **Batch size**: Maximum 500 messages per batch
- **Message size**: Maximum 32KB per message
- **Request size**: Maximum 500KB per request

## Segment Spec

This module follows the Segment Spec. Key specifications:
- **Common Fields**: userId, anonymousId, context, timestamp, integrations
- **E-commerce Events**: Order Completed, Product Added, Cart Viewed, etc.
- **B2B Events**: Account Created, Trial Started, Feature Used, etc.

## Resources

- [Segment Documentation](https://segment.com/docs/)
- [HTTP Tracking API](https://segment.com/docs/connections/sources/catalog/libraries/server/http-api/)
- [Segment Spec](https://segment.com/docs/connections/spec/)
- [Best Practices](https://segment.com/docs/protocols/tracking-plan/best-practices/)