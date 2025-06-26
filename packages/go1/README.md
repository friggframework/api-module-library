# GO1 API Module

Frigg API module for GO1 integration.

## Installation

```bash
npm install @friggframework/go1
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/go1');

// Initialize API client
const api = new Api({
  client_id: 'your_client_id',
  client_secret: 'your_client_secret'
});
```

## Configuration

Set the following environment variables:

```
GO1_CLIENT_ID=your_client_id
GO1_CLIENT_SECRET=your_client_secret
```

## API Methods

- `getCurrentUser()` - Get current user information
- `listItems()` - List items
- `createItem(data)` - Create new item
- `updateItem(id, data)` - Update existing item
- `deleteItem(id)` - Delete item

## License

MIT
