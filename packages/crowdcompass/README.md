# CrowdCompass API Module

This module provides integration with the CrowdCompass API for the Frigg Framework.

## Description

CrowdCompass provides event management and mobile app solutions for conferences and events.

## Installation

```bash
npm install @friggframework/api-module-crowdcompass
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-crowdcompass');

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
CROWDCOMPASS_CLIENT_ID=your_client_id
CROWDCOMPASS_CLIENT_SECRET=your_client_secret
CROWDCOMPASS_SCOPE=your_scope
```

## License

MIT
