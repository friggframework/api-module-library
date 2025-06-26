# AWS Cloudwatch API Module

AWS Cloudwatch API Integration Module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/aws-cloudwatch
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/aws-cloudwatch');

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
AWS_CLOUDWATCH_CLIENT_ID=your_client_id
AWS_CLOUDWATCH_CLIENT_SECRET=your_client_secret  
AWS_CLOUDWATCH_SCOPE=your_scope
AWS_CLOUDWATCH_AUTH_URI=authorization_endpoint
AWS_CLOUDWATCH_TOKEN_URI=token_endpoint
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
