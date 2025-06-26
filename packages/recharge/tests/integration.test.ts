import { Api } from '../api';
import config from '../defaultConfig.json';
import nock from 'nock';

describe(`${config.label} Integration tests`, () => {
    let api: Api;
    const mockApiKey = 'test-api-key-123456789';
    const baseUrl = 'https://api.rechargeapps.com';

    beforeEach(() => {
        api = new Api({ api_key: mockApiKey });
        nock.cleanAll();
    });

    afterEach(() => {
        nock.cleanAll();
    });

    const expectAuthHeaders = (headers: any) => {
        expect(headers['x-recharge-access-token']).toBe(mockApiKey);
        expect(headers['x-recharge-version']).toBe('2021-11');
        expect(headers['content-type']).toBe('application/json');
        expect(headers['accept']).toBe('application/json');
        return true;
    };

    // **************************   Error Handling  **********************************

    describe('Error handling', () => {
        it('Should handle 401 unauthorized errors', async () => {
            nock(baseUrl)
                .get('/shop')
                .reply(401, {
                    error: 'Unauthorized',
                    message: 'Invalid API key'
                });

            await expect(api.getShop()).rejects.toThrow();
        });

        it('Should handle 404 not found errors', async () => {
            nock(baseUrl)
                .get('/customers/non-existent-id')
                .reply(404, {
                    error: 'Not Found',
                    message: 'Customer not found'
                });

            await expect(api.getCustomer('non-existent-id')).rejects.toThrow();
        });

        it('Should handle 422 validation errors', async () => {
            nock(baseUrl)
                .post('/customers')
                .reply(422, {
                    error: 'Unprocessable Entity',
                    errors: {
                        email: ['is invalid'],
                        first_name: ['is required']
                    }
                });

            await expect(api.createCustomer({ email: 'invalid' })).rejects.toThrow();
        });

        it('Should handle 429 rate limit errors', async () => {
            nock(baseUrl)
                .get('/customers')
                .reply(429, {
                    error: 'Too Many Requests',
                    message: 'Rate limit exceeded'
                });

            await expect(api.listCustomers()).rejects.toThrow();
        });

        it('Should handle 500 server errors', async () => {
            nock(baseUrl)
                .get('/customers')
                .reply(500, {
                    error: 'Internal Server Error',
                    message: 'Something went wrong'
                });

            await expect(api.listCustomers()).rejects.toThrow();
        });
    });

    // **************************   Authentication  **********************************

    describe('Authentication flow', () => {
        it('Should successfully authenticate with valid API key', async () => {
            const mockShopResponse = {
                shop: {
                    id: 12345,
                    name: 'Test Shop',
                    email: 'test@shop.com',
                    domain: 'test-shop.myshopify.com',
                    currency: 'USD',
                    timezone: 'America/New_York'
                }
            };

            nock(baseUrl)
                .get('/shop')
                .matchHeader('x-recharge-access-token', mockApiKey)
                .reply(200, mockShopResponse);

            const result = await api.testAuth();
            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockShopResponse);
        });

        it('Should fail authentication with invalid API key', async () => {
            nock(baseUrl)
                .get('/shop')
                .reply(401, {
                    error: 'Unauthorized',
                    message: 'Invalid API key'
                });

            const result = await api.testAuth();
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    // **************************   Customer Integration  **********************************

    describe('Customer integration', () => {
        it('Should perform full customer CRUD operations', async () => {
            const customerId = '123456';
            const createData = {
                email: 'test@example.com',
                first_name: 'John',
                last_name: 'Doe',
                billing_address1: '123 Main St',
                billing_city: 'New York',
                billing_province: 'NY',
                billing_zip: '10001',
                billing_country: 'United States'
            };

            const createdCustomer = {
                customer: {
                    id: customerId,
                    ...createData,
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z'
                }
            };

            // Create customer
            nock(baseUrl)
                .post('/customers', createData)
                .matchHeader(expectAuthHeaders)
                .reply(201, createdCustomer);

            const createResponse = await api.createCustomer(createData);
            expect(createResponse).toEqual(createdCustomer);

            // Read customer
            nock(baseUrl)
                .get(`/customers/${customerId}`)
                .matchHeader(expectAuthHeaders)
                .reply(200, createdCustomer);

            const getResponse = await api.getCustomer(customerId);
            expect(getResponse).toEqual(createdCustomer);

            // Update customer
            const updateData = { first_name: 'Jane' };
            const updatedCustomer = {
                customer: {
                    ...createdCustomer.customer,
                    first_name: 'Jane',
                    updated_at: '2024-01-02T00:00:00Z'
                }
            };

            nock(baseUrl)
                .put(`/customers/${customerId}`, updateData)
                .matchHeader(expectAuthHeaders)
                .reply(200, updatedCustomer);

            const updateResponse = await api.updateCustomer(customerId, updateData);
            expect(updateResponse).toEqual(updatedCustomer);

            // Delete customer
            nock(baseUrl)
                .delete(`/customers/${customerId}`)
                .matchHeader(expectAuthHeaders)
                .reply(204);

            const deleteResponse = await api.deleteCustomer(customerId);
            expect(deleteResponse).toBeUndefined();
        });

        it('Should list customers with pagination', async () => {
            const mockResponse = {
                customers: [
                    { id: '1', email: 'customer1@example.com' },
                    { id: '2', email: 'customer2@example.com' }
                ],
                meta: {
                    page: 1,
                    limit: 50,
                    total: 2
                }
            };

            nock(baseUrl)
                .get('/customers')
                .query({ page: 1, limit: 50 })
                .matchHeader(expectAuthHeaders)
                .reply(200, mockResponse);

            const response = await api.listCustomers({ page: 1, limit: 50 });
            expect(response).toEqual(mockResponse);
        });
    });

    // **************************   Subscription Integration  **********************************

    describe('Subscription integration', () => {
        it('Should create and manage subscription lifecycle', async () => {
            const subscriptionId = '789012';
            const customerId = '123456';
            const addressId = '456789';

            const createData = {
                address_id: addressId,
                customer_id: customerId,
                next_charge_scheduled_at: '2024-02-01',
                charge_interval_frequency: 30,
                order_interval_frequency: 30,
                order_interval_unit: 'day',
                shopify_product_id: '1234567890',
                quantity: 1,
                price: 29.99
            };

            const createdSubscription = {
                subscription: {
                    id: subscriptionId,
                    ...createData,
                    status: 'active',
                    created_at: '2024-01-01T00:00:00Z'
                }
            };

            // Create subscription
            nock(baseUrl)
                .post('/subscriptions', createData)
                .matchHeader(expectAuthHeaders)
                .reply(201, createdSubscription);

            const createResponse = await api.createSubscription(createData);
            expect(createResponse).toEqual(createdSubscription);

            // Update subscription quantity
            const updateData = { quantity: 2 };
            const updatedSubscription = {
                subscription: {
                    ...createdSubscription.subscription,
                    quantity: 2
                }
            };

            nock(baseUrl)
                .put(`/subscriptions/${subscriptionId}`, updateData)
                .matchHeader(expectAuthHeaders)
                .reply(200, updatedSubscription);

            const updateResponse = await api.updateSubscription(subscriptionId, updateData);
            expect(updateResponse).toEqual(updatedSubscription);

            // Cancel subscription
            const cancelledSubscription = {
                subscription: {
                    ...updatedSubscription.subscription,
                    status: 'cancelled',
                    cancelled_at: '2024-01-15T00:00:00Z'
                }
            };

            nock(baseUrl)
                .post(`/subscriptions/${subscriptionId}/cancel`)
                .matchHeader(expectAuthHeaders)
                .reply(200, cancelledSubscription);

            const cancelResponse = await api.cancelSubscription(subscriptionId);
            expect(cancelResponse).toEqual(cancelledSubscription);
        });

        it('Should handle subscription actions (skip, pause, activate)', async () => {
            const subscriptionId = '789012';

            // Skip subscription
            nock(baseUrl)
                .post(`/subscriptions/${subscriptionId}/skip`)
                .matchHeader(expectAuthHeaders)
                .reply(200, { subscription: { id: subscriptionId, status: 'active' } });

            // Pause subscription
            nock(baseUrl)
                .post(`/subscriptions/${subscriptionId}/pause`)
                .matchHeader(expectAuthHeaders)
                .reply(200, { subscription: { id: subscriptionId, status: 'paused' } });

            // Activate subscription
            nock(baseUrl)
                .post(`/subscriptions/${subscriptionId}/activate`)
                .matchHeader(expectAuthHeaders)
                .reply(200, { subscription: { id: subscriptionId, status: 'active' } });

            const activateResponse = await api.activateSubscription(subscriptionId);
            expect(activateResponse).toEqual({ subscription: { id: subscriptionId, status: 'active' } });
        });
    });

    // **************************   Order Integration  **********************************

    describe('Order integration', () => {
        it('Should list and retrieve orders', async () => {
            const orderId = '345678';
            const customerId = '123456';

            const orderData = {
                order: {
                    id: orderId,
                    customer_id: customerId,
                    email: 'test@example.com',
                    total_price: 59.98,
                    status: 'success',
                    created_at: '2024-01-01T00:00:00Z'
                }
            };

            // List orders with filters
            const listResponse = {
                orders: [orderData.order],
                meta: { page: 1, limit: 50, total: 1 }
            };

            nock(baseUrl)
                .get('/orders')
                .query({ customer_id: customerId, status: 'success' })
                .matchHeader(expectAuthHeaders)
                .reply(200, listResponse);

            const orders = await api.listOrders({ customer_id: customerId, status: 'success' });
            expect(orders).toEqual(listResponse);

            // Get specific order
            nock(baseUrl)
                .get(`/orders/${orderId}`)
                .matchHeader(expectAuthHeaders)
                .reply(200, orderData);

            const order = await api.getOrder(orderId);
            expect(order).toEqual(orderData);
        });
    });

    // **************************   Address Integration  **********************************

    describe('Address integration', () => {
        it('Should manage customer addresses', async () => {
            const addressId = '456789';
            const customerId = '123456';

            const addressData = {
                customer_id: customerId,
                address1: '123 Main St',
                address2: 'Apt 4B',
                city: 'New York',
                province: 'NY',
                zip: '10001',
                country: 'United States',
                first_name: 'John',
                last_name: 'Doe',
                phone: '555-1234'
            };

            const createdAddress = {
                address: {
                    id: addressId,
                    ...addressData,
                    created_at: '2024-01-01T00:00:00Z'
                }
            };

            // Create address
            nock(baseUrl)
                .post('/addresses', addressData)
                .matchHeader(expectAuthHeaders)
                .reply(201, createdAddress);

            const createResponse = await api.createAddress(addressData);
            expect(createResponse).toEqual(createdAddress);

            // Update address
            const updateData = { address1: '456 Oak Ave' };
            const updatedAddress = {
                address: {
                    ...createdAddress.address,
                    address1: '456 Oak Ave'
                }
            };

            nock(baseUrl)
                .put(`/addresses/${addressId}`, updateData)
                .matchHeader(expectAuthHeaders)
                .reply(200, updatedAddress);

            const updateResponse = await api.updateAddress(addressId, updateData);
            expect(updateResponse).toEqual(updatedAddress);

            // Delete address
            nock(baseUrl)
                .delete(`/addresses/${addressId}`)
                .matchHeader(expectAuthHeaders)
                .reply(204);

            const deleteResponse = await api.deleteAddress(addressId);
            expect(deleteResponse).toBeUndefined();
        });
    });

    // **************************   Webhook Integration  **********************************

    describe('Webhook integration', () => {
        it('Should manage webhooks', async () => {
            const webhookId = '987654';
            const webhookData = {
                address: 'https://example.com/webhooks/recharge',
                topic: 'subscription/created'
            };

            const createdWebhook = {
                webhook: {
                    id: webhookId,
                    ...webhookData,
                    created_at: '2024-01-01T00:00:00Z'
                }
            };

            // Create webhook
            nock(baseUrl)
                .post('/webhooks', webhookData)
                .matchHeader(expectAuthHeaders)
                .reply(201, createdWebhook);

            const createResponse = await api.createWebhook(webhookData);
            expect(createResponse).toEqual(createdWebhook);

            // List webhooks
            const listResponse = {
                webhooks: [createdWebhook.webhook],
                meta: { page: 1, limit: 50, total: 1 }
            };

            nock(baseUrl)
                .get('/webhooks')
                .matchHeader(expectAuthHeaders)
                .reply(200, listResponse);

            const webhooks = await api.listWebhooks();
            expect(webhooks).toEqual(listResponse);

            // Delete webhook
            nock(baseUrl)
                .delete(`/webhooks/${webhookId}`)
                .matchHeader(expectAuthHeaders)
                .reply(204);

            const deleteResponse = await api.deleteWebhook(webhookId);
            expect(deleteResponse).toBeUndefined();
        });
    });

    // **************************   Pagination  **********************************

    describe('Pagination handling', () => {
        it('Should handle paginated responses correctly', async () => {
            const page1Response = {
                customers: [
                    { id: '1', email: 'customer1@example.com' },
                    { id: '2', email: 'customer2@example.com' }
                ],
                meta: {
                    page: 1,
                    limit: 2,
                    total: 4,
                    pages: 2
                }
            };

            const page2Response = {
                customers: [
                    { id: '3', email: 'customer3@example.com' },
                    { id: '4', email: 'customer4@example.com' }
                ],
                meta: {
                    page: 2,
                    limit: 2,
                    total: 4,
                    pages: 2
                }
            };

            // Page 1
            nock(baseUrl)
                .get('/customers')
                .query({ page: 1, limit: 2 })
                .matchHeader(expectAuthHeaders)
                .reply(200, page1Response);

            const page1 = await api.listCustomers({ page: 1, limit: 2 });
            expect(page1).toEqual(page1Response);

            // Page 2
            nock(baseUrl)
                .get('/customers')
                .query({ page: 2, limit: 2 })
                .matchHeader(expectAuthHeaders)
                .reply(200, page2Response);

            const page2 = await api.listCustomers({ page: 2, limit: 2 });
            expect(page2).toEqual(page2Response);
        });
    });

    // **************************   Bulk Operations  **********************************

    describe('Bulk operations', () => {
        it('Should handle multiple operations in sequence', async () => {
            const customerId = '123456';
            const addressId = '456789';
            const subscriptionIds = ['789012', '789013', '789014'];

            // Mock customer with multiple subscriptions
            const customerResponse = {
                customer: {
                    id: customerId,
                    email: 'bulk@example.com',
                    subscriptions_count: 3
                }
            };

            nock(baseUrl)
                .get(`/customers/${customerId}`)
                .matchHeader(expectAuthHeaders)
                .reply(200, customerResponse);

            // Mock subscriptions list
            const subscriptionsResponse = {
                subscriptions: subscriptionIds.map(id => ({
                    id,
                    customer_id: customerId,
                    address_id: addressId,
                    status: 'active'
                })),
                meta: { page: 1, limit: 50, total: 3 }
            };

            nock(baseUrl)
                .get('/subscriptions')
                .query({ customer_id: customerId })
                .matchHeader(expectAuthHeaders)
                .reply(200, subscriptionsResponse);

            // Get customer and their subscriptions
            const customer = await api.getCustomer(customerId);
            const subscriptions = await api.listSubscriptions({ customer_id: customerId });

            expect(customer).toEqual(customerResponse);
            expect(subscriptions).toEqual(subscriptionsResponse);
            expect(subscriptions.subscriptions.length).toBe(3);
        });
    });
});