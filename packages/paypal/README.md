# PayPal API Module

A comprehensive PayPal REST API integration module for the Frigg Framework.

## Setup

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_SCOPE=openid profile email
PAYPAL_SANDBOX=true
REDIRECT_URI=your_redirect_uri_base
```

### Getting PayPal API Credentials

1. Go to the [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Sign in with your PayPal account
3. Create a new app or select an existing one
4. Get your Client ID and Client Secret
5. Set up your redirect URI (e.g., `https://yourdomain.com/paypal`)

### Sandbox vs Production

- Set `PAYPAL_SANDBOX=true` for testing with PayPal's sandbox environment
- Set `PAYPAL_SANDBOX=false` for production usage

## Usage

```javascript
const { Api } = require('@friggframework/api-module-paypal');

// Initialize with credentials
const paypalApi = new Api({
    client_id: process.env.PAYPAL_CLIENT_ID,
    client_secret: process.env.PAYPAL_CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URI + '/paypal',
    scope: 'openid profile email',
    sandbox: process.env.PAYPAL_SANDBOX === 'true'
});

// Get authorization URL
const authUrl = paypalApi.getAuthUri();

// Exchange code for tokens
const tokens = await paypalApi.getTokenFromCode(authorizationCode);

// Create a simple order
const order = await paypalApi.createSimpleOrder('10.00', 'USD', 'Test payment');

// Capture the order
const capture = await paypalApi.captureOrder(order.id);
```

## Available Methods

### Identity Methods
- `getUserInfo()` - Get user profile information

### Orders Methods
- `createOrder(orderData)` - Create a payment order
- `getOrder(orderId)` - Get order details
- `updateOrder(orderId, patchData)` - Update order
- `captureOrder(orderId, captureData)` - Capture authorized payment
- `authorizeOrder(orderId, authorizeData)` - Authorize payment
- `createSimpleOrder(amount, currency, description)` - Helper for simple orders

### Payments Methods
- `getPayment(paymentId)` - Get payment details

### Invoicing Methods
- `getInvoices(params)` - List invoices
- `createInvoice(invoiceData)` - Create new invoice
- `getInvoice(invoiceId)` - Get specific invoice
- `updateInvoice(invoiceId, invoiceData)` - Update invoice
- `deleteInvoice(invoiceId)` - Delete draft invoice
- `sendInvoice(invoiceId, sendData)` - Send invoice to recipient
- `cancelInvoice(invoiceId, cancelData)` - Cancel sent invoice

### Subscriptions Methods
- `createSubscription(subscriptionData)` - Create subscription
- `getSubscription(subscriptionId)` - Get subscription details
- `updateSubscription(subscriptionId, patchData)` - Update subscription
- `activateSubscription(subscriptionId, reason)` - Activate subscription
- `cancelSubscription(subscriptionId, reason)` - Cancel subscription
- `suspendSubscription(subscriptionId, reason)` - Suspend subscription

### Plans Methods
- `getPlans(params)` - List billing plans
- `createPlan(planData)` - Create billing plan
- `getPlan(planId)` - Get plan details
- `updatePlan(planId, patchData)` - Update plan
- `activatePlan(planId)` - Activate plan
- `deactivatePlan(planId)` - Deactivate plan

### Products Methods
- `getProducts(params)` - List products
- `createProduct(productData)` - Create product
- `getProduct(productId)` - Get product details
- `updateProduct(productId, patchData)` - Update product

### Webhooks Methods
- `getWebhooks()` - List webhooks
- `createWebhook(webhookData)` - Create webhook
- `getWebhook(webhookId)` - Get webhook details
- `updateWebhook(webhookId, patchData)` - Update webhook
- `deleteWebhook(webhookId)` - Delete webhook
- `getWebhookEventTypes()` - Get available event types

### Disputes Methods
- `getDisputes(params)` - List disputes
- `getDispute(disputeId)` - Get dispute details

### Payouts Methods
- `createPayout(payoutData)` - Create batch payout
- `getPayout(payoutBatchId)` - Get payout batch details
- `getPayoutItem(payoutItemId)` - Get payout item details

## Usage Examples

### Creating and Capturing an Order
```javascript
// Create order
const orderData = {
    intent: 'CAPTURE',
    purchase_units: [
        {
            amount: {
                currency_code: 'USD',
                value: '100.00'
            },
            description: 'Product purchase'
        }
    ],
    application_context: {
        return_url: 'https://yoursite.com/return',
        cancel_url: 'https://yoursite.com/cancel'
    }
};

const order = await paypalApi.createOrder(orderData);

// Get approval URL from order.links
const approvalUrl = order.links.find(link => link.rel === 'approve').href;

// After user approves, capture the order
const capture = await paypalApi.captureOrder(order.id);
```

### Creating an Invoice
```javascript
const invoiceData = {
    detail: {
        invoice_number: 'INV-001',
        currency_code: 'USD'
    },
    invoicer: {
        name: {
            given_name: 'John',
            surname: 'Doe'
        },
        email_address: 'seller@example.com'
    },
    primary_recipients: [
        {
            billing_info: {
                email_address: 'buyer@example.com'
            }
        }
    ],
    items: [
        {
            name: 'Product Name',
            quantity: '1',
            unit_amount: {
                currency_code: 'USD',
                value: '100.00'
            }
        }
    ]
};

const invoice = await paypalApi.createInvoice(invoiceData);
await paypalApi.sendInvoice(invoice.id);
```

### Creating a Subscription Plan
```javascript
// First create a product
const productData = {
    name: 'Monthly Service',
    description: 'Monthly subscription service',
    type: 'SERVICE',
    category: 'SOFTWARE'
};

const product = await paypalApi.createProduct(productData);

// Then create a plan
const planData = {
    product_id: product.id,
    name: 'Monthly Plan',
    description: 'Monthly subscription plan',
    billing_cycles: [
        {
            frequency: {
                interval_unit: 'MONTH',
                interval_count: 1
            },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
                fixed_price: {
                    value: '29.99',
                    currency_code: 'USD'
                }
            }
        }
    ],
    payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 3
    }
};

const plan = await paypalApi.createPlan(planData);
```

### Setting up Webhooks
```javascript
const webhookData = {
    url: 'https://yoursite.com/webhooks/paypal',
    event_types: [
        { name: 'PAYMENT.CAPTURE.COMPLETED' },
        { name: 'PAYMENT.CAPTURE.DENIED' },
        { name: 'BILLING.SUBSCRIPTION.CREATED' },
        { name: 'BILLING.SUBSCRIPTION.CANCELLED' }
    ]
};

const webhook = await paypalApi.createWebhook(webhookData);
```

## Authentication Flow

PayPal uses OAuth2 with a unique authorization flow:

1. Redirect users to PayPal's authorization URL
2. Handle the callback with the authorization code
3. Exchange the code for access and refresh tokens
4. Use tokens for API requests

## Error Handling

PayPal returns detailed error information. Always wrap API calls in try-catch blocks:

```javascript
try {
    const order = await paypalApi.createOrder(orderData);
    console.log('Order created:', order.id);
} catch (error) {
    console.error('PayPal error:', error.message);
    // Handle specific error types
    if (error.details) {
        error.details.forEach(detail => {
            console.error('Error detail:', detail.description);
        });
    }
}
```

## Testing

Use PayPal's sandbox environment for testing:
- Test credit card numbers are available in PayPal's documentation
- All transactions in sandbox are simulated
- Use sandbox.paypal.com for buyer accounts

## Webhooks

PayPal sends webhooks for various events. Important event types include:
- `PAYMENT.CAPTURE.COMPLETED` - Payment completed
- `PAYMENT.CAPTURE.DENIED` - Payment denied
- `BILLING.SUBSCRIPTION.CREATED` - Subscription created
- `BILLING.SUBSCRIPTION.CANCELLED` - Subscription cancelled

## Documentation

For detailed PayPal API documentation, visit: https://developer.paypal.com/docs/api/overview/