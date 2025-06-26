# Benchmark Email API Module

This module provides integration with the Benchmark Email API for the Frigg Framework.

## Description

Benchmark Email provides email marketing automation and newsletter services.

## Installation

```bash
npm install @friggframework/api-module-benchmark-email
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-benchmark-email');

// Initialize the API
const api = new Api({
    client_id: 'your-client-id',
    client_secret: 'your-client-secret',
    redirect_uri: 'your-redirect-uri'
});

// Get authorization URL
const authUrl = api.getAuthUri();
```

## Configuration

Set the following environment variables:

```
BENCHMARK_EMAIL_CLIENT_ID=your_client_id
BENCHMARK_EMAIL_CLIENT_SECRET=your_client_secret
BENCHMARK_EMAIL_SCOPE=your_scope
```

## License

MIT
