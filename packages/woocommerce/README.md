# WooCommerce API Module

A comprehensive WooCommerce REST API v3 client for the Frigg Framework, supporting all major e-commerce operations including products, orders, customers, webhooks, and inventory management.

## Features

- **Products Management**: Create, read, update, delete products and variations
- **Order Processing**: Complete order lifecycle management with notes and refunds
- **Customer Management**: Customer data and download tracking
- **Inventory Control**: Stock quantity management for products and variations
- **Webhook Support**: Event-driven integrations with signature verification
- **Reporting**: Sales reports and top sellers analytics
- **Settings & Configuration**: Store settings management
- **Authentication**: Support for both HTTP (OAuth 1.0a) and HTTPS (Basic Auth)

## Installation

```bash
npm install @friggframework/api-module-woocommerce
```

## Configuration

### Environment Variables

```env
WOOCOMMERCE_CONSUMER_KEY=ck_your_consumer_key_here
WOOCOMMERCE_CONSUMER_SECRET=cs_your_consumer_secret_here
WOOCOMMERCE_BASE_URL=https://your-store.com
```

### Authentication Setup

1. Go to your WooCommerce admin dashboard
2. Navigate to WooCommerce > Settings > Advanced > REST API
3. Click "Add key"
4. Set description and user
5. Select permissions (Read, Write, or Read/Write)
6. Copy the generated Consumer Key and Consumer Secret

## Usage

### Basic Setup

```javascript
const { Api } = require('@friggframework/api-module-woocommerce');

const api = new Api({
    baseUrl: 'https://your-store.com',
    consumer_key: 'ck_your_consumer_key',
    consumer_secret: 'cs_your_consumer_secret'
});
```

### Products

```javascript
// Create a product
const product = await api.createProduct({
    name: 'Premium T-Shirt',
    type: 'simple',
    regular_price: '29.99',
    description: 'High-quality cotton t-shirt',
    short_description: 'Premium cotton tee',
    categories: [{ id: 1 }],
    manage_stock: true,
    stock_quantity: 100
});

// Get all products
const products = await api.listProducts({
    per_page: 20,
    status: 'publish'
});

// Update product
await api.updateProduct(product.id, {
    regular_price: '34.99',
    stock_quantity: 85
});

// Update stock quantity only
await api.updateProductStock(product.id, 75);
```

### Orders

```javascript
// Get orders
const orders = await api.listOrders({
    status: 'processing',
    per_page: 50
});

// Get specific order
const order = await api.getOrderById(123);

// Update order status
await api.updateOrder(123, {
    status: 'completed'
});

// Add order note
await api.createOrderNote(123, {
    note: 'Package shipped via FedEx',
    customer_note: true
});

// Create refund
await api.createOrderRefund(123, {
    amount: '15.99',
    reason: 'Defective item'
});
```

### Customers

```javascript
// Create customer
const customer = await api.createCustomer({
    email: 'customer@example.com',
    first_name: 'John',
    last_name: 'Doe',
    billing: {
        first_name: 'John',
        last_name: 'Doe',
        company: '',
        address_1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postcode: '10001',
        country: 'US',
        email: 'customer@example.com',
        phone: '555-123-4567'
    }
});

// Get customers
const customers = await api.listCustomers({
    role: 'customer',
    orderby: 'registered_date'
});
```

### Webhooks

```javascript
// Create webhook
const webhook = await api.createWebhook({
    name: 'Order Created',
    topic: 'order.created',
    delivery_url: 'https://your-app.com/webhooks/woocommerce/order-created',
    secret: 'your-webhook-secret'
});

// Verify webhook signature (in your webhook handler)
const isValid = api.verifyWebhookSignature(
    req.body,
    req.headers['x-wc-webhook-signature'],
    'your-webhook-secret'
);

if (isValid) {
    // Process webhook payload
    console.log('Valid webhook received:', req.body);
}
```

### Inventory Management

```javascript
// Update product stock
await api.updateProductStock(productId, 50, true); // quantity: 50, manage_stock: true

// Update variation stock
await api.updateVariationStock(productId, variationId, 25);

// Bulk update products
await api.batchUpdateProducts({
    create: [
        { name: 'New Product 1', regular_price: '19.99' },
        { name: 'New Product 2', regular_price: '24.99' }
    ],
    update: [
        { id: 123, stock_quantity: 30 }
    ]
});
```

### Reports

```javascript
// Get sales report
const salesReport = await api.getSalesReport({
    period: 'week',
    date_min: '2024-01-01',
    date_max: '2024-01-31'
});

// Get top sellers
const topSellers = await api.getTopSellersReport({
    period: 'month',
    limit: 10
});
```

## API Methods

### Products
- `createProduct(productData)`
- `listProducts(params)`
- `getProductById(id)`
- `updateProduct(id, productData)`
- `deleteProduct(id, force)`
- `batchUpdateProducts(data)`
- `updateProductStock(productId, stockQuantity, manageStock)`

### Product Variations
- `createProductVariation(productId, variationData)`
- `listProductVariations(productId, params)`
- `getProductVariationById(productId, variationId)`
- `updateProductVariation(productId, variationId, variationData)`
- `deleteProductVariation(productId, variationId, force)`
- `updateVariationStock(productId, variationId, stockQuantity, manageStock)`

### Orders
- `createOrder(orderData)`
- `listOrders(params)`
- `getOrderById(id)`
- `updateOrder(id, orderData)`
- `deleteOrder(id, force)`
- `batchUpdateOrders(data)`

### Order Notes
- `createOrderNote(orderId, noteData)`
- `listOrderNotes(orderId, params)`
- `getOrderNoteById(orderId, noteId)`
- `deleteOrderNote(orderId, noteId, force)`

### Order Refunds
- `createOrderRefund(orderId, refundData)`
- `listOrderRefunds(orderId, params)`
- `getOrderRefundById(orderId, refundId)`
- `deleteOrderRefund(orderId, refundId, force)`

### Customers
- `createCustomer(customerData)`
- `listCustomers(params)`
- `getCustomerById(id)`
- `updateCustomer(id, customerData)`
- `deleteCustomer(id, force)`
- `batchUpdateCustomers(data)`
- `getCustomerDownloads(customerId)`

### Webhooks
- `createWebhook(webhookData)`
- `listWebhooks(params)`
- `getWebhookById(id)`
- `updateWebhook(id, webhookData)`
- `deleteWebhook(id, force)`
- `getWebhookDeliveries(webhookId)`
- `verifyWebhookSignature(payload, signature, secret)`

### Reports
- `getSalesReport(params)`
- `getTopSellersReport(params)`

### Settings
- `getSettings(params)`
- `getSettingsByGroup(groupId)`
- `updateSetting(groupId, settingId, value)`

### System
- `getSystemStatus()`
- `getSystemStatusTools()`

## Webhook Events

WooCommerce supports the following webhook topics:

- `coupon.created`, `coupon.updated`, `coupon.deleted`
- `customer.created`, `customer.updated`, `customer.deleted`
- `order.created`, `order.updated`, `order.deleted`
- `product.created`, `product.updated`, `product.deleted`
- `action.{hook_name}` - Custom action hooks

## Error Handling

```javascript
try {
    const product = await api.getProductById(123);
} catch (error) {
    if (error.response?.status === 404) {
        console.log('Product not found');
    } else {
        console.error('API Error:', error.message);
    }
}
```

## Rate Limiting

WooCommerce REST API has rate limits:
- **Per minute**: 60 requests for authenticated users
- **Per hour**: 3600 requests for authenticated users

The module will handle rate limit responses automatically with appropriate backoff strategies.

## Testing

```bash
npm test
```

## Contributing

Please read the [contributing guidelines](CONTRIBUTING.md) before submitting pull requests.

## License

MIT License - see [LICENSE](LICENSE.md) for details.