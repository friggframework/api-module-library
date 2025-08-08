import { Api } from '../../api';
import nock from 'nock';

export const TEST_API_KEY = 'test-api-key-123456789';
export const BASE_URL = 'https://api.rechargeapps.com';

/**
 * Creates a new Api instance with test configuration
 */
export const createTestApi = (apiKey: string = TEST_API_KEY): Api => {
    return new Api({ api_key: apiKey });
};

/**
 * Sets up common nock interceptors for testing
 */
export const setupNockInterceptors = () => {
    // Disable real HTTP requests
    nock.disableNetConnect();
    
    // Clean all interceptors
    nock.cleanAll();
};

/**
 * Cleans up nock interceptors after tests
 */
export const cleanupNockInterceptors = () => {
    nock.cleanAll();
    nock.enableNetConnect();
};

/**
 * Creates a nock scope with default headers validation
 */
export const createNockScope = (apiKey: string = TEST_API_KEY) => {
    return nock(BASE_URL)
        .matchHeader('x-recharge-access-token', apiKey)
        .matchHeader('x-recharge-version', '2021-11')
        .matchHeader('content-type', 'application/json')
        .matchHeader('accept', 'application/json');
};

/**
 * Waits for all pending promises to resolve
 */
export const flushPromises = () => new Promise(resolve => setImmediate(resolve));

/**
 * Creates a mock error response
 */
export const createErrorResponse = (status: number, error: string, message: string, errors?: any) => {
    const response: any = { error, message };
    if (errors) {
        response.errors = errors;
    }
    return response;
};

/**
 * Creates a paginated response
 */
export const createPaginatedResponse = <T>(
    items: T[],
    itemsKey: string,
    page: number = 1,
    limit: number = 50,
    total?: number
) => {
    const actualTotal = total || items.length;
    const pages = Math.ceil(actualTotal / limit);
    
    return {
        [itemsKey]: items,
        meta: {
            page,
            limit,
            pages,
            total: actualTotal,
            prev_page: page > 1 ? page - 1 : null,
            next_page: page < pages ? page + 1 : null
        }
    };
};

/**
 * Validates that a date string is in ISO 8601 format
 */
export const isValidISODate = (dateString: string): boolean => {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date.toISOString() === dateString;
};

/**
 * Creates headers object for nock matching
 */
export const createHeaders = (apiKey: string = TEST_API_KEY) => ({
    'x-recharge-access-token': apiKey,
    'x-recharge-version': '2021-11',
    'content-type': 'application/json',
    'accept': 'application/json'
});

/**
 * Asserts that a request has the correct Recharge headers
 */
export const expectRechargeHeaders = (headers: any, apiKey: string = TEST_API_KEY): boolean => {
    expect(headers['x-recharge-access-token']).toBe(apiKey);
    expect(headers['x-recharge-version']).toBe('2021-11');
    expect(headers['content-type']).toBe('application/json');
    expect(headers['accept']).toBe('application/json');
    return true;
};

/**
 * Creates a delay promise for testing async operations
 */
export const delay = (ms: number): Promise<void> => 
    new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates a random ID for testing
 */
export const generateId = (): string => 
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

/**
 * Creates a mock webhook payload
 */
export const createWebhookPayload = (topic: string, data: any) => ({
    topic,
    data,
    occurred_at: new Date().toISOString()
});

/**
 * Validates webhook signature (mock implementation)
 */
export const validateWebhookSignature = (payload: string, signature: string, secret: string): boolean => {
    // This is a mock implementation for testing
    // In production, this would use HMAC-SHA256
    return true;
};

/**
 * Test data builders
 */
export const builders = {
    customer: (overrides: any = {}) => ({
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        billing_address1: '123 Test St',
        billing_city: 'Test City',
        billing_province: 'TC',
        billing_zip: '12345',
        billing_country: 'Test Country',
        ...overrides
    }),
    
    subscription: (overrides: any = {}) => ({
        address_id: generateId(),
        customer_id: generateId(),
        next_charge_scheduled_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        charge_interval_frequency: 30,
        order_interval_frequency: 30,
        order_interval_unit: 'day',
        shopify_product_id: generateId(),
        quantity: 1,
        price: 29.99,
        ...overrides
    }),
    
    address: (overrides: any = {}) => ({
        customer_id: generateId(),
        address1: '123 Test St',
        city: 'Test City',
        province: 'TC',
        zip: '12345',
        country: 'Test Country',
        first_name: 'Test',
        last_name: 'User',
        ...overrides
    }),
    
    webhook: (overrides: any = {}) => ({
        address: 'https://example.com/webhooks/recharge',
        topic: 'subscription/created',
        ...overrides
    })
};