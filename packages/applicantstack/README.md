# ApplicantStack API Module

This module provides integration with the ApplicantStack API for the Frigg Framework.

## Description

ApplicantStack is an applicant tracking system for small to medium-sized businesses.

## Installation

```bash
npm install @friggframework/api-module-applicantstack
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-applicantstack');

// Initialize the API
const api = new Api({
    client_id: 'your-client-id',
    client_secret: 'your-client-secret',
    redirect_uri: 'your-redirect-uri'
});

// Get authorization URL
const authUrl = api.getAuthUri();
```

## Configuration

Set the following environment variables:

```
APPLICANTSTACK_CLIENT_ID=your_client_id
APPLICANTSTACK_CLIENT_SECRET=your_client_secret
APPLICANTSTACK_SCOPE=your_scope
```

## License

MIT
