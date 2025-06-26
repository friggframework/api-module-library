# Amazon API Gateway API Module

Amazon API Gateway API Integration Module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/amazon-api-gateway
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/amazon-api-gateway');

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
AMAZON_API_GATEWAY_CLIENT_ID=your_client_id
AMAZON_API_GATEWAY_CLIENT_SECRET=your_client_secret  
AMAZON_API_GATEWAY_SCOPE=your_scope
AMAZON_API_GATEWAY_AUTH_URI=authorization_endpoint
AMAZON_API_GATEWAY_TOKEN_URI=token_endpoint
REDIRECT_URI=your_base_redirect_uri
```

## Development

```bash
npm test
npm run test:watch
npm run test:coverage
```

## Category

Developer

## License

MIT
