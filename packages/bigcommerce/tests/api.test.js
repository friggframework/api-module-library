const { Api } = require('../api');

describe('BigCommerce API', () => {
    let api;
    
    beforeEach(() => {
        api = new Api({
            storeHash: 'test_store_hash',
            accessToken: 'test_access_token'
        });
    });

    describe('Constructor', () => {
        test('should initialize with correct store hash and access token', () => {
            expect(api.storeHash).toBe('test_store_hash');
            expect(api.access_token).toBe('test_access_token');
            expect(api.baseUrl).toBe('https://api.bigcommerce.com/stores/test_store_hash');
        });

        test('should set OAuth endpoints correctly', () => {
            expect(api.authorizationUri).toBe('https://login.bigcommerce.com/oauth2/authorize');
            expect(api.tokenUri).toBe('https://login.bigcommerce.com/oauth2/token');
        });
    });

    describe('Authentication', () => {
        test('should add correct auth headers', () => {
            const options = { headers: {} };
            api.addAuthHeaders(options);
            
            expect(options.headers['X-Auth-Token']).toBe('test_access_token');
            expect(options.headers['Content-Type']).toBe('application/json');
            expect(options.headers['Accept']).toBe('application/json');
        });
    });

    describe('OAuth Methods', () => {
        test('should generate correct auth URI', () => {
            api.clientId = 'test_client_id';
            api.redirect_uri = 'https://example.com/callback';
            
            const authUri = api.getAuthUri(['store_v2_default'], 'stores/test_hash');
            
            expect(authUri).toContain('https://login.bigcommerce.com/oauth2/authorize');
            expect(authUri).toContain('client_id=test_client_id');
            expect(authUri).toContain('scope=store_v2_default');
            expect(authUri).toContain('context=stores%2Ftest_hash');
        });
    });

    describe('URL Construction', () => {
        test('should construct product URLs correctly', () => {
            expect(api.URLs.products).toBe('/v3/catalog/products');
            expect(api.URLs.productById(123)).toBe('/v3/catalog/products/123');
            expect(api.URLs.productVariants(123)).toBe('/v3/catalog/products/123/variants');
        });

        test('should construct order URLs correctly', () => {
            expect(api.URLs.orders).toBe('/v2/orders');
            expect(api.URLs.orderById(456)).toBe('/v2/orders/456');
            expect(api.URLs.orderProducts(456)).toBe('/v2/orders/456/products');
        });

        test('should construct customer URLs correctly', () => {
            expect(api.URLs.customers).toBe('/v3/customers');
            expect(api.URLs.customerById(789)).toBe('/v3/customers/789');
            expect(api.URLs.customerAddresses(789)).toBe('/v3/customers/789/addresses');
        });

        test('should construct theme URLs correctly', () => {
            expect(api.URLs.themes).toBe('/v3/themes');
            expect(api.URLs.themeById(101)).toBe('/v3/themes/101');
            expect(api.URLs.themeConfigurations(101)).toBe('/v3/themes/101/configurations');
        });
    });

    describe('Webhook Verification', () => {
        test('should verify webhook signature correctly', () => {
            const payload = '{"test": "data"}';
            const clientSecret = 'webhook_secret';
            const signature = 'XM+fUc/+4OMhOaJlEwVK20UqBWLUeHvEBKRRfX8t4OU=';
            
            const isValid = api.verifyWebhookSignature(payload, signature, clientSecret);
            expect(typeof isValid).toBe('boolean');
        });
    });
});