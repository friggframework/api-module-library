# DocVerify API Module

This module provides integration with the DocVerify API for the Frigg Framework.

## Description

DocVerify provides digital signature and document verification services.

## Installation

```bash
npm install @friggframework/api-module-docverify
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-docverify');

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
DOCVERIFY_CLIENT_ID=your_client_id
DOCVERIFY_CLIENT_SECRET=your_client_secret
DOCVERIFY_SCOPE=your_scope
```

## License

MIT
