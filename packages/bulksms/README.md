# BulkSMS API Integration

BulkSMS integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/bulksms
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/bulksms');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `BULKSMS_CLIENT_ID`
- `BULKSMS_CLIENT_SECRET`
- `BULKSMS_SCOPE`

## API Documentation

For more information about the BulkSMS API, visit: https://api.bulksms.com/v1
