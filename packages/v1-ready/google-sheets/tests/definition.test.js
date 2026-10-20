const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Google Sheets Definition', () => {
    it('is an oauth2 module named google-sheets wired to the Api class', () => {
        expect(Definition.moduleName).toBe('google-sheets');
        expect(Definition.getName()).toBe('google-sheets');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('GoogleSheets');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists access_token and refresh_token credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: [],
        });
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/google-sheets',
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
            redirect_uri: 'https://ex.com/r/google-sheets',
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

    it('getEntityDetails uses OAuth2 userinfo id and name', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/google-sheets',
            access_token: 't',
        });
        api.getUserDetails = async () => ({
            id: '98765',
            name: 'Sean Matthews',
            email: 'sean@example.com',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('98765');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Sean Matthews');
    });

    it('getCredentialDetails uses the same user id', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/google-sheets',
            access_token: 't',
        });
        api.getUserDetails = async () => ({
            id: '111',
            name: 'A',
            email: 'a@x.com',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('111');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('throws when userinfo has no id', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/google-sheets',
            access_token: 't',
        });
        api.getUserDetails = async () => ({ name: 'No Id' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable user identity/i);
    });

    it('testAuthRequest calls getUserDetails', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/google-sheets',
            access_token: 't',
        });
        let called = false;
        api.getUserDetails = async () => {
            called = true;
            return { id: '1' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env wires GOOGLE_SHEETS_* client credentials and /google-sheets redirect', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });
});
