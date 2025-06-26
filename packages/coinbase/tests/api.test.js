const { Api } = require('../api');

describe('Coinbase API', () => {
    let api;

    beforeEach(() => {
        api = new Api({
            clientId: 'test_client_id',
            clientSecret: 'test_client_secret',
            redirectUri: 'https://example.com/callback',
            sandbox: false,
        });
    });

    test('should initialize with OAuth2 configuration', () => {
        expect(api.clientId).toBe('test_client_id');
        expect(api.clientSecret).toBe('test_client_secret');
        expect(api.redirectUri).toBe('https://example.com/callback');
        expect(api.baseUrl).toBe('https://api.coinbase.com');
        expect(api.client).toBeDefined();
    });

    test('should initialize with API key configuration', () => {
        const apiKeyAuth = new Api({
            apiKey: 'test_api_key',
            apiSecret: 'test_api_secret',
        });

        expect(apiKeyAuth.apiKey).toBe('test_api_key');
        expect(apiKeyAuth.apiSecret).toBe('test_api_secret');
    });

    test('should generate authorization URI', async () => {
        const authUri = await api.getAuthorizationUri();
        
        expect(authUri).toContain('https://www.coinbase.com/oauth/authorize');
        expect(authUri).toContain('client_id=test_client_id');
        expect(authUri).toContain('response_type=code');
        expect(authUri).toContain('redirect_uri=');
    });

    test('should construct send money request', async () => {
        api.access_token = 'test_access_token';
        
        // Mock the makeRequest method
        api.makeRequest = jest.fn().mockResolvedValue({
            id: 'transaction-123',
            type: 'send',
            status: 'pending',
        });

        const transaction = await api.sendMoney('account-123', {
            to: 'user@example.com',
            amount: '10.00',
            currency: 'USD',
            description: 'Test payment',
        });

        expect(api.makeRequest).toHaveBeenCalledWith('POST', '/v2/accounts/account-123/transactions', {
            type: 'send',
            to: 'user@example.com',
            amount: '10.00',
            currency: 'USD',
            description: 'Test payment',
            idem: expect.stringMatching(/^send-\d+$/),
        });
        expect(transaction.id).toBe('transaction-123');
    });

    test('should verify webhook signature correctly', () => {
        const payload = 'test-payload';
        const validSignature = require('crypto')
            .createHmac('sha256', 'test_client_secret')
            .update(payload)
            .digest('hex');

        expect(api.verifyWebhookSignature(payload, validSignature)).toBe(true);
        expect(api.verifyWebhookSignature(payload, 'invalid-signature')).toBe(false);
    });
});