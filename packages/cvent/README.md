# Cvent API Integration

Cvent integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/cvent
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/cvent');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `CVENT_CLIENT_ID`
- `CVENT_CLIENT_SECRET`
- `CVENT_SCOPE`

## API Documentation

For more information about the Cvent API, visit: https://api.cvent.com/ea
