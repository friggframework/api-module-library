# BitBucket by Atlassian API Integration

BitBucket by Atlassian integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/bitbucket-by-atlassian
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/bitbucket-by-atlassian');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `BITBUCKET_BY_ATLASSIAN_CLIENT_ID`
- `BITBUCKET_BY_ATLASSIAN_CLIENT_SECRET`
- `BITBUCKET_BY_ATLASSIAN_SCOPE`

## API Documentation

For more information about the BitBucket by Atlassian API, visit: https://api.bitbucket.org/2.0
