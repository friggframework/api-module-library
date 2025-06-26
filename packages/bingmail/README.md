# Bingmail API Module

Bingmail API Integration Module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/bingmail
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/bingmail');

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
BINGMAIL_CLIENT_ID=your_client_id
BINGMAIL_CLIENT_SECRET=your_client_secret  
BINGMAIL_SCOPE=your_scope
BINGMAIL_AUTH_URI=authorization_endpoint
BINGMAIL_TOKEN_URI=token_endpoint
REDIRECT_URI=your_base_redirect_uri
```

## Development

```bash
npm test
npm run test:watch
npm run test:coverage
```

## Category

Communication

## License

MIT
