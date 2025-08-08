# Cisco Webex API Module

This module provides integration with the Cisco Webex API for the Frigg Framework.

## Description

Cisco Webex provides video conferencing, online meetings, and team collaboration tools.

## Installation

```bash
npm install @friggframework/api-module-cisco-webex
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-cisco-webex');

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
CISCO_WEBEX_CLIENT_ID=your_client_id
CISCO_WEBEX_CLIENT_SECRET=your_client_secret
CISCO_WEBEX_SCOPE=your_scope
```

## License

MIT
