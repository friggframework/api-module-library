# Google Contacts API Module

Frigg API module for Google Contacts integration.

## Installation

```bash
npm install @friggframework/google-contacts
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/google-contacts');

// Initialize API client
const api = new Api({
  client_id: 'your_client_id',
  client_secret: 'your_client_secret'
});
```

## Configuration

Set the following environment variables:

```
GOOGLE_CONTACTS_CLIENT_ID=your_client_id
GOOGLE_CONTACTS_CLIENT_SECRET=your_client_secret
```

## API Methods

- `getCurrentUser()` - Get current user information
- `listItems()` - List items
- `createItem(data)` - Create new item
- `updateItem(id, data)` - Update existing item
- `deleteItem(id)` - Delete item

## License

MIT
