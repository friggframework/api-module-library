# AWS S3 API Module

This module provides integration with the AWS S3 API for the Frigg Framework.

## Description

Amazon S3 is a cloud storage service that offers industry-leading scalability, data availability, security, and performance.

## Installation

```bash
npm install @friggframework/api-module-aws-s3
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-aws-s3');

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
AWS_S3_CLIENT_ID=your_client_id
AWS_S3_CLIENT_SECRET=your_client_secret
AWS_S3_SCOPE=your_scope
```

## License

MIT
