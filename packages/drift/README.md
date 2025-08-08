# Drift API Module

This module provides integration with the Drift API for the Frigg Framework.

## Description

Drift is a conversational marketing and sales platform that connects businesses with customers.

## Installation

```bash
npm install @friggframework/api-module-drift
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-drift');

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
DRIFT_CLIENT_ID=your_client_id
DRIFT_CLIENT_SECRET=your_client_secret
DRIFT_SCOPE=your_scope
```

## License

MIT
