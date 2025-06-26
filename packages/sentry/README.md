# Sentry API Module

Error tracking and performance monitoring

## Installation

```bash
npm install @friggframework/sentry
```

## Configuration

See `.env.example` for required environment variables.

## Usage

```javascript
const { Api, Definition } = require('@friggframework/sentry');

// Initialize API client
const api = new Api({
    // Add required credentials
});

// Test the connection
const result = await api.getCurrentUser();
```

## Category

Monitoring

## License

MIT
