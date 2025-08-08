# BaseCRM API Integration

BaseCRM integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/basecrm
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/basecrm');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `BASECRM_CLIENT_ID`
- `BASECRM_CLIENT_SECRET`
- `BASECRM_SCOPE`

## API Documentation

For more information about the BaseCRM API, visit: https://api.getbase.com/v2
