# Cirrus Shield API Module

Frigg API module for Cirrus Shield integration.

## Installation

```bash
npm install @friggframework/cirrus-shield
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/cirrus-shield');

// Initialize API client
const api = new Api({
  client_id: 'your_client_id',
  client_secret: 'your_client_secret'
});
```

## Configuration

Set the following environment variables:

```
CIRRUS_SHIELD_CLIENT_ID=your_client_id
CIRRUS_SHIELD_CLIENT_SECRET=your_client_secret
```

## API Methods

- `getCurrentUser()` - Get current user information
- `listItems()` - List items
- `createItem(data)` - Create new item
- `updateItem(id, data)` - Update existing item
- `deleteItem(id)` - Delete item

## License

MIT
