# Shopify API Module

This is the API Module for Shopify that allows the [Frigg Framework](https://friggframework.org) to interact with the Shopify API.

## Description

Shopify is a complete commerce platform that lets you start, grow, and manage a business. This module provides OAuth2 authentication and access to Shopify's REST and GraphQL APIs for building custom storefronts, apps, and integrations.

## Developer Resources

- **Official API Documentation**: [https://shopify.dev/docs/api](https://shopify.dev/docs/api)
- **Developer Portal**: [https://partners.shopify.com](https://partners.shopify.com)
- **REST API Reference**: [https://shopify.dev/docs/api/admin-rest](https://shopify.dev/docs/api/admin-rest)
- **GraphQL API Reference**: [https://shopify.dev/docs/api/admin-graphql](https://shopify.dev/docs/api/admin-graphql)
- **Product Website**: [https://shopify.com](https://shopify.com)

## Authentication

This module uses **OAuth2** authentication for public apps and API key authentication for private apps.

### Required Environment Variables

```bash
# OAuth2 Credentials (Public Apps)
SHOPIFY_CLIENT_ID=your_app_api_key
SHOPIFY_CLIENT_SECRET=your_app_api_secret_key
SHOPIFY_SCOPE=read_products,write_orders,read_customers

# For Private Apps
SHOPIFY_API_KEY=your_private_app_api_key
SHOPIFY_PASSWORD=your_private_app_password
SHOPIFY_SHOP_DOMAIN=yourstore.myshopify.com

# Redirect URI
REDIRECT_URI=https://your-app.com/auth/callback
```

## API Rate Limits

Shopify uses different rate limiting strategies:

### REST API
- **Standard**: 2 requests/second (with bursting)
- **Shopify Plus**: 4 requests/second
- **Rate limit header**: `X-Shopify-Shop-Api-Call-Limit`

### GraphQL API
- **Cost-based system**: Each query has a calculated cost
- **Standard**: 50 cost points/second
- **Restored rate**: 50 points/second

## Setup Instructions

1. Install the module:
   ```bash
   npm install @friggframework/api-module-shopify
   ```

2. Create a Shopify app:
   - Sign up for a [Shopify Partner account](https://partners.shopify.com)
   - Create a new app in your Partner Dashboard
   - Configure app settings and permissions

3. Set up environment variables as shown above

4. Initialize the module:
   ```javascript
   const { Api, Definition } = require('@friggframework/api-module-shopify');
   
   // Initialize with OAuth2
   const api = new Api({
     access_token: 'your_access_token',
     shop: 'yourstore.myshopify.com'
   });
   ```

## Common Use Cases

- Product catalog management
- Order processing and fulfillment
- Customer relationship management
- Inventory tracking
- Custom checkout experiences
- Discount and pricing automation
- Multi-channel selling
- Analytics and reporting

## Available API Methods

Key endpoints available through this module:
- **Products**: Create, read, update, delete products
- **Orders**: Manage orders and fulfillment
- **Customers**: Customer data and segmentation
- **Inventory**: Track inventory levels
- **Collections**: Organize products
- **Webhooks**: Real-time event notifications
- **Themes**: Customize store appearance
- **Metafields**: Store custom data

## SDK and Integration Notes

- Official SDKs: `@shopify/shopify-api`, `@shopify/admin-api-client`
- Webhook verification for secure event handling
- Both REST and GraphQL APIs supported
- Storefront API for custom storefronts
- App Bridge for embedded app experiences

## Known Issues and Limitations

- API version deprecation (versions supported for 12 months)
- Some features require Shopify Plus
- App installation requires merchant approval
- Rate limits shared across all apps for a shop
- Maximum API call execution time: 60 seconds

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check access token and shop domain
2. **429 Too Many Requests**: Implement rate limit handling
3. **Invalid API version**: Use a supported API version
4. **Scope errors**: Request necessary access scopes during OAuth

### Debug Mode

Enable debug logging:
```javascript
api.setDebug(true);
```

### API Versioning

Specify API version:
```javascript
api.setVersion('2024-01');
```

## Fenestra UI Extensions

This module includes comprehensive Fenestra specifications for Shopify UI extensibility.

### Available Extension Types
See `fenestra/platform.fenestra.yaml` for complete specification.

### Examples
Check `fenestra/examples/` directory for implementation examples.

### Fenestra Specifications

- **Platform Spec**: `fenestra/platform.fenestra.yaml`
- **Examples**: `fenestra/examples/`
- **Schemas**: `fenestra/schemas/`

## Support

For Shopify API issues:
- [Shopify Developer Documentation](https://shopify.dev)
- [Partner Support](https://help.shopify.com/en/partners)
- [Community Forums](https://community.shopify.com/c/shopify-apis-and-sdks/bd-p/shopify-apis-and-sdks)

For Frigg Framework issues:
- [Frigg Documentation](https://docs.friggframework.org)

## Categories

E-commerce, Retail, Payment Processing, Inventory Management
