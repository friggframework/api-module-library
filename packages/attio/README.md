# @friggframework/api-module-attio

This module integrates Attio into the Frigg Framework, providing access to Attio's API functionality.

## Features

- OAuth2 authentication
- Access to Attio's API endpoints
- Support for objects, records, attributes, workspaces, and lists management
- Search functionality

## Installation

```bash
npm install @friggframework/api-module-attio
```

## Configuration

The module requires the following environment variables:

```env
ATTIO_CLIENT_ID=your_client_id
ATTIO_CLIENT_SECRET=your_client_secret
ATTIO_SCOPE=your_scopes
REDIRECT_URI=your_redirect_uri
```

## Usage

```javascript
const {Api, Definition} = require('@friggframework/api-module-attio');

// Initialize the API
const api = new Api({
    client_id: process.env.ATTIO_CLIENT_ID,
    client_secret: process.env.ATTIO_CLIENT_SECRET,
    scope: process.env.ATTIO_SCOPE,
    redirect_uri: process.env.REDIRECT_URI
});

// Example: List objects
const objects = await api.listObjects();
```

## License

MIT 