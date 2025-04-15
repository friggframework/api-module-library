# DocuSign API Module

This is the API Module for DocuSign that allows the [Frigg Framework](https://friggframework.org) to interact with the DocuSign eSignature REST API.

## Features

Currently implemented:
*   List Envelopes
*   Get Envelope Details
*   Create Envelope
*   Void Envelope
*   List Templates
*   Get Template Details
*   Retrieve User Info (for account discovery)

## Setup

1.  Install dependencies: `npm install`
2.  Configure environment variables by copying `.env.example` to `.env` and filling in the required values (Client ID, Client Secret, Environment).

## Usage

```typescript
import { Api, definition } from '@friggframework/api-module-docusign';

// Configuration typically loaded from environment variables
const config = {
    client_id: process.env.DOCUSIGN_CLIENT_ID,
    client_secret: process.env.DOCUSIGN_CLIENT_SECRET,
    // ... other credentials like access/refresh tokens if available
    // ... account_id might be set here or retrieved later
};

const api = new Api(config);

// Example: List sent envelopes
api.listEnvelopes({ status: 'sent' })
    .then(envelopes => console.log(envelopes))
    .catch(error => console.error(error));
```

Read more on the [Frigg documentation site](https://docs.friggframework.org/). 