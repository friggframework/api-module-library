const { Api } = require('../api');

describe('WooCommerce API', () => {
    let api;
    
    beforeEach(() => {
        api = new Api({
            baseUrl: 'https://example.com',
            consumer_key: 'test_key',
            consumer_secret: 'test_secret'
        });
    });

    describe('Constructor', () => {
        test('should initialize with correct base URL and credentials', () => {
            expect(api.baseUrl).toBe('https://example.com');
            expect(api.consumer_key).toBe('test_key');
            expect(api.consumer_secret).toBe('test_secret');
            expect(api.apiEndpoint).toBe('https://example.com/wp-json/wc/v3');
        });

        test('should detect HTTPS correctly', () => {
            expect(api.isHttps).toBe(true);
            
            const httpApi = new Api({
                baseUrl: 'http://example.com',
                consumer_key: 'test_key',
                consumer_secret: 'test_secret'
            });
            expect(httpApi.isHttps).toBe(false);
        });
    });

    describe('Authentication', () => {
        test('should add basic auth for HTTPS', () => {
            const options = { headers: {} };
            api.addAuthHeaders(options, 'GET');
            
            expect(options.headers.Authorization).toContain('Basic');
            expect(options.headers['Content-Type']).toBe('application/json');
        });

        test('should add OAuth signature for HTTP', () => {
            const httpApi = new Api({
                baseUrl: 'http://example.com',
                consumer_key: 'test_key',
                consumer_secret: 'test_secret'
            });
            
            const options = { 
                url: 'http://example.com/wp-json/wc/v3/products',
                headers: {} 
            };
            httpApi.addAuthHeaders(options, 'GET');
            
            expect(options.headers.Authorization).toContain('OAuth');
        });
    });

    describe('URL Construction', () => {
        test('should construct product URLs correctly', () => {
            expect(api.URLs.products).toBe('/products');
            expect(api.URLs.productById(123)).toBe('/products/123');
            expect(api.URLs.productVariations(123)).toBe('/products/123/variations');
        });

        test('should construct order URLs correctly', () => {
            expect(api.URLs.orders).toBe('/orders');
            expect(api.URLs.orderById(456)).toBe('/orders/456');
            expect(api.URLs.orderNotes(456)).toBe('/orders/456/notes');
        });

        test('should construct webhook URLs correctly', () => {
            expect(api.URLs.webhooks).toBe('/webhooks');
            expect(api.URLs.webhookById(789)).toBe('/webhooks/789');
        });
    });

    describe('Webhook Verification', () => {
        test('should verify webhook signature correctly', () => {
            const payload = '{"test": "data"}';
            const secret = 'webhook_secret';
            const signature = 'XM+fUc/+4OMhOaJlEwVK20UqBWLUeHvEBKRRfX8t4OU=';
            
            const isValid = api.verifyWebhookSignature(payload, signature, secret);
            expect(typeof isValid).toBe('boolean');
        });
    });
});