# Finance & Customer Support API Modules Summary

This document provides an overview of the 5 new API modules created for finance and customer support platforms.

## Finance APIs

### 1. Plaid (`@friggframework/plaid`)
**Description**: Financial data aggregation platform for accessing bank account information, transactions, and balances.

**Key Features**:
- Link token creation for Plaid Link integration
- Public token exchange for secure access
- Account and balance retrieval
- Transaction fetching and incremental syncing
- Investment holdings and transactions
- Identity verification
- Liability information
- Institution search and metadata
- Processor token creation for third-party integrations

**Authentication**: Client ID/Secret with public token exchange

**Environment Variables**:
```
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENV=sandbox|development|production
```

### 2. Wise (`@friggframework/wise`)
**Description**: International money transfer platform (formerly TransferWise) for sending money across borders.

**Key Features**:
- Multi-currency account management
- Quote creation with real-time exchange rates
- International transfer creation and tracking
- Recipient management
- Balance checking across currencies
- Transfer fee calculation
- Webhook support for transfer status updates
- Sandbox environment for testing

**Authentication**: API Token

**Environment Variables**:
```
WISE_API_TOKEN=your_api_token
WISE_SANDBOX=true|false
```

### 3. Coinbase (`@friggframework/coinbase`)
**Description**: Cryptocurrency trading and wallet platform for buying, selling, and managing digital assets.

**Key Features**:
- OAuth2 and API Key authentication support
- Wallet and account management
- Buy/sell cryptocurrency orders
- Send/receive/transfer funds
- Real-time price data and exchange rates
- Transaction history
- Payment method management
- Deposit and withdrawal operations
- Investment portfolio tracking

**Authentication**: OAuth2 or API Key/Secret

**Environment Variables**:
```
# OAuth2
COINBASE_CLIENT_ID=your_client_id
COINBASE_CLIENT_SECRET=your_client_secret
COINBASE_SANDBOX=true|false

# API Key
COINBASE_API_KEY=your_api_key
COINBASE_API_SECRET=your_api_secret
```

## Customer Support APIs

### 4. Zendesk (`@friggframework/zendesk`)
**Description**: Comprehensive customer service platform for managing support tickets and help center content.

**Key Features**:
- OAuth2 and API token authentication
- Full ticket lifecycle management
- User and organization management
- Help Center articles and knowledge base
- Macros, triggers, and automation rules
- Custom fields and objects
- Satisfaction ratings
- Advanced search capabilities
- Webhook support
- Multi-brand support

**Authentication**: OAuth2 or API Token with email

**Environment Variables**:
```
# OAuth2
ZENDESK_CLIENT_ID=your_client_id
ZENDESK_CLIENT_SECRET=your_client_secret
ZENDESK_SUBDOMAIN=your_subdomain

# API Token
ZENDESK_EMAIL=your_email
ZENDESK_API_TOKEN=your_api_token
ZENDESK_SUBDOMAIN=your_subdomain
```

### 5. Freshdesk (`@friggframework/freshdesk`)
**Description**: Help desk software for customer support with ticketing and knowledge base features.

**Key Features**:
- Comprehensive ticket management
- Contact and agent management
- Company management
- Knowledge base (solutions) with categories, folders, and articles
- Forum and discussion management
- Time tracking on tickets
- Automation rules and SLA policies
- Canned responses for quick replies
- Custom fields for tickets, contacts, and companies
- Satisfaction ratings
- Email configuration management

**Authentication**: API Key with subdomain

**Environment Variables**:
```
FRESHDESK_API_KEY=your_api_key
FRESHDESK_SUBDOMAIN=your_subdomain
```

## Common Features Across All Modules

1. **Standardized Structure**: All modules follow the Frigg Framework v1 structure with:
   - `api.js` - Core API implementation
   - `definition.js` - Authentication and configuration
   - `index.js` - Module exports
   - `package.json` - Dependencies and metadata
   - `defaultConfig.json` - Module configuration
   - `readme.md` - Documentation

2. **Error Handling**: Consistent error handling with descriptive messages

3. **Webhook Support**: All modules include webhook signature verification methods

4. **Testing**: Each module includes Jest test files with comprehensive test coverage

5. **Environment Configuration**: Support for environment variables and flexible configuration

## Usage Example

```javascript
const { Api } = require('@friggframework/plaid');

// Initialize the API
const plaidApi = new Api({
    clientId: process.env.PLAID_CLIENT_ID,
    secret: process.env.PLAID_SECRET,
    environment: 'sandbox'
});

// Create a link token
const linkToken = await plaidApi.createLinkToken({
    userId: 'user-123',
    products: ['transactions', 'accounts'],
    countryCodes: ['US']
});

// Exchange public token after user completes Plaid Link
const result = await plaidApi.exchangePublicToken(publicToken);

// Fetch accounts
const accounts = await plaidApi.getAccounts();
```

## Integration Notes

- **Plaid**: Requires user interaction through Plaid Link for bank connection
- **Wise**: Supports both personal and business profiles
- **Coinbase**: Can use either OAuth2 for user delegation or API keys for direct access
- **Zendesk**: Subdomain required for all API calls
- **Freshdesk**: Returns numeric status codes (2 = Open, 3 = Pending, etc.)

All modules are ready for v1 deployment and follow Frigg Framework best practices.