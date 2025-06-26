const { Api } = require('../api');

describe('AWS S3 API', () => {
    let api;

    beforeEach(() => {
        api = new Api({
            client_id: 'test-client-id',
            client_secret: 'test-client-secret',
            redirect_uri: 'http://localhost:3000/callback'
        });
    });

    describe('Constructor', () => {
        test('should initialize with correct properties', () => {
            expect(api).toBeDefined();
            expect(api.client_id).toBe('test-client-id');
            expect(api.client_secret).toBe('test-client-secret');
            expect(api.redirect_uri).toBe('http://localhost:3000/callback');
        });
    });

    describe('getAuthUri', () => {
        test('should return authorization URI', () => {
            const authUri = api.getAuthUri();
            expect(authUri).toBeDefined();
            expect(typeof authUri).toBe('string');
            expect(authUri).toContain('client_id=test-client-id');
        });
    });

    describe('setTokens', () => {
        test('should set access token', async () => {
            const tokens = {
                access_token: 'test-access-token',
                refresh_token: 'test-refresh-token',
                expires_in: 3600
            };

            await api.setTokens(tokens);
            expect(api.access_token).toBe('test-access-token');
            expect(api.refresh_token).toBe('test-refresh-token');
        });
    });
});
