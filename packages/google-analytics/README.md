# Google Analytics API Module

This module provides integration with the Google Analytics API for the Frigg Framework.

## Description

Google Analytics provides detailed statistics and analytics for websites and mobile applications.

## Installation

```bash
npm install @friggframework/api-module-google-analytics
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-google-analytics');

// Initialize the API
const api = new Api({
    client_id: 'your-client-id',
    client_secret: 'your-client-secret',
    redirect_uri: 'your-redirect-uri'
});

// Get authorization URL
const authUrl = api.getAuthUri();
```

## Configuration

Set the following environment variables:

```
GOOGLE_ANALYTICS_CLIENT_ID=your_client_id
GOOGLE_ANALYTICS_CLIENT_SECRET=your_client_secret
GOOGLE_ANALYTICS_SCOPE=your_scope
```

## License

MIT
