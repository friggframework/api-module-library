# Authentise API Module

This module provides integration with the Authentise API for the Frigg Framework.

## Description

Authentise provides 3D printing workflow and manufacturing execution system solutions.

## Installation

```bash
npm install @friggframework/api-module-authentise
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-authentise');

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
AUTHENTISE_CLIENT_ID=your_client_id
AUTHENTISE_CLIENT_SECRET=your_client_secret
AUTHENTISE_SCOPE=your_scope
```

## License

MIT
