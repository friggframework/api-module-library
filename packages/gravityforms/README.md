# GravityForms API Integration

GravityForms integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/gravityforms
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/gravityforms');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `GRAVITYFORMS_CLIENT_ID`
- `GRAVITYFORMS_CLIENT_SECRET`
- `GRAVITYFORMS_SCOPE`

## API Documentation

For more information about the GravityForms API, visit: https://api.gravityforms.com
