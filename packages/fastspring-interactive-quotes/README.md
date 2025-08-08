# FastSpring Interactive Quotes API Integration

FastSpring Interactive Quotes integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/fastspring-interactive-quotes
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/fastspring-interactive-quotes');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `FASTSPRING_INTERACTIVE_QUOTES_CLIENT_ID`
- `FASTSPRING_INTERACTIVE_QUOTES_CLIENT_SECRET`
- `FASTSPRING_INTERACTIVE_QUOTES_SCOPE`

## API Documentation

For more information about the FastSpring Interactive Quotes API, visit: https://api.fastspring.com
