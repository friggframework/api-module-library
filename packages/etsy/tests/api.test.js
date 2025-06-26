const { Api } = require('../api');

describe('Etsy API', () => {
    let api;
    
    beforeEach(() => {
        api = new Api({
            client_id: 'test_client_id',
            client_secret: 'test_client_secret',
            access_token: 'test_access_token',
            redirect_uri: 'https://example.com/callback'
        });
    });

    describe('Constructor', () => {
        test('should initialize with correct credentials', () => {
            expect(api.client_id).toBe('test_client_id');
            expect(api.client_secret).toBe('test_client_secret');
            expect(api.access_token).toBe('test_access_token');
            expect(api.baseUrl).toBe('https://openapi.etsy.com/v3');
        });

        test('should set OAuth endpoints correctly', () => {
            expect(api.authorizationUri).toBe('https://www.etsy.com/oauth/connect');
            expect(api.tokenUri).toBe('https://api.etsy.com/v3/public/oauth/token');
        });
    });

    describe('Authentication', () => {
        test('should generate correct auth URI', () => {
            const authUri = api.getAuthUri();
            
            expect(authUri).toContain('https://www.etsy.com/oauth/connect');
            expect(authUri).toContain('client_id=test_client_id');
            expect(authUri).toContain('response_type=code');
            expect(authUri).toContain('scope=email_r%20profile_r%20shops_r%20listings_r');
        });

        test('should add correct auth headers', () => {
            const options = { headers: {} };
            api.addAuthHeaders(options);
            
            expect(options.headers.Authorization).toBe('Bearer test_access_token');
            expect(options.headers['Content-Type']).toBe('application/json');
            expect(options.headers.Accept).toBe('application/json');
        });
    });

    describe('URL Construction', () => {
        test('should construct shop URLs correctly', () => {
            expect(api.URLs.shops).toBe('/application/shops');
            expect(api.URLs.shopById(123)).toBe('/application/shops/123');
            expect(api.URLs.shopSections(123)).toBe('/application/shops/123/sections');
        });

        test('should construct listing URLs correctly', () => {
            expect(api.URLs.listings).toBe('/application/listings');
            expect(api.URLs.listingById(456)).toBe('/application/listings/456');
            expect(api.URLs.listingImages(456)).toBe('/application/listings/456/images');
            expect(api.URLs.listingsByShop(123)).toBe('/application/shops/123/listings');
        });

        test('should construct user URLs correctly', () => {
            expect(api.URLs.user).toBe('/application/user');
            expect(api.URLs.userProfile).toBe('/application/user/profile');
            expect(api.URLs.myShops).toBe('/application/user/shops');
        });

        test('should construct receipt/order URLs correctly', () => {
            expect(api.URLs.shopReceipts(123)).toBe('/application/shops/123/receipts');
            expect(api.URLs.shopReceiptById(123, 456)).toBe('/application/shops/123/receipts/456');
            expect(api.URLs.receiptTransactions(123, 456)).toBe('/application/shops/123/receipts/456/transactions');
        });
    });

    describe('Scope Handling', () => {
        test('should use default scope if none provided', () => {
            expect(api.scope).toBe('email_r profile_r shops_r listings_r');
        });

        test('should use custom scope if provided', () => {
            const customApi = new Api({
                scope: 'email_r profile_r',
                client_id: 'test',
                client_secret: 'test'
            });
            
            expect(customApi.scope).toBe('email_r profile_r');
        });
    });
});