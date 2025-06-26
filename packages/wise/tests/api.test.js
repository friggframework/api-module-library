const { Api } = require('../api');

describe('Wise API', () => {
    let api;

    beforeEach(() => {
        api = new Api({
            apiToken: 'test_api_token',
            sandbox: true,
        });
    });

    test('should initialize with proper configuration', () => {
        expect(api.apiToken).toBe('test_api_token');
        expect(api.sandbox).toBe(true);
        expect(api.baseUrl).toBe('https://api.sandbox.transferwise.tech');
        expect(api.client).toBeDefined();
    });

    test('should set profile ID', () => {
        api.setProfile('profile-123');
        expect(api.profileId).toBe('profile-123');
    });

    test('should construct proper quote request', async () => {
        api.profileId = 'profile-123';
        
        // Mock the makeRequest method
        api.makeRequest = jest.fn().mockResolvedValue({
            id: 'quote-123',
            source: 'USD',
            target: 'EUR',
            sourceAmount: 1000,
        });

        const quote = await api.createQuote({
            sourceCurrency: 'USD',
            targetCurrency: 'EUR',
            sourceAmount: 1000,
        });

        expect(api.makeRequest).toHaveBeenCalledWith('POST', '/v3/profiles/profile-123/quotes', {
            sourceCurrency: 'USD',
            targetCurrency: 'EUR',
            sourceAmount: 1000,
            targetAmount: null,
            profile: 'profile-123',
            payOut: 'BALANCE',
            preferredPayIn: 'BALANCE',
        });
        expect(quote.id).toBe('quote-123');
    });

    test('should verify webhook signature correctly', () => {
        const payload = 'test-payload';
        const secret = 'test-secret';
        const validSignature = require('crypto')
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');

        expect(api.verifyWebhookSignature(payload, validSignature, secret)).toBe(true);
        expect(api.verifyWebhookSignature(payload, 'invalid-signature', secret)).toBe(false);
    });
});