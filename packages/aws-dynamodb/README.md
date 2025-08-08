# AWS DynamoDB API Integration

AWS DynamoDB integration module for the Frigg Framework.

## Installation

```bash
npm install @friggframework/aws-dynamodb
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/aws-dynamodb');

// Initialize API instance
const api = new Api({
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    redirect_uri: 'your_redirect_uri'
});
```

## Configuration

Set the following environment variables:

- `AWS_DYNAMODB_CLIENT_ID`
- `AWS_DYNAMODB_CLIENT_SECRET`
- `AWS_DYNAMODB_SCOPE`

## API Documentation

For more information about the AWS DynamoDB API, visit: https://dynamodb.us-east-1.amazonaws.com
