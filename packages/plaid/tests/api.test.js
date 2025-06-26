const { Api } = require('../api');

describe('Plaid API', () => {
    let api;

    beforeEach(() => {
        api = new Api({
            clientId: 'test_client_id',
            secret: 'test_secret',
            environment: 'sandbox',
        });
    });

    test('should initialize with proper configuration', () => {
        expect(api.clientId).toBe('test_client_id');
        expect(api.secret).toBe('test_secret');
        expect(api.environment).toBe('sandbox');
        expect(api.client).toBeDefined();
    });

    test('should create link token request with proper parameters', async () => {
        const params = {
            userId: 'test-user-123',
            clientName: 'Test App',
            products: ['transactions'],
            countryCodes: ['US'],
        };

        // Mock the client method
        api.client.linkTokenCreate = jest.fn().mockResolvedValue({
            data: {
                link_token: 'link-sandbox-test-token',
                expiration: '2024-01-01T00:00:00Z',
            },
        });

        const result = await api.createLinkToken(params);
        
        expect(api.client.linkTokenCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                client_id: 'test_client_id',
                secret: 'test_secret',
                user: { client_user_id: 'test-user-123' },
                client_name: 'Test App',
                products: ['transactions'],
                country_codes: ['US'],
                language: 'en',
            })
        );
        expect(result.link_token).toBe('link-sandbox-test-token');
    });

    test('should exchange public token for access token', async () => {
        const publicToken = 'public-sandbox-test-token';

        api.client.itemPublicTokenExchange = jest.fn().mockResolvedValue({
            data: {
                access_token: 'access-sandbox-test-token',
                item_id: 'item-123',
            },
        });

        const result = await api.exchangePublicToken(publicToken);

        expect(api.client.itemPublicTokenExchange).toHaveBeenCalledWith({
            client_id: 'test_client_id',
            secret: 'test_secret',
            public_token: publicToken,
        });
        expect(result.access_token).toBe('access-sandbox-test-token');
        expect(api.accessToken).toBe('access-sandbox-test-token');
    });

    test('should fetch accounts', async () => {
        api.accessToken = 'access-sandbox-test-token';

        api.client.accountsGet = jest.fn().mockResolvedValue({
            data: {
                accounts: [
                    {
                        account_id: 'acc-123',
                        name: 'Checking Account',
                        type: 'depository',
                        subtype: 'checking',
                    },
                ],
                item: { item_id: 'item-123' },
            },
        });

        const result = await api.getAccounts();

        expect(api.client.accountsGet).toHaveBeenCalledWith({
            client_id: 'test_client_id',
            secret: 'test_secret',
            access_token: 'access-sandbox-test-token',
        });
        expect(result.accounts).toHaveLength(1);
        expect(result.accounts[0].name).toBe('Checking Account');
    });
});