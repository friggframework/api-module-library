# AWS Account Management API Module

This module provides integration with the AWS Account Management API for the Frigg Framework.

## Description

AWS Account Management provides tools to manage AWS account settings, billing, and administrative functions.

## Installation

```bash
npm install @friggframework/api-module-aws-account-management
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-aws-account-management');

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
AWS_ACCOUNT_MANAGEMENT_CLIENT_ID=your_client_id
AWS_ACCOUNT_MANAGEMENT_CLIENT_SECRET=your_client_secret
AWS_ACCOUNT_MANAGEMENT_SCOPE=your_scope
```

## License

MIT
