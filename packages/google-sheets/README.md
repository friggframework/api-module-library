# Google Sheets API Module

Google Sheets API Integration Module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/google-sheets
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/google-sheets');

// Initialize API
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});

// Get current user
const user = await api.getCurrentUser();
console.log(user);
```

## Environment Variables

Create a `.env` file with the following variables:

```
GOOGLE_SHEETS_CLIENT_ID=your_client_id
GOOGLE_SHEETS_CLIENT_SECRET=your_client_secret  
GOOGLE_SHEETS_SCOPE=your_scope
GOOGLE_SHEETS_AUTH_URI=authorization_endpoint
GOOGLE_SHEETS_TOKEN_URI=token_endpoint
REDIRECT_URI=your_base_redirect_uri
```

## Development

```bash
npm test
npm run test:watch
npm run test:coverage
```

## Category

Product Management

## License

MIT
