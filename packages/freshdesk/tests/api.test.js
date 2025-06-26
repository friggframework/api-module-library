const { Api } = require('../api');

describe('Freshdesk API', () => {
    let api;

    beforeEach(() => {
        api = new Api({
            subdomain: 'test-company',
            apiKey: 'test_api_key',
        });
    });

    test('should initialize with proper configuration', () => {
        expect(api.subdomain).toBe('test-company');
        expect(api.apiKey).toBe('test_api_key');
        expect(api.baseUrl).toBe('https://test-company.freshdesk.com/api/v2');
        expect(api.client).toBeDefined();
    });

    test('should configure axios with basic auth', () => {
        expect(api.client.defaults.auth).toEqual({
            username: 'test_api_key',
            password: 'X',
        });
    });

    test('should construct create ticket request', async () => {
        // Mock the makeRequest method
        api.makeRequest = jest.fn().mockResolvedValue({
            id: 123,
            subject: 'Test ticket',
            status: 2, // Open status
            priority: 1, // Low priority
        });

        const ticket = await api.createTicket({
            subject: 'Test ticket',
            description: 'Test description',
            email: 'customer@example.com',
            priority: 1,
            status: 2,
        });

        expect(api.makeRequest).toHaveBeenCalledWith('POST', '/tickets', {
            subject: 'Test ticket',
            description: 'Test description',
            email: 'customer@example.com',
            priority: 1,
            status: 2,
        });
        expect(ticket.id).toBe(123);
    });

    test('should create reply to ticket', async () => {
        api.makeRequest = jest.fn().mockResolvedValue({
            id: 456,
            body: 'Reply body',
        });

        await api.createReply(123, {
            body: 'Reply body',
            from_email: 'agent@example.com',
        });

        expect(api.makeRequest).toHaveBeenCalledWith('POST', '/tickets/123/reply', {
            body: 'Reply body',
            from_email: 'agent@example.com',
        });
    });

    test('should search contacts', async () => {
        api.makeRequest = jest.fn().mockResolvedValue({
            results: [
                { id: 1, name: 'John Doe', email: 'john@example.com' },
            ],
        });

        const results = await api.searchContacts('john@example.com');

        expect(api.makeRequest).toHaveBeenCalledWith('GET', '/search/contacts', null, {
            query: 'john@example.com',
        });
        expect(results.results).toHaveLength(1);
    });

    test('should handle paginated requests', async () => {
        // Mock makeRequest to return different responses for each page
        let callCount = 0;
        api.makeRequest = jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // First page - return 100 items (max per page)
                return Promise.resolve(new Array(100).fill({ id: callCount }));
            } else if (callCount === 2) {
                // Second page - return 50 items
                return Promise.resolve(new Array(50).fill({ id: callCount }));
            }
            // No more pages
            return Promise.resolve([]);
        });

        const results = await api.makePaginatedRequest('/test-endpoint', { filter: 'test' });

        expect(api.makeRequest).toHaveBeenCalledTimes(2);
        expect(api.makeRequest).toHaveBeenNthCalledWith(1, 'GET', '/test-endpoint', null, {
            filter: 'test',
            page: 1,
        });
        expect(api.makeRequest).toHaveBeenNthCalledWith(2, 'GET', '/test-endpoint', null, {
            filter: 'test',
            page: 2,
        });
        expect(results).toHaveLength(150);
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