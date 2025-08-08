# ClientSuccess API Module

This module provides integration with the ClientSuccess API for the Frigg Framework.

## Description

ClientSuccess is a customer success platform that helps businesses reduce churn and increase expansion.

## Installation

```bash
npm install @friggframework/api-module-clientsuccess
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-clientsuccess');

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
CLIENTSUCCESS_CLIENT_ID=your_client_id
CLIENTSUCCESS_CLIENT_SECRET=your_client_secret
CLIENTSUCCESS_SCOPE=your_scope
```

## License

MIT
