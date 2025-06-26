# Coda API Module

This module provides integration with the Coda API for the Frigg Framework.

## Description

Coda is a collaborative workspace that brings documents, spreadsheets, and apps together.

## Installation

```bash
npm install @friggframework/api-module-coda
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-coda');

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
CODA_CLIENT_ID=your_client_id
CODA_CLIENT_SECRET=your_client_secret
CODA_SCOPE=your_scope
```

## License

MIT
