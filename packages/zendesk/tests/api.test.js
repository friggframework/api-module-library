const { Api } = require('../api');

describe('Zendesk API', () => {
    let api;

    beforeEach(() => {
        api = new Api({
            subdomain: 'test-company',
            clientId: 'test_client_id',
            clientSecret: 'test_client_secret',
            redirectUri: 'https://example.com/callback',
        });
    });

    test('should initialize with OAuth2 configuration', () => {
        expect(api.subdomain).toBe('test-company');
        expect(api.clientId).toBe('test_client_id');
        expect(api.clientSecret).toBe('test_client_secret');
        expect(api.baseUrl).toBe('https://test-company.zendesk.com');
        expect(api.apiUrl).toBe('https://test-company.zendesk.com/api/v2');
        expect(api.client).toBeDefined();
    });

    test('should initialize with API token configuration', () => {
        const apiTokenAuth = new Api({
            subdomain: 'test-company',
            email: 'user@example.com',
            apiToken: 'test_api_token',
        });

        expect(apiTokenAuth.email).toBe('user@example.com');
        expect(apiTokenAuth.apiToken).toBe('test_api_token');
    });

    test('should generate authorization URI', async () => {
        const authUri = await api.getAuthorizationUri();
        
        expect(authUri).toContain('https://test-company.zendesk.com/oauth/authorizations/new');
        expect(authUri).toContain('client_id=test_client_id');
        expect(authUri).toContain('response_type=code');
        expect(authUri).toContain('redirect_uri=');
    });

    test('should construct create ticket request', async () => {
        api.access_token = 'test_access_token';
        
        // Mock the makeRequest method
        api.makeRequest = jest.fn().mockResolvedValue({
            ticket: {
                id: 123,
                subject: 'Test ticket',
                status: 'new',
            },
        });

        const result = await api.createTicket({
            subject: 'Test ticket',
            comment: { body: 'Test description' },
            priority: 'normal',
        });

        expect(api.makeRequest).toHaveBeenCalledWith('POST', '/tickets.json', {
            ticket: {
                subject: 'Test ticket',
                comment: { body: 'Test description' },
                priority: 'normal',
            },
        });
        expect(result.ticket.id).toBe(123);
    });

    test('should add tags to resources', async () => {
        api.access_token = 'test_access_token';
        
        api.makeRequest = jest.fn().mockResolvedValue({ tags: ['tag1', 'tag2'] });

        await api.addTags('tickets', 123, ['tag1', 'tag2']);

        expect(api.makeRequest).toHaveBeenCalledWith('PUT', '/tickets/123/tags.json', {
            tags: ['tag1', 'tag2'],
            safe_update: true,
        });
    });

    test('should verify webhook signature correctly', () => {
        const payload = 'test-payload';
        const signingSecret = 'test-secret';
        const validSignature = require('crypto')
            .createHmac('sha256', signingSecret)
            .update(payload)
            .digest('base64');

        expect(api.verifyWebhookSignature(payload, validSignature, signingSecret)).toBe(true);
        expect(api.verifyWebhookSignature(payload, 'invalid-signature', signingSecret)).toBe(false);
    });
});