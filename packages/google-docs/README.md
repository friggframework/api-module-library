# Google Docs API Module

This module provides integration with the Google Docs API for the Frigg Framework.

## Description

Google Docs is a web-based word processor that allows real-time collaboration and document editing.

## Installation

```bash
npm install @friggframework/api-module-google-docs
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-google-docs');

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
GOOGLE_DOCS_CLIENT_ID=your_client_id
GOOGLE_DOCS_CLIENT_SECRET=your_client_secret
GOOGLE_DOCS_SCOPE=your_scope
```

## License

MIT
