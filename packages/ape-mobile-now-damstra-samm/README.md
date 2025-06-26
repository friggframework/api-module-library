# APE Mobile (now Damstra Samm) API Integration

APE Mobile (now Damstra Samm) integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/ape-mobile-now-damstra-samm
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/ape-mobile-now-damstra-samm');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `APE_MOBILE_NOW_DAMSTRA_SAMM_CLIENT_ID`
- `APE_MOBILE_NOW_DAMSTRA_SAMM_CLIENT_SECRET`
- `APE_MOBILE_NOW_DAMSTRA_SAMM_SCOPE`

## API Documentation

For more information about the APE Mobile (now Damstra Samm) API, visit: https://api.damstratechnology.com
