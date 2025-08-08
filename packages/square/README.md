# Square API Module

A comprehensive Square API integration module for the Frigg Framework.

## Setup

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
SQUARE_CLIENT_ID=your_square_client_id
SQUARE_CLIENT_SECRET=your_square_client_secret
SQUARE_SCOPE=MERCHANT_PROFILE_READ PAYMENTS_READ PAYMENTS_WRITE
SQUARE_SANDBOX=true
REDIRECT_URI=your_redirect_uri_base
```

### Getting Square API Credentials

1. Go to the [Square Developer Dashboard](https://developer.squareup.com/)
2. Sign in with your Square account
3. Create a new application or select an existing one
4. Get your Application ID (Client ID) and Application Secret (Client Secret)
5. Set up your redirect URI (e.g., `https://yourdomain.com/square`)

### Sandbox vs Production

- Set `SQUARE_SANDBOX=true` for testing with Square's sandbox environment
- Set `SQUARE_SANDBOX=false` for production usage

## Available Scopes

- `MERCHANT_PROFILE_READ` - Read merchant profile information
- `MERCHANT_PROFILE_WRITE` - Modify merchant profile information
- `PAYMENTS_READ` - Read payment information
- `PAYMENTS_WRITE` - Process payments
- `CUSTOMERS_READ` - Read customer information
- `CUSTOMERS_WRITE` - Manage customers
- `ORDERS_READ` - Read order information
- `ORDERS_WRITE` - Manage orders
- `INVENTORY_READ` - Read inventory information
- `INVENTORY_WRITE` - Manage inventory

## Usage

```javascript
const { Api } = require('@friggframework/api-module-square');

// Initialize with credentials
const squareApi = new Api({
    client_id: process.env.SQUARE_CLIENT_ID,
    client_secret: process.env.SQUARE_CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URI + '/square',
    scope: 'MERCHANT_PROFILE_READ PAYMENTS_READ PAYMENTS_WRITE',
    sandbox: process.env.SQUARE_SANDBOX === 'true'
});

// Get authorization URL
const authUrl = squareApi.getAuthUri();

// Exchange code for tokens
const tokens = await squareApi.getTokenFromCode(authorizationCode);

// Create a payment
const payment = await squareApi.createSimplePayment(
    1000, // $10.00 in cents
    'USD',
    'card-nonce-from-frontend',
    'location-id'
);
```

## Available Methods

### Merchants Methods
- `listMerchants()` - List merchant accounts

### Locations Methods
- `listLocations()` - List business locations
- `getLocation(locationId)` - Get specific location
- `updateLocation(locationId, locationData)` - Update location information

### Payments Methods
- `listPayments(params)` - List payments with filters
- `createPayment(paymentData)` - Process a payment
- `getPayment(paymentId)` - Get payment details
- `cancelPayment(paymentId)` - Cancel payment
- `completePayment(paymentId)` - Complete payment
- `createSimplePayment(amount, currency, sourceId, locationId)` - Helper for simple payments

### Orders Methods
- `createOrder(orderData)` - Create new order
- `searchOrders(searchQuery)` - Search orders
- `batchRetrieveOrders(orderIds, locationId)` - Get multiple orders
- `updateOrder(orderId, orderData)` - Update order
- `payOrder(orderId, paymentData)` - Pay for order

### Catalog Methods
- `listCatalog(params)` - List catalog items
- `searchCatalogObjects(searchQuery)` - Search catalog
- `getCatalogObject(objectId, includeRelatedObjects)` - Get catalog item
- `batchUpsertCatalogObjects(objects)` - Create/update catalog items
- `batchDeleteCatalogObjects(objectIds)` - Delete catalog items

### Inventory Methods
- `adjustInventory(adjustmentData)` - Adjust inventory count
- `batchChangeInventory(changes)` - Batch inventory changes
- `batchRetrieveInventoryCount(catalogObjectIds, locationIds)` - Get inventory counts

### Customers Methods
- `listCustomers(params)` - List customers
- `createCustomer(customerData)` - Create new customer
- `getCustomer(customerId)` - Get customer details
- `updateCustomer(customerId, customerData)` - Update customer
- `deleteCustomer(customerId)` - Delete customer
- `searchCustomers(searchQuery)` - Search customers

### Invoices Methods
- `listInvoices(params)` - List invoices
- `createInvoice(invoiceData)` - Create new invoice
- `getInvoice(invoiceId)` - Get invoice details
- `updateInvoice(invoiceId, invoiceData)` - Update invoice
- `deleteInvoice(invoiceId, version)` - Delete invoice
- `sendInvoice(invoiceId, requestData)` - Send invoice to customer
- `cancelInvoice(invoiceId, version)` - Cancel invoice

### Refunds Methods
- `listRefunds(params)` - List refunds
- `createRefund(refundData)` - Process refund
- `getRefund(refundId)` - Get refund details

### Webhooks Methods
- `listWebhookSubscriptions()` - List webhook subscriptions
- `createWebhookSubscription(subscriptionData)` - Create webhook
- `getWebhookSubscription(subscriptionId)` - Get webhook details
- `updateWebhookSubscription(subscriptionId, subscriptionData)` - Update webhook
- `deleteWebhookSubscription(subscriptionId)` - Delete webhook

## Usage Examples

### Processing a Payment
```javascript
// Create a payment with card nonce from Square's frontend SDK
const paymentData = {
    idempotency_key: 'unique-key-' + Date.now(),
    amount_money: {
        amount: 1000, // $10.00 in cents
        currency: 'USD'
    },
    source_id: 'card-nonce-from-frontend',
    location_id: 'location-id',
    buyer_email_address: 'customer@example.com'
};

const payment = await squareApi.createPayment(paymentData);
```

### Creating an Order
```javascript
const orderData = {
    idempotency_key: 'order-key-' + Date.now(),
    order: {
        location_id: 'location-id',
        line_items: [
            {
                quantity: '1',
                catalog_object_id: 'item-catalog-id',
                modifiers: []
            }
        ]
    }
};

const order = await squareApi.createOrder(orderData);
```

### Creating a Customer
```javascript
const customerData = {
    given_name: 'John',
    family_name: 'Doe',
    email_address: 'john.doe@example.com',
    phone_number: '+15551234567'
};

const customer = await squareApi.createCustomer(customerData);
```

### Setting up Webhooks
```javascript
const subscriptionData = {
    idempotency_key: 'webhook-key-' + Date.now(),
    subscription: {
        name: 'Payment Notifications',
        event_types: [
            'payment.created',
            'payment.updated'
        ],
        notification_url: 'https://yoursite.com/webhooks/square',
        api_version: '2023-10-18'
    }
};

const webhook = await squareApi.createWebhookSubscription(subscriptionData);
```

### Adding Catalog Items
```javascript
const catalogItems = [
    {
        type: 'ITEM',
        id: '#item-1',
        item_data: {
            name: 'Coffee',
            description: 'Freshly brewed coffee',
            variations: [
                {
                    type: 'ITEM_VARIATION',
                    id: '#variation-1',
                    item_variation_data: {
                        item_id: '#item-1',
                        name: 'Regular',
                        pricing_type: 'FIXED_PRICING',
                        price_money: {
                            amount: 300, // $3.00
                            currency: 'USD'
                        }
                    }
                }
            ]
        }
    }
];

const result = await squareApi.batchUpsertCatalogObjects(catalogItems);
```

## Authentication Flow

Square uses OAuth2:

1. Redirect users to Square's authorization URL
2. Handle the callback with the authorization code
3. Exchange the code for access and refresh tokens
4. Use tokens for API requests

## Error Handling

Square returns detailed error information. Always wrap API calls in try-catch blocks:

```javascript
try {
    const payment = await squareApi.createPayment(paymentData);
    console.log('Payment processed:', payment.payment.id);
} catch (error) {
    console.error('Square error:', error.message);
    if (error.errors) {
        error.errors.forEach(err => {
            console.error('Error detail:', err.detail);
        });
    }
}
```

## Testing

Use Square's sandbox environment for testing:
- Test credit card numbers are available in Square's documentation
- All transactions in sandbox are simulated
- Use Square Sandbox dashboard to view test data

## Webhooks

Square sends webhooks for various events. Important event types include:
- `payment.created` - Payment created
- `payment.updated` - Payment status changed
- `order.created` - Order created
- `order.updated` - Order modified
- `invoice.payment_made` - Invoice paid

## Documentation

For detailed Square API documentation, visit: https://developer.squareup.com/docs