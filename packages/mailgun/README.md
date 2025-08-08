# Mailgun API Module

Email automation service

## Installation

```bash
npm install @friggframework/mailgun
```

## Configuration

See `.env.example` for required environment variables.

## Usage

```javascript
const { Api, Definition } = require('@friggframework/mailgun');

// Initialize API client
const api = new Api({
    // Add required credentials
});

// Test the connection
const result = await api.getCurrentUser();
```

## Category

Email

## License

MIT
