# Amazon Cloudsearch API Integration

Amazon Cloudsearch integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/amazon-cloudsearch
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/amazon-cloudsearch');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `AMAZON_CLOUDSEARCH_CLIENT_ID`
- `AMAZON_CLOUDSEARCH_CLIENT_SECRET`
- `AMAZON_CLOUDSEARCH_SCOPE`

## API Documentation

For more information about the Amazon Cloudsearch API, visit: https://cloudsearch.us-east-1.amazonaws.com
