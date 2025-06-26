# Enreach (formerly Herobase) API Module

Enreach (formerly Herobase) API Integration Module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/enreach-formerly-herobase
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/enreach-formerly-herobase');

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
ENREACH_FORMERLY_HEROBASE_CLIENT_ID=your_client_id
ENREACH_FORMERLY_HEROBASE_CLIENT_SECRET=your_client_secret  
ENREACH_FORMERLY_HEROBASE_SCOPE=your_scope
ENREACH_FORMERLY_HEROBASE_AUTH_URI=authorization_endpoint
ENREACH_FORMERLY_HEROBASE_TOKEN_URI=token_endpoint
REDIRECT_URI=your_base_redirect_uri
```

## Development

```bash
npm test
npm run test:watch
npm run test:coverage
```

## Category

CRM

## License

MIT
