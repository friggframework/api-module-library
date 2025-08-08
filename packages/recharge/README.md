# Recharge

This is the API Module for Recharge that allows the [Frigg](https://friggframework.org) code to talk to the Recharge API.

Read more on the [Frigg documentation site](https://docs.friggframework.org/api-modules/list/recharge) (soon to come)

## Overview

Recharge is a subscription payments platform designed for businesses selling subscription products. This API module provides comprehensive access to Recharge's API v2021-11, enabling you to manage customers, subscriptions, orders, charges, products, and more.

## Installation

```bash
npm install @friggframework/api-module-recharge
```

## Configuration

Set the following environment variable:
- `RECHARGE_API_KEY`: Your Recharge API key

You can obtain your API key from your Recharge admin dashboard under Settings > API Tokens.

## Usage

```javascript
const { Api } = require('@friggframework/api-module-recharge');

// Initialize the API with your credentials
const rechargeApi = new Api({
    api_key: process.env.RECHARGE_API_KEY
});

// Test authentication
const authResult = await rechargeApi.testAuth();
if (authResult.success) {
    console.log('Authentication successful!');
}

// Get shop details
const shop = await rechargeApi.getShop();

// List customers with pagination
const customers = await rechargeApi.listCustomers({
    page: 1,
    limit: 50,
    sort_by: 'created_at',
    direction: 'desc'
});

// Get a specific customer
const customer = await rechargeApi.getCustomer('customer_id');

// Create a new customer
const newCustomer = await rechargeApi.createCustomer({
    email: 'customer@example.com',
    first_name: 'John',
    last_name: 'Doe'
});
```

## Available Methods

### Shop
- `getShop()` - Get shop details

### Customers
- `listCustomers(options)` - List all customers with optional filters
- `getCustomer(customerId)` - Get a specific customer
- `createCustomer(customerData)` - Create a new customer
- `updateCustomer(customerId, customerData)` - Update an existing customer
- `deleteCustomer(customerId)` - Delete a customer

### Subscriptions
- `listSubscriptions(options)` - List all subscriptions with optional filters
- `getSubscription(subscriptionId)` - Get a specific subscription
- `createSubscription(subscriptionData)` - Create a new subscription
- `updateSubscription(subscriptionId, subscriptionData)` - Update a subscription
- `cancelSubscription(subscriptionId, cancelData)` - Cancel a subscription
- `activateSubscription(subscriptionId)` - Activate a cancelled subscription

### Orders
- `listOrders(options)` - List all orders with optional filters
- `getOrder(orderId)` - Get a specific order
- `updateOrder(orderId, orderData)` - Update an order

### Charges
- `listCharges(options)` - List all charges with optional filters
- `getCharge(chargeId)` - Get a specific charge

### Products
- `listProducts(options)` - List all products with optional filters
- `getProduct(productId)` - Get a specific product

### Addresses
- `listAddresses(options)` - List all addresses with optional filters
- `getAddress(addressId)` - Get a specific address
- `createAddress(addressData)` - Create a new address
- `updateAddress(addressId, addressData)` - Update an address
- `deleteAddress(addressId)` - Delete an address

### Webhooks
- `listWebhooks(options)` - List all webhooks with optional filters
- `getWebhook(webhookId)` - Get a specific webhook
- `createWebhook(webhookData)` - Create a new webhook
- `updateWebhook(webhookId, webhookData)` - Update a webhook
- `deleteWebhook(webhookId)` - Delete a webhook

### Authentication Testing
- `testAuth()` - Test API authentication

## Query Options

Most list methods support the following query options:
- `page` - Page number (default: 1)
- `limit` - Number of results per page (default: 50, max: 250)
- `sort_by` - Field to sort by
- `direction` - Sort direction ('asc' or 'desc')

Additional filters can be passed based on the specific endpoint requirements.

## Error Handling

The API module will throw errors for failed requests. Always wrap API calls in try-catch blocks:

```javascript
try {
    const customer = await rechargeApi.getCustomer('invalid_id');
} catch (error) {
    console.error('Error fetching customer:', error.message);
}
```

## API Version

This module uses Recharge API version 2021-11. The API version is automatically included in all requests via the `X-Recharge-Version` header.

## Rate Limiting

Recharge implements rate limiting on their API. Please refer to the [Recharge API documentation](https://developer.rechargepayments.com/v1-shopify) for current rate limits and best practices.

## Support

For more information about the Recharge API, visit the [official Recharge API documentation](https://developer.rechargepayments.com/).

For issues with this module, please refer to the [Frigg Framework documentation](https://docs.friggframework.org) or open an issue in the repository.