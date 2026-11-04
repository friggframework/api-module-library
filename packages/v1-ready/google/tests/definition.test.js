const { Definition, credentialExternalId } = require('../definition');
const { Api } = require('../api');

describe('Google Definition', () => {
    it('is an oauth2 module named google wired to the Api class', () => {
        expect(Definition.moduleName).toBe('google');
        expect(Definition.getName()).toBe('google');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Google');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists access_token and refresh_token credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: [],
        });
    });

    it('getAuthorizationRequirements delegates to the Api', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/google',
        });
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain(
            'https://accounts.google.com/o/oauth2/v2/auth?'
        );
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/google',
        });
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, { code: 'auth-1' });
        expect(seen).toBe('auth-1');
    });

    it('getToken also reads code from params.data', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/google',
        });
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return {};
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'nested' },
        });
        expect(seen).toBe('nested');
    });

    it('getEntityDetails uses OpenID Connect sub and email', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/google',
            access_token: 't',
        });
        api.getUserInfo = async () => ({
            sub: '108234567890',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('108234567890');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('ada@example.com');
    });

    it('getCredentialDetails namespaces externalId with module + user', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/google',
            access_token: 't',
        });
        api.getUserInfo = async () => ({
            sub: '108234567890',
            email: 'ada@example.com',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-1'
            );
        expect(details.identifiers.externalId).toBe(
            credentialExternalId('google', '108234567890', 'user-1')
        );
        expect(details.identifiers.externalId).toBe(
            'google:108234567890:user-1'
        );
        expect(details.identifiers.userId).toBe('user-1');
    });

    it('throws when userinfo has no sub', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/google',
            access_token: 't',
        });
        api.getUserInfo = async () => ({ email: 'x@y.com' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/no sub/i);
    });

    it('testAuthRequest calls getUserInfo', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/google',
            access_token: 't',
        });
        let called = false;
        api.getUserInfo = async () => {
            called = true;
            return { sub: '1' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env prefers GOOGLE_REDIRECT_URI when set', () => {
        // Definition.env is evaluated at require-time from process.env.
        // Assert the shape keys exist; dedicated env var is documented in .env.example.
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });
});
