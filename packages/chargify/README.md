# Chargify API Module

This module provides integration with the Chargify API for the Frigg Framework.

## Description

Chargify provides subscription billing and revenue management solutions.

## Installation

```bash
npm install @friggframework/api-module-chargify
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-chargify');

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
CHARGIFY_CLIENT_ID=your_client_id
CHARGIFY_CLIENT_SECRET=your_client_secret
CHARGIFY_SCOPE=your_scope
```

## License

MIT
