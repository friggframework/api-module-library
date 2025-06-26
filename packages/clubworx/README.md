# Clubworx API Integration

Clubworx integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/clubworx
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/clubworx');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `CLUBWORX_CLIENT_ID`
- `CLUBWORX_CLIENT_SECRET`
- `CLUBWORX_SCOPE`

## API Documentation

For more information about the Clubworx API, visit: https://api.clubworx.com
