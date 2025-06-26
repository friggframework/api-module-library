# BigCommerce API Module

A comprehensive BigCommerce REST API v3 client for the Frigg Framework, supporting all major e-commerce operations including catalog management, orders, customers, and themes.

## Features

- **Catalog Management**: Products, variants, categories, brands, and attributes
- **Order Processing**: Complete order lifecycle management with refunds and shipments
- **Customer Management**: Customer data, addresses, and groups
- **Theme Management**: Theme upload, activation, and configuration
- **Store Management**: Settings, system status, and configuration
- **Webhook Support**: Event-driven integrations with signature verification
- **Authentication**: Support for both OAuth2 and Access Token authentication

## Installation

```bash
npm install @friggframework/api-module-bigcommerce
```

## Configuration

### Environment Variables

```env
BIGCOMMERCE_CLIENT_ID=your_client_id_here
BIGCOMMERCE_CLIENT_SECRET=your_client_secret_here
BIGCOMMERCE_ACCESS_TOKEN=your_access_token_here
BIGCOMMERCE_STORE_HASH=your_store_hash_here
```

### Authentication Setup

BigCommerce supports two authentication methods:

#### 1. OAuth2 (Recommended for Apps)
1. Create an app in the BigCommerce Developer Portal
2. Configure OAuth scopes and redirect URI
3. Use the OAuth flow to get access tokens

#### 2. Access Token (For Private Apps)
1. Go to your BigCommerce admin panel
2. Navigate to Advanced Settings > API Accounts
3. Create a new API account with required scopes
4. Copy the Access Token and Store Hash

## Usage

### Basic Setup

```javascript
const { Api } = require('@friggframework/api-module-bigcommerce');

// Using Access Token
const api = new Api({
    storeHash: 'your_store_hash',
    accessToken: 'your_access_token'
});

// Using OAuth2
const oauthApi = new Api({
    storeHash: 'your_store_hash',
    access_token: 'oauth_access_token'
});
```

### Products

```javascript
// Create a product
const product = await api.createProduct({
    name: 'Premium Widget',
    type: 'physical',
    weight: 1.5,
    price: 29.99,
    categories: [123],
    brand_id: 456,
    inventory_level: 100,
    inventory_warning_level: 10
});

// Get products with filtering
const products = await api.listProducts({
    limit: 50,
    'categories:in': '123,456',
    is_visible: true,
    availability: 'available'
});

// Update product
await api.updateProduct(product.data.id, {
    price: 34.99,
    inventory_level: 85
});

// Create product variant
const variant = await api.createProductVariant(product.data.id, {
    sku: 'WIDGET-RED-L',
    price: 32.99,
    weight: 1.5,
    option_values: [
        { option_display_name: 'Color', label: 'Red' },
        { option_display_name: 'Size', label: 'Large' }
    ]
});
```

### Categories

```javascript
// Create category
const category = await api.createCategory({
    name: 'Electronics',
    description: 'Electronic devices and accessories',
    parent_id: 0,
    sort_order: 1,
    is_visible: true
});

// Get category tree
const categoryTree = await api.getCategoryTree();

// Update category
await api.updateCategory(category.data.id, {
    description: 'Updated description',
    meta_title: 'Electronics - Your Store'
});
```

### Orders

```javascript
// Get orders
const orders = await api.listOrders({
    status_id: 11, // Awaiting Fulfillment
    limit: 100,
    'date_created:min': '2024-01-01T00:00:00Z'
});

// Get specific order
const order = await api.getOrderById(12345);

// Update order status
await api.updateOrder(12345, {
    status_id: 10 // Completed
});

// Get order products
const orderProducts = await api.getOrderProducts(12345);

// Create refund
await api.createOrderRefund(12345, {
    amount: 15.99,
    reason: 'Customer return',
    items: [
        {
            item_id: 123,
            item_type: 'PRODUCT',
            quantity: 1
        }
    ]
});
```

### Customers

```javascript
// Create customer
const customer = await api.createCustomer({
    email: 'customer@example.com',
    first_name: 'John',
    last_name: 'Doe',
    company: 'Example Corp',
    phone: '+1-555-123-4567',
    accepts_product_review_abandoned_cart_emails: true
});

// Get customers
const customers = await api.listCustomers({
    'email:like': '@example.com',
    limit: 50
});

// Add customer address
const address = await api.createCustomerAddress(customer.data.id, {
    first_name: 'John',
    last_name: 'Doe',
    company: 'Example Corp',
    address1: '123 Main St',
    city: 'New York',
    state_or_province: 'NY',
    postal_code: '10001',
    country_code: 'US',
    phone: '+1-555-123-4567'
});
```

### Themes

```javascript
// Get all themes
const themes = await api.listThemes();

// Upload new theme
const theme = await api.uploadTheme({
    file: themeZipBuffer, // Theme zip file as buffer
    name: 'Custom Theme',
    description: 'A custom theme for our store'
});

// Activate theme
await api.activateTheme(theme.data.id, {
    which: 'original', // or 'variation'
    variation_id: null
});

// Get theme configurations
const configs = await api.getThemeConfigurations(theme.data.id);
```

### Webhooks

```javascript
// Create webhook
const webhook = await api.createWebhook({
    scope: 'store/order/created',
    destination: 'https://your-app.com/webhooks/bigcommerce/order-created',
    is_active: true,
    events_history_enabled: true
});

// List webhooks
const webhooks = await api.listWebhooks();

// Verify webhook signature (in your webhook handler)
const isValid = api.verifyWebhookSignature(
    req.body,
    req.headers['x-bc-webhook-signature'],
    process.env.BIGCOMMERCE_CLIENT_SECRET
);

if (isValid) {
    console.log('Valid webhook received:', req.body);
}
```

### Store Management

```javascript
// Get store information
const storeInfo = await api.getStoreInfo();

// Get store profile settings
const profile = await api.getStoreProfile();

// Update store profile
await api.updateStoreProfile({
    store_name: 'My Updated Store',
    store_address: '456 Commerce St',
    store_city: 'Commerce City',
    store_zip: '12345'
});
```

## API Methods

### Products
- `createProduct(productData)`
- `listProducts(params)`
- `getProductById(id, params)`
- `updateProduct(id, productData)`
- `deleteProduct(id)`

### Product Variants
- `createProductVariant(productId, variantData)`
- `listProductVariants(productId, params)`
- `getProductVariantById(productId, variantId, params)`
- `updateProductVariant(productId, variantId, variantData)`
- `deleteProductVariant(productId, variantId)`

### Product Images
- `createProductImage(productId, imageData)`
- `listProductImages(productId, params)`
- `updateProductImage(productId, imageId, imageData)`
- `deleteProductImage(productId, imageId)`

### Categories
- `createCategory(categoryData)`
- `listCategories(params)`
- `getCategoryById(id, params)`
- `updateCategory(id, categoryData)`
- `deleteCategory(id)`
- `getCategoryTree()`

### Orders
- `createOrder(orderData)`
- `listOrders(params)`
- `getOrderById(id, params)`
- `updateOrder(id, orderData)`
- `deleteOrder(id)`
- `getOrderProducts(orderId, params)`
- `getOrderShippingAddresses(orderId, params)`
- `listOrderStatuses()`
- `createOrderRefund(orderId, refundData)`

### Customers
- `createCustomer(customerData)`
- `listCustomers(params)`
- `getCustomerById(id, params)`
- `updateCustomer(id, customerData)`
- `deleteCustomer(id)`
- `getCustomerAddresses(customerId, params)`
- `createCustomerAddress(customerId, addressData)`
- `updateCustomerAddress(customerId, addressId, addressData)`
- `deleteCustomerAddress(customerId, addressId)`

### Themes
- `listThemes()`
- `getThemeById(id)`
- `uploadTheme(themeData)`
- `downloadTheme(id)`
- `activateTheme(id, params)`
- `deleteTheme(id)`
- `getThemeConfigurations(id)`

### Brands
- `createBrand(brandData)`
- `listBrands(params)`
- `getBrandById(id, params)`
- `updateBrand(id, brandData)`
- `deleteBrand(id)`

### Webhooks
- `createWebhook(webhookData)`
- `listWebhooks(params)`
- `getWebhookById(id)`
- `updateWebhook(id, webhookData)`
- `deleteWebhook(id)`
- `verifyWebhookSignature(payload, signature, clientSecret)`

### Store Information
- `getStoreInfo()`
- `getTime()`
- `getTimezone()`
- `getSettings()`
- `getStoreProfile()`
- `updateStoreProfile(profileData)`

## Webhook Events

BigCommerce supports webhooks for the following events:

- `store/order/*` - Order events (created, updated, archived, etc.)
- `store/product/*` - Product events (created, updated, deleted, etc.)
- `store/customer/*` - Customer events (created, updated, deleted, etc.)
- `store/app/uninstalled` - App uninstallation
- `store/cart/abandoned` - Cart abandonment
- `store/category/*` - Category events
- `store/inventory/*` - Inventory events
- `store/shipment/*` - Shipment events

## Scopes

Common OAuth scopes for BigCommerce:

- `store_v2_default` - Default scope with basic read/write access
- `store_v2_products` - Product management
- `store_v2_orders` - Order management
- `store_v2_customers` - Customer management
- `store_v2_content` - Content management
- `store_v2_marketing` - Marketing features
- `store_v2_information` - Store information access

## Error Handling

```javascript
try {
    const product = await api.getProductById(123);
} catch (error) {
    if (error.response?.status === 404) {
        console.log('Product not found');
    } else if (error.response?.status === 429) {
        console.log('Rate limit exceeded');
    } else {
        console.error('API Error:', error.message);
    }
}
```

## Rate Limiting

BigCommerce API has rate limits:
- **Standard plans**: 20,000 API calls per hour
- **Plus plans**: 40,000 API calls per hour
- **Pro and Enterprise**: 60,000 API calls per hour

The module handles rate limiting automatically with appropriate retry strategies.

## Testing

```bash
npm test
```

## Contributing

Please read the [contributing guidelines](CONTRIBUTING.md) before submitting pull requests.

## License

MIT License - see [LICENSE](LICENSE.md) for details.