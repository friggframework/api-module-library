# Frontify API Module

This is the API Module for Frontify that allows the [Frigg Framework](https://friggframework.org) to interact with the Frontify API.

## Description

Frontify simplifies brand management with a platform that connects everything (and everyone) important to the growth of your brand. This module provides OAuth2 authentication and access to Frontify's GraphQL API.

## Developer Resources

- **Official API Documentation**: [Frontify GraphQL API](https://developer.frontify.com/d/XFPCrGNrXQQM/graphql-api)
- **Developer Portal**: [developer.frontify.com](https://developer.frontify.com)
- **Product Website**: [frontify.com](https://frontify.com)

## Authentication

This module uses **OAuth2** authentication with domain-specific authorization.

### Required Environment Variables

```bash
# OAuth2 Credentials
FRONTIFY_CLIENT_ID=your_client_id
FRONTIFY_CLIENT_SECRET=your_client_secret
FRONTIFY_SCOPE=your_required_scopes

# Redirect URI
REDIRECT_URI=https://your-app.com/auth/callback
```

### Authentication Flow

1. User provides their Frontify domain (e.g., `yourcompany.frontify.com`)
2. OAuth2 authorization flow is initiated
3. Access and refresh tokens are obtained and stored

## API Rate Limits

Please refer to the [Frontify API documentation](https://developer.frontify.com) for current rate limits and quotas.

## Setup Instructions

1. Install the module:
   ```bash
   npm install @friggframework/api-module-frontify
   ```

2. Create a Frontify app:
   - Visit the [Frontify Developer Portal](https://developer.frontify.com)
   - Create a new application
   - Note your Client ID and Client Secret

3. Configure environment variables as shown above

4. Initialize the module:
   ```javascript
   const { Api, Definition } = require('@friggframework/api-module-frontify');
   
   // Initialize with OAuth2 tokens
   const api = new Api({
     access_token: 'your_access_token',
     refresh_token: 'your_refresh_token',
     domain: 'yourcompany.frontify.com'
   });
   ```

## Common Use Cases

- Brand asset management
- Design system synchronization
- Guideline distribution
- Brand portal integration
- Asset workflow automation

## Available API Methods

The module supports GraphQL queries and mutations through the Frontify API. Common operations include:

- User management
- Project operations
- Asset management
- Brand guidelines access
- Workspace configuration

## Known Issues and Limitations

- Domain-specific authentication requires user input during setup
- GraphQL API structure may require custom query building
- Rate limits apply to API calls

## SDK Dependencies

- `@friggframework/core`: Core framework functionality
- OAuth2 support built-in

## Troubleshooting

### Common Issues

1. **Invalid domain error**: Ensure the domain format is correct (e.g., `company.frontify.com`)
2. **Authentication failures**: Verify Client ID and Secret are correct
3. **Scope errors**: Ensure requested scopes match your app configuration

### Debug Mode

Enable debug logging:
```javascript
api.setDebug(true);
```

## Support

For Frontify API issues, contact [Frontify Support](https://frontify.com/support)
For Frigg Framework issues, visit [Frigg Documentation](https://docs.friggframework.org)

## Categories

- Sharing
- Brand Management
- Digital Asset Management