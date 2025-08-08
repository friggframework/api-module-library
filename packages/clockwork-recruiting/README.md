# Clockwork Recruiting API Module

Clockwork Recruiting API Integration Module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/clockwork-recruiting
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/clockwork-recruiting');

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
CLOCKWORK_RECRUITING_CLIENT_ID=your_client_id
CLOCKWORK_RECRUITING_CLIENT_SECRET=your_client_secret  
CLOCKWORK_RECRUITING_SCOPE=your_scope
CLOCKWORK_RECRUITING_AUTH_URI=authorization_endpoint
CLOCKWORK_RECRUITING_TOKEN_URI=token_endpoint
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
