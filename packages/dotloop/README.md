# Dotloop API Module

Frigg API module for Dotloop integration.

## Installation

```bash
npm install @friggframework/dotloop
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/dotloop');

// Initialize API client
const api = new Api({
  client_id: 'your_client_id',
  client_secret: 'your_client_secret'
});
```

## Configuration

Set the following environment variables:

```
DOTLOOP_CLIENT_ID=your_client_id
DOTLOOP_CLIENT_SECRET=your_client_secret
```

## API Methods

- `getCurrentUser()` - Get current user information
- `listItems()` - List items
- `createItem(data)` - Create new item
- `updateItem(id, data)` - Update existing item
- `deleteItem(id)` - Delete item

## License

MIT
