# Firebase API Module

Google mobile and web application platform

## Installation

```bash
npm install @friggframework/firebase
```

## Configuration

See `.env.example` for required environment variables.

## Usage

```javascript
const { Api, Definition } = require('@friggframework/firebase');

// Initialize API client
const api = new Api({
    // Add required credentials
});

// Test the connection
const result = await api.getCurrentUser();
```

## Category

Backend Services

## License

MIT
