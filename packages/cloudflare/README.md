# Cloudflare API Module

Web performance and security

## Installation

```bash
npm install @friggframework/cloudflare
```

## Configuration

See `.env.example` for required environment variables.

## Usage

```javascript
const { Api, Definition } = require('@friggframework/cloudflare');

// Initialize API client
const api = new Api({
    // Add required credentials
});

// Test the connection
const result = await api.getCurrentUser();
```

## Category

Infrastructure

## License

MIT
