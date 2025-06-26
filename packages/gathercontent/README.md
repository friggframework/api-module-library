# GatherContent API Module

Frigg API module for GatherContent integration.

## Installation

```bash
npm install @friggframework/gathercontent
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/gathercontent');

// Initialize API client
const api = new Api({
  client_id: 'your_client_id',
  client_secret: 'your_client_secret'
});
```

## Configuration

Set the following environment variables:

```
GATHERCONTENT_CLIENT_ID=your_client_id
GATHERCONTENT_CLIENT_SECRET=your_client_secret
```

## API Methods

- `getCurrentUser()` - Get current user information
- `listItems()` - List items
- `createItem(data)` - Create new item
- `updateItem(id, data)` - Update existing item
- `deleteItem(id)` - Delete item

## License

MIT
