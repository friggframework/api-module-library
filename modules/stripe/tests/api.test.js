const { Api } = require('../api');

jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        oauth: {
            authorizeUrl: jest.fn(),
            token: jest.fn(),
        },
        balanceTransactions: {
            list: jest.fn(),
        },
        charges: {
            list: jest.fn(),
        },
        accounts: {
            retrieve: jest.fn(),
        },
        webhookEndpoints: {
            create: jest.fn(),
            del: jest.fn(),
        },
    }));
});

describe('Api', () => {
    let api;
    let params;

    beforeEach(() => {
        params = {
            stripeApiSecretKey: 'sk_test_123',
            stripeClientId: 'ca_123',
            stripe_user_id: 'acct_123',
            redirect_uri: 'http://localhost/callback',
        };
        api = new Api(params);
    });

    it('should initialize with the correct parameters', () => {
        expect(api).toBeDefined();
        expect(api.stripe).toBeDefined();
        expect(api.stripeClientId).toBe(params.stripeClientId);
        expect(api.stripeUserId).toBe(params.stripe_user_id);
        expect(api.redirect_uri).toBe(params.redirect_uri);
    });

    it('should set stripeUserId', () => {
        const newUserId = 'acct_456';
        api.setStripeUserId(newUserId);
        expect(api.stripeUserId).toBe(newUserId);
    });

    it('should return the correct authorization URI', () => {
        const mockAuthUri = 'https://connect.stripe.com/oauth/authorize';
        api.stripe.oauth.authorizeUrl.mockReturnValue(mockAuthUri);

        const authUri = api.getAuthUri();
        expect(authUri).toBe(mockAuthUri);
    });

    it('should get a token from code', async () => {
        const mockToken = { access_token: 'access_token_123' };
        api.stripe.oauth.token.mockResolvedValue(mockToken);

        const token = await api.getTokenFromCode('auth_code_123');
        expect(token).toBe(mockToken);
    });

    it('should refresh access token', async () => {
        const mockToken = { access_token: 'new_access_token_123' };
        api.stripe.oauth.token.mockResolvedValue(mockToken);

        const token = await api.refreshAccessToken('refresh_token_123');
        expect(token).toBe(mockToken);
    });

    it('should handle errors when refreshing access token', async () => {
        api.stripe.oauth.token.mockRejectedValue(new Error('Invalid token'));

        await expect(
            api.refreshAccessToken('refresh_token_123'),
        ).rejects.toThrow('Invalid token');
    });

    it('should get account details', async () => {
        const mockAccountDetails = {
            id: 'acct_123',
            email: 'user@example.com',
        };
        api.stripe.accounts.retrieve.mockResolvedValue(mockAccountDetails);

        const accountDetails = await api.getAccountDetails();
        expect(accountDetails).toBe(mockAccountDetails);
    });

    it('should get balance transactions', async () => {
        const mockTransactions = { data: [] };
        api.stripe.balanceTransactions.list.mockResolvedValue(mockTransactions);

        const transactions = await api.getBalanceTransactions({});
        expect(transactions).toBe(mockTransactions);
    });

    it('should list all charges', async () => {
        const mockCharges = { data: [] };
        api.stripe.charges.list.mockResolvedValue(mockCharges);

        const charges = await api.listAllCharges({});
        expect(charges).toBe(mockCharges);
    });

    it('should create a webhook', async () => {
        const mockWebhook = { id: 'wh_123' };
        api.stripe.webhookEndpoints.create.mockResolvedValue(mockWebhook);

        const webhook = await api.createWebhook('http://example.com/webhook', [
            'charge.succeeded',
        ]);
        expect(webhook).toBe(mockWebhook);
    });

    it('should delete a webhook', async () => {
        const mockDeletedWebhook = { id: 'wh_123', deleted: true };
        api.stripe.webhookEndpoints.del.mockResolvedValue(mockDeletedWebhook);

        const webhook = await api.deleteWebhook('wh_123');
        expect(webhook).toBe(mockDeletedWebhook);
    });
});
