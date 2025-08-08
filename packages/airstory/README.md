# Airstory API Module

Airstory API Integration Module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/airstory
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/airstory');

// Initialize API
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});

// Get current user
const user = await api.getCurrentUser();
console.log(user);
```

## Environment Variables

Create a `.env` file with the following variables:

```
AIRSTORY_CLIENT_ID=your_client_id
AIRSTORY_CLIENT_SECRET=your_client_secret  
AIRSTORY_SCOPE=your_scope
AIRSTORY_AUTH_URI=authorization_endpoint
AIRSTORY_TOKEN_URI=token_endpoint
REDIRECT_URI=your_base_redirect_uri
```

## Development

```bash
npm test
npm run test:watch
npm run test:coverage
```

## Category

Productivity

## License

MIT
