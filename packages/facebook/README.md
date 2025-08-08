# Facebook API Integration

Facebook integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/facebook
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/facebook');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `FACEBOOK_CLIENT_ID`
- `FACEBOOK_CLIENT_SECRET`
- `FACEBOOK_SCOPE`

## API Documentation

For more information about the Facebook API, visit: https://graph.facebook.com
