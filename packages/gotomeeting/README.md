# GoToMeeting API Integration

GoToMeeting integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/gotomeeting
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/gotomeeting');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `GOTOMEETING_CLIENT_ID`
- `GOTOMEETING_CLIENT_SECRET`
- `GOTOMEETING_SCOPE`

## API Documentation

For more information about the GoToMeeting API, visit: https://api.getgo.com/G2M/rest
