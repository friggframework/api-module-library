import { Api } from '../api';
import config from '../defaultConfig.json';
import { randomBytes } from 'crypto';

const getRandomId = () => randomBytes(10).toString('hex');

describe(`${config.label} API tests`, () => {
    let api: Api;
    const mockApiKey = 'test-api-key-123456789';

    beforeEach(() => {
        jest.clearAllMocks();
        api = new Api({ api_key: mockApiKey });
    });

    // **************************   Constructor & Auth  **********************************

    describe('Constructor', () => {
        it('Should initialize with proper baseUrl', () => {
            expect(api.baseUrl).toBe('https://api.rechargeapps.com');
        });

        it('Should throw error when api_key is not provided', () => {
            expect(() => new Api({} as any)).not.toThrow();
            const apiWithoutKey = new Api({} as any);
            expect(() => apiWithoutKey.addAuthHeaders()).toThrow('API key is required for Recharge API requests');
        });

        it('Should initialize all URL endpoints correctly', () => {
            expect(api.URLs.customers).toBe('/customers');
            expect(api.URLs.customerById('123')).toBe('/customers/123');
            expect(api.URLs.subscriptions).toBe('/subscriptions');
            expect(api.URLs.subscriptionCancel('456')).toBe('/subscriptions/456/cancel');
            expect(api.URLs.orders).toBe('/orders');
            expect(api.URLs.charges).toBe('/charges');
            expect(api.URLs.products).toBe('/products');
            expect(api.URLs.addresses).toBe('/addresses');
            expect(api.URLs.webhooks).toBe('/webhooks');
            expect(api.URLs.shop).toBe('/shop');
        });
    });

    describe('addAuthHeaders', () => {
        it('Should add proper Recharge headers', () => {
            const headers = api.addAuthHeaders();
            expect(headers).toEqual({
                'X-Recharge-Access-Token': mockApiKey,
                'X-Recharge-Version': '2021-11',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            });
        });

        it('Should merge with existing headers', () => {
            const existingHeaders = { 'Custom-Header': 'custom-value' };
            const headers = api.addAuthHeaders(existingHeaders);
            expect(headers).toEqual({
                'Custom-Header': 'custom-value',
                'X-Recharge-Access-Token': mockApiKey,
                'X-Recharge-Version': '2021-11',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            });
        });

        it('Should throw error when api_key is not set', () => {
            const apiWithoutKey = new Api({ api_key: null } as any);
            expect(() => apiWithoutKey.addAuthHeaders()).toThrow('API key is required for Recharge API requests');
        });
    });

    describe('testAuth', () => {
        it('Should call _get with shop endpoint for successful auth', async () => {
            const mockResponse = { shop: { name: 'Test Shop', email: 'test@shop.com' } };
            api._get = jest.fn().mockResolvedValue(mockResponse);

            const result = await api.testAuth();

            expect(api._get).toHaveBeenCalledWith({
                url: `${api.baseUrl}${api.URLs.shop}`
            });
            expect(result).toEqual({ success: true, data: mockResponse });
        });

        it('Should return error object for failed auth', async () => {
            const errorMessage = 'Unauthorized';
            api._get = jest.fn().mockRejectedValue(new Error(errorMessage));

            const result = await api.testAuth();

            expect(result).toEqual({ success: false, error: errorMessage });
        });
    });

    // **************************   Shop  **********************************

    describe('Shop endpoints', () => {
        describe('getShop', () => {
            it('Should call _get with the proper URL', async () => {
                const mockResponse = { shop: { name: 'Test Shop' } };
                api._get = jest.fn().mockResolvedValue(mockResponse);

                const response = await api.getShop();

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.shop}`
                });
                expect(response).toEqual(mockResponse);
            });
        });
    });

    // **************************   Customers  **********************************

    describe('Customer endpoints', () => {
        describe('listCustomers', () => {
            it('Should call _get with proper URL and no query params', async () => {
                const mockResponse = { customers: [] };
                api._get = jest.fn().mockResolvedValue(mockResponse);

                const response = await api.listCustomers();

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.customers}`,
                    query: {}
                });
                expect(response).toEqual(mockResponse);
            });

            it('Should call _get with pagination params', async () => {
                const mockResponse = { customers: [] };
                api._get = jest.fn().mockResolvedValue(mockResponse);

                const options = { page: 2, limit: 50, sort_by: 'created_at', direction: 'desc' as const };
                const response = await api.listCustomers(options);

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.customers}`,
                    query: { page: 2, limit: 50, sort_by: 'created_at', direction: 'desc' }
                });
                expect(response).toEqual(mockResponse);
            });

            it('Should call _get with custom query params', async () => {
                const mockResponse = { customers: [] };
                api._get = jest.fn().mockResolvedValue(mockResponse);

                const options = { email: 'test@example.com', status: 'active' };
                const response = await api.listCustomers(options);

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.customers}`,
                    query: { email: 'test@example.com', status: 'active' }
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('getCustomer', () => {
            it('Should call _get with the proper URL', async () => {
                const mockResponse = { customer: { id: '123' } };
                api._get = jest.fn().mockResolvedValue(mockResponse);
                const customerId = getRandomId();

                const response = await api.getCustomer(customerId);

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.customerById(customerId)}`
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('createCustomer', () => {
            it('Should call _post with the proper URL and body', async () => {
                const mockResponse = { customer: { id: '123' } };
                api._post = jest.fn().mockResolvedValue(mockResponse);
                const customerData = { email: 'test@example.com', first_name: 'John' };

                const response = await api.createCustomer(customerData);

                expect(api._post).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.customers}`,
                    body: customerData
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('updateCustomer', () => {
            it('Should call _put with the proper URL and body', async () => {
                const mockResponse = { customer: { id: '123' } };
                api._put = jest.fn().mockResolvedValue(mockResponse);
                const customerId = getRandomId();
                const customerData = { first_name: 'Jane' };

                const response = await api.updateCustomer(customerId, customerData);

                expect(api._put).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.customerById(customerId)}`,
                    body: customerData
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('deleteCustomer', () => {
            it('Should call _delete with the proper URL', async () => {
                const mockResponse = {};
                api._delete = jest.fn().mockResolvedValue(mockResponse);
                const customerId = getRandomId();

                const response = await api.deleteCustomer(customerId);

                expect(api._delete).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.customerById(customerId)}`
                });
                expect(response).toEqual(mockResponse);
            });
        });
    });

    // **************************   Subscriptions  **********************************

    describe('Subscription endpoints', () => {
        describe('listSubscriptions', () => {
            it('Should call _get with proper URL and query params', async () => {
                const mockResponse = { subscriptions: [] };
                api._get = jest.fn().mockResolvedValue(mockResponse);
                const options = { status: 'active', customer_id: '123' };

                const response = await api.listSubscriptions(options);

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.subscriptions}`,
                    query: { status: 'active', customer_id: '123' }
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('getSubscription', () => {
            it('Should call _get with the proper URL', async () => {
                const mockResponse = { subscription: { id: '123' } };
                api._get = jest.fn().mockResolvedValue(mockResponse);
                const subscriptionId = getRandomId();

                const response = await api.getSubscription(subscriptionId);

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.subscriptionById(subscriptionId)}`
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('createSubscription', () => {
            it('Should call _post with the proper URL and body', async () => {
                const mockResponse = { subscription: { id: '123' } };
                api._post = jest.fn().mockResolvedValue(mockResponse);
                const subscriptionData = {
                    address_id: '456',
                    next_charge_scheduled_at: '2024-01-01',
                    shopify_product_id: '789'
                };

                const response = await api.createSubscription(subscriptionData);

                expect(api._post).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.subscriptions}`,
                    body: subscriptionData
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('updateSubscription', () => {
            it('Should call _put with the proper URL and body', async () => {
                const mockResponse = { subscription: { id: '123' } };
                api._put = jest.fn().mockResolvedValue(mockResponse);
                const subscriptionId = getRandomId();
                const subscriptionData = { quantity: 2 };

                const response = await api.updateSubscription(subscriptionId, subscriptionData);

                expect(api._put).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.subscriptionById(subscriptionId)}`,
                    body: subscriptionData
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('cancelSubscription', () => {
            it('Should call _post with cancel URL and empty body', async () => {
                const mockResponse = { subscription: { id: '123', status: 'cancelled' } };
                api._post = jest.fn().mockResolvedValue(mockResponse);
                const subscriptionId = getRandomId();

                const response = await api.cancelSubscription(subscriptionId);

                expect(api._post).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.subscriptionCancel(subscriptionId)}`,
                    body: {}
                });
                expect(response).toEqual(mockResponse);
            });

            it('Should call _post with cancel URL and cancel data', async () => {
                const mockResponse = { subscription: { id: '123', status: 'cancelled' } };
                api._post = jest.fn().mockResolvedValue(mockResponse);
                const subscriptionId = getRandomId();
                const cancelData = { cancellation_reason: 'Customer request' };

                const response = await api.cancelSubscription(subscriptionId, cancelData);

                expect(api._post).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.subscriptionCancel(subscriptionId)}`,
                    body: cancelData
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('activateSubscription', () => {
            it('Should call _post with activate URL', async () => {
                const mockResponse = { subscription: { id: '123', status: 'active' } };
                api._post = jest.fn().mockResolvedValue(mockResponse);
                const subscriptionId = getRandomId();

                const response = await api.activateSubscription(subscriptionId);

                expect(api._post).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.subscriptionActivate(subscriptionId)}`,
                    body: {}
                });
                expect(response).toEqual(mockResponse);
            });
        });
    });

    // **************************   Orders  **********************************

    describe('Order endpoints', () => {
        describe('listOrders', () => {
            it('Should call _get with proper URL and filters', async () => {
                const mockResponse = { orders: [] };
                api._get = jest.fn().mockResolvedValue(mockResponse);
                const options = { status: 'success', customer_id: '123', limit: 20 };

                const response = await api.listOrders(options);

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.orders}`,
                    query: { status: 'success', customer_id: '123', limit: 20 }
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('getOrder', () => {
            it('Should call _get with the proper URL', async () => {
                const mockResponse = { order: { id: '123' } };
                api._get = jest.fn().mockResolvedValue(mockResponse);
                const orderId = getRandomId();

                const response = await api.getOrder(orderId);

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.orderById(orderId)}`
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('updateOrder', () => {
            it('Should call _put with the proper URL and body', async () => {
                const mockResponse = { order: { id: '123' } };
                api._put = jest.fn().mockResolvedValue(mockResponse);
                const orderId = getRandomId();
                const orderData = { email: 'newemail@example.com' };

                const response = await api.updateOrder(orderId, orderData);

                expect(api._put).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.orderById(orderId)}`,
                    body: orderData
                });
                expect(response).toEqual(mockResponse);
            });
        });
    });

    // **************************   Charges  **********************************

    describe('Charge endpoints', () => {
        describe('listCharges', () => {
            it('Should call _get with proper URL and filters', async () => {
                const mockResponse = { charges: [] };
                api._get = jest.fn().mockResolvedValue(mockResponse);
                const options = { 
                    status: 'success', 
                    customer_id: '123',
                    date_min: '2024-01-01',
                    date_max: '2024-12-31'
                };

                const response = await api.listCharges(options);

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.charges}`,
                    query: options
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('getCharge', () => {
            it('Should call _get with the proper URL', async () => {
                const mockResponse = { charge: { id: '123' } };
                api._get = jest.fn().mockResolvedValue(mockResponse);
                const chargeId = getRandomId();

                const response = await api.getCharge(chargeId);

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.chargeById(chargeId)}`
                });
                expect(response).toEqual(mockResponse);
            });
        });
    });

    // **************************   Products  **********************************

    describe('Product endpoints', () => {
        describe('listProducts', () => {
            it('Should call _get with proper URL and pagination', async () => {
                const mockResponse = { products: [] };
                api._get = jest.fn().mockResolvedValue(mockResponse);
                const options = { page: 1, limit: 100 };

                const response = await api.listProducts(options);

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.products}`,
                    query: { page: 1, limit: 100 }
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('getProduct', () => {
            it('Should call _get with the proper URL', async () => {
                const mockResponse = { product: { id: '123' } };
                api._get = jest.fn().mockResolvedValue(mockResponse);
                const productId = getRandomId();

                const response = await api.getProduct(productId);

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.productById(productId)}`
                });
                expect(response).toEqual(mockResponse);
            });
        });
    });

    // **************************   Addresses  **********************************

    describe('Address endpoints', () => {
        describe('listAddresses', () => {
            it('Should call _get with proper URL', async () => {
                const mockResponse = { addresses: [] };
                api._get = jest.fn().mockResolvedValue(mockResponse);

                const response = await api.listAddresses();

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.addresses}`,
                    query: {}
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('getAddress', () => {
            it('Should call _get with the proper URL', async () => {
                const mockResponse = { address: { id: '123' } };
                api._get = jest.fn().mockResolvedValue(mockResponse);
                const addressId = getRandomId();

                const response = await api.getAddress(addressId);

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.addressById(addressId)}`
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('createAddress', () => {
            it('Should call _post with the proper URL and body', async () => {
                const mockResponse = { address: { id: '123' } };
                api._post = jest.fn().mockResolvedValue(mockResponse);
                const addressData = {
                    customer_id: '456',
                    address1: '123 Main St',
                    city: 'New York',
                    province: 'NY',
                    zip: '10001',
                    country: 'United States'
                };

                const response = await api.createAddress(addressData);

                expect(api._post).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.addresses}`,
                    body: addressData
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('updateAddress', () => {
            it('Should call _put with the proper URL and body', async () => {
                const mockResponse = { address: { id: '123' } };
                api._put = jest.fn().mockResolvedValue(mockResponse);
                const addressId = getRandomId();
                const addressData = { address1: '456 Oak Ave' };

                const response = await api.updateAddress(addressId, addressData);

                expect(api._put).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.addressById(addressId)}`,
                    body: addressData
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('deleteAddress', () => {
            it('Should call _delete with the proper URL', async () => {
                const mockResponse = {};
                api._delete = jest.fn().mockResolvedValue(mockResponse);
                const addressId = getRandomId();

                const response = await api.deleteAddress(addressId);

                expect(api._delete).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.addressById(addressId)}`
                });
                expect(response).toEqual(mockResponse);
            });
        });
    });

    // **************************   Webhooks  **********************************

    describe('Webhook endpoints', () => {
        describe('listWebhooks', () => {
            it('Should call _get with proper URL', async () => {
                const mockResponse = { webhooks: [] };
                api._get = jest.fn().mockResolvedValue(mockResponse);

                const response = await api.listWebhooks();

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.webhooks}`,
                    query: {}
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('getWebhook', () => {
            it('Should call _get with the proper URL', async () => {
                const mockResponse = { webhook: { id: '123' } };
                api._get = jest.fn().mockResolvedValue(mockResponse);
                const webhookId = getRandomId();

                const response = await api.getWebhook(webhookId);

                expect(api._get).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.webhookById(webhookId)}`
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('createWebhook', () => {
            it('Should call _post with the proper URL and body', async () => {
                const mockResponse = { webhook: { id: '123' } };
                api._post = jest.fn().mockResolvedValue(mockResponse);
                const webhookData = {
                    address: 'https://example.com/webhook',
                    topic: 'subscription/created'
                };

                const response = await api.createWebhook(webhookData);

                expect(api._post).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.webhooks}`,
                    body: webhookData
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('updateWebhook', () => {
            it('Should call _put with the proper URL and body', async () => {
                const mockResponse = { webhook: { id: '123' } };
                api._put = jest.fn().mockResolvedValue(mockResponse);
                const webhookId = getRandomId();
                const webhookData = { address: 'https://example.com/new-webhook' };

                const response = await api.updateWebhook(webhookId, webhookData);

                expect(api._put).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.webhookById(webhookId)}`,
                    body: webhookData
                });
                expect(response).toEqual(mockResponse);
            });
        });

        describe('deleteWebhook', () => {
            it('Should call _delete with the proper URL', async () => {
                const mockResponse = {};
                api._delete = jest.fn().mockResolvedValue(mockResponse);
                const webhookId = getRandomId();

                const response = await api.deleteWebhook(webhookId);

                expect(api._delete).toHaveBeenCalledWith({
                    url: `${api.baseUrl}${api.URLs.webhookById(webhookId)}`
                });
                expect(response).toEqual(mockResponse);
            });
        });
    });

    // **************************   Helper Methods  **********************************

    describe('Helper methods', () => {
        describe('_cleanParams', () => {
            it('Should remove undefined and null values', () => {
                const params = {
                    valid: 'value',
                    undefined: undefined,
                    null: null,
                    zero: 0,
                    empty: '',
                    false: false
                };

                const cleaned = (api as any)._cleanParams(params);

                expect(cleaned).toEqual({
                    valid: 'value',
                    zero: 0,
                    empty: '',
                    false: false
                });
            });
        });

        describe('_buildPaginationParams', () => {
            it('Should build pagination params correctly', () => {
                const options = {
                    page: 2,
                    limit: 50,
                    sort_by: 'created_at',
                    direction: 'desc' as const
                };

                const params = (api as any)._buildPaginationParams(options);

                expect(params).toEqual({
                    page: 2,
                    limit: 50,
                    sort_by: 'created_at',
                    direction: 'desc'
                });
            });

            it('Should handle empty options', () => {
                const params = (api as any)._buildPaginationParams();
                expect(params).toEqual({});
            });
        });

        describe('_buildQueryParams', () => {
            it('Should combine pagination and custom params', () => {
                const options = {
                    page: 1,
                    limit: 25,
                    status: 'active',
                    customer_id: '123',
                    created_at_min: '2024-01-01'
                };

                const params = (api as any)._buildQueryParams(options);

                expect(params).toEqual({
                    page: 1,
                    limit: 25,
                    status: 'active',
                    customer_id: '123',
                    created_at_min: '2024-01-01'
                });
            });

            it('Should clean undefined values', () => {
                const options = {
                    page: 1,
                    status: undefined,
                    customer_id: null,
                    active: true
                };

                const params = (api as any)._buildQueryParams(options);

                expect(params).toEqual({
                    page: 1,
                    active: true
                });
            });
        });
    });
});