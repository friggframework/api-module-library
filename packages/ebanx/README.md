# Ebanx API Integration

Ebanx integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/ebanx
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/ebanx');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `EBANX_CLIENT_ID`
- `EBANX_CLIENT_SECRET`
- `EBANX_SCOPE`

## API Documentation

For more information about the Ebanx API, visit: https://api.ebanx.com
