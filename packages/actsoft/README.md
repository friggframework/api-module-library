# ActSoft API Module

This module provides integration with the ActSoft API for the Frigg Framework.

## Description

ActSoft provides workforce automation and task management solutions for mobile workers.

## Installation

```bash
npm install @friggframework/api-module-actsoft
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-actsoft');

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
ACTSOFT_CLIENT_ID=your_client_id
ACTSOFT_CLIENT_SECRET=your_client_secret
ACTSOFT_SCOPE=your_scope
```

## License

MIT
