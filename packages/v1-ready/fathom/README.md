# Fathom API Module

This module provides integration with the [Fathom Video API](https://docs.fathom.ai/api-reference) for the Frigg Framework.

## Features

- API Key authentication
- List meetings with comprehensive filtering options
- List teams and team members
- Pagination support with cursor-based iteration
- Full TypeScript support

## Installation

```bash
npm install @friggframework/api-module-fathom
```

## Quick Start

```javascript
const { Api } = require('@friggframework/api-module-fathom');

// Initialize the API with your API key
const api = new Api({
    apiKey: 'your-fathom-api-key'
});

// List all meetings
const meetings = await api.listMeetings();
console.log(meetings.data);

// List meetings with filters
const filteredMeetings = await api.listMeetings({
    recorded_by: ['user@example.com'],
    meeting_type: 'internal',
    include_transcript: true,
    created_after: '2024-01-01T00:00:00Z'
});

// Iterate through all meetings (handles pagination automatically)
for await (const meeting of api.iterateMeetings()) {
    console.log(meeting.title);
}

// List teams
const teams = await api.listTeams();

// List team members
const teamMembers = await api.listTeamMembers();
```

## API Methods

### `listMeetings(params)`

List meetings with optional filtering parameters.

**Parameters:**
- `recorded_by` (array): Filter by meeting owner emails
- `teams` (array): Filter by team names
- `calendar_invitees` (array): Filter by attendee emails
- `created_after` (string): ISO timestamp to filter meetings created after
- `meeting_type` (string): 'all', 'internal', or 'external' (default: 'all')
- `include_transcript` (boolean): Include transcript data (default: false)
- `cursor` (string): Pagination cursor

**Returns:** Object with `data` array and `next_cursor` for pagination

### `listTeams()`

List all teams associated with the API key.

**Returns:** Object with `data` array of team objects

### `listTeamMembers()`

List all team members.

**Returns:** Object with `data` array of team member objects

### `iterateMeetings(params)`

Async generator that automatically handles pagination for iterating through all meetings.

**Parameters:** Same as `listMeetings()`

**Yields:** Individual meeting objects

## Authentication

Fathom uses API key authentication. You can obtain your API key from the Fathom settings under API Access.

### Setting up authentication:

```javascript
// Using environment variable
const api = new Api({
    apiKey: process.env.FATHOM_API_KEY
});

// Direct initialization
const api = new Api({
    apiKey: 'your-api-key-here'
});
```

## Environment Variables

- `FATHOM_API_KEY`: Your Fathom API key

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run coverage

# Run tests in watch mode
npm run test:watch
```

## Error Handling

The module throws errors for:
- 400 Bad Request - Invalid parameters
- 401 Unauthorized - Invalid API key
- Network errors

Example error handling:

```javascript
try {
    const meetings = await api.listMeetings();
} catch (error) {
    if (error.message.includes('401')) {
        console.error('Invalid API key');
    } else {
        console.error('API error:', error.message);
    }
}
```

## Module Definition

This module includes a complete Frigg Definition for use in integrations:

```javascript
const { Definition } = require('@friggframework/api-module-fathom');

// Use in your integration
const fathomDefinition = Definition;
```

## Links

- [Fathom Website](https://fathom.video)
- [API Documentation](https://docs.fathom.ai/api-reference)
- [Frigg Framework](https://github.com/friggframework)