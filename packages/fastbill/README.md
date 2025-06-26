# FastBill API Integration

FastBill integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/fastbill
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/fastbill');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `FASTBILL_CLIENT_ID`
- `FASTBILL_CLIENT_SECRET`
- `FASTBILL_SCOPE`

## API Documentation

For more information about the FastBill API, visit: https://my.fastbill.com/api/1.0
