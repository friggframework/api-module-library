# Amazon SQS API Module

Frigg API module for Amazon SQS integration.

## Installation

```bash
npm install @friggframework/amazon-sqs
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/amazon-sqs');

// Initialize API client
const api = new Api({
  client_id: 'your_client_id',
  client_secret: 'your_client_secret'
});
```

## Configuration

Set the following environment variables:

```
AMAZON_SQS_CLIENT_ID=your_client_id
AMAZON_SQS_CLIENT_SECRET=your_client_secret
```

## API Methods

- `getCurrentUser()` - Get current user information
- `listItems()` - List items
- `createItem(data)` - Create new item
- `updateItem(id, data)` - Update existing item
- `deleteItem(id)` - Delete item

## License

MIT
