# Auth0 API Module

Identity and access management

## Installation

```bash
npm install @friggframework/auth0
```

## Configuration

See `.env.example` for required environment variables.

## Usage

```javascript
const { Api, Definition } = require('@friggframework/auth0');

// Initialize API client
const api = new Api({
    // Add required credentials
});

// Test the connection
const result = await api.getCurrentUser();
```

## Category

Authentication

## License

MIT
