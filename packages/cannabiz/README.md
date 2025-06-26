# Cannabiz API Integration

Cannabiz integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/cannabiz
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/cannabiz');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `CANNABIZ_CLIENT_ID`
- `CANNABIZ_CLIENT_SECRET`
- `CANNABIZ_SCOPE`

## API Documentation

For more information about the Cannabiz API, visit: https://api.cannabiz.com
