# Frigg Scale Test API Module

A synthetic data generator for scale testing that deterministically generates up to 3 million contacts without requiring external services or data storage.

## Features

- **Deterministic Generation**: Same input parameters always produce the same contacts
- **Memory Efficient**: Generates contacts on-the-fly during pagination without storing them in memory
- **Scalable**: Supports up to 3 million unique contacts per account
- **Predictable Pagination**: Cursor-based pagination with configurable page sizes
- **No Dependencies**: No external services or databases required

## Installation

```bash
npm install @friggframework/api-module-frigg-scale-test
```

## Usage

```javascript
const { Api, Definition, Config } = require('@friggframework/api-module-frigg-scale-test');

// Initialize the API
const api = new Api();

// Health check
const health = await api.health();
console.log(health); // { ok: true }

// List contacts with pagination
const page1 = await api.listContacts({
  accountId: 'demo',
  limit: 100
});

console.log(page1.items.length); // 100
console.log(page1.nextCursor); // '100' (offset for next page)

// Get next page
const page2 = await api.listContacts({
  accountId: 'demo',
  limit: 100,
  cursor: page1.nextCursor
});

// Filter by updatedSince
const recentContacts = await api.listContacts({
  accountId: 'demo',
  limit: 100,
  updatedSince: '2024-01-01T00:00:00Z'
});
```

## API Methods

### `health()`

Returns a health check status.

**Returns:** `Promise<{ ok: boolean }>`

### `listContacts(params)`

Generates and returns a page of synthetic contacts.

**Parameters:**
- `accountId` (string, required): Account identifier used for deterministic generation
- `limit` (number, optional): Number of contacts to return (default: 100, max: 1000)
- `cursor` (string, optional): Pagination cursor (offset)
- `updatedSince` (string, optional): ISO 8601 timestamp to filter contacts

**Returns:** `Promise<{ items: Contact[], nextCursor: string | null }>`

**Contact Schema:**
```typescript
{
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  company: string;
  address: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
  updatedAt: string; // ISO 8601
  payload: {
    generatedIndex: number;
    accountId: string;
  };
}
```

## Configuration

The module exports a `Config` object with metadata:

```javascript
{
  "name": "frigg-scale-test",
  "label": "Frigg Scale Test",
  "description": "Mock CRM for scale testing with deterministic synthetic data"
}
```

## Definition

The module exports a Frigg Framework `Definition` object for integration with the Frigg framework's authentication and module system.

## Deterministic Generation

All contacts are generated deterministically using a seeded random number generator. The seed is derived from the `accountId` and contact index, ensuring:

1. Same `accountId` + `index` always produces the same contact
2. Different `accountId` values produce different contact sets
3. Contacts remain unique across the full 3 million record range

## Future Features

See [FUTURE_ROADMAP.md](./FUTURE_ROADMAP.md) for planned features including:
- Activities (phone calls, emails, SMS)
- Bulk export operations
- Configuration management for testing scenarios
- Mutation tracking for delta sync testing

## Development

```bash
# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

## License

MIT

