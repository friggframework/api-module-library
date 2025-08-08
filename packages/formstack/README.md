# Formstack API Integration

Formstack integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/formstack
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/formstack');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `FORMSTACK_CLIENT_ID`
- `FORMSTACK_CLIENT_SECRET`
- `FORMSTACK_SCOPE`

## API Documentation

For more information about the Formstack API, visit: https://www.formstack.com/api/v2
