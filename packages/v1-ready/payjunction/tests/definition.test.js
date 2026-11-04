const { Definition } = require('../definition');
const { Api } = require('../api');

describe('PayJunction Definition', () => {
    it('is an oauth2 module named payjunction wired to the Api class', () => {
        expect(Definition.moduleName).toBe('payjunction');
        expect(Definition.getName()).toBe('payjunction');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('PayJunction');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists OAuth tokens and the application key', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'app_key',
            ],
            entity: [],
        });
    });

    it('getToken exchanges the OAuth code', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, { code: 'abc' });
        expect(seen).toBe('abc');
    });

    it('getToken reads code from params.data (callback shape)', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'a' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'from-data' },
        });
        expect(seen).toBe('from-data');
    });

    it('getEntityDetails uses GET /merchant id as externalId', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
            access_token: 't',
        });
        api.getMerchant = async () => ({
            id: 'f412d416-b2cb-4ee2-97da-16d5214896bc',
            companyDba: 'Acme Payments',
            companyLegal: 'Acme Payments LLC',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe(
            'f412d416-b2cb-4ee2-97da-16d5214896bc'
        );
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Payments');
    });

    it('throws when merchant identity cannot be derived', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        api.getMerchant = async () => ({ companyDba: 'No Id' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable merchant identity/i);
    });

    it('getCredentialDetails uses the same merchant id', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        api.getMerchant = async () => ({
            id: 'merchant-uuid-1',
            companyLegal: 'Legal Co',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('merchant-uuid-1');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getMerchant', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        let called = false;
        api.getMerchant = async () => {
            called = true;
            return { id: 'm' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('declares OAuth env bindings including dedicated redirect', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('app_key');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });

    it('getAuthorizationRequirements returns oauth2', () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
            state: 'st',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('/trinity/oauth/authorize');
    });
});
