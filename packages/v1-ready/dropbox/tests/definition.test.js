const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Dropbox Definition', () => {
    it('is an oauth2 module named dropbox wired to the Api class', () => {
        expect(Definition.moduleName).toBe('dropbox');
        expect(Definition.getName()).toBe('dropbox');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Dropbox');
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
            redirect_uri: 'https://ex.com/r/dropbox',
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
            redirect_uri: 'https://ex.com/r/dropbox',
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

    it('getEntityDetails prefers OpenID sub and given/family name (v1 identity)', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/dropbox',
            access_token: 't',
        });
        api.getUserDetails = async () => ({
            sub: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc',
            given_name: 'Franz',
            family_name: 'Ferdinand',
            email: 'franz@dropbox.com',
        });
        api.getCurrentAccount = async () => {
            throw new Error('should not be called');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe(
            'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc'
        );
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Franz Ferdinand');
    });

    it('getEntityDetails falls back to get_current_account when OpenID fails', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/dropbox',
            access_token: 't',
        });
        api.getUserDetails = async () => {
            throw new Error('no openid scope');
        };
        api.getCurrentAccount = async () => ({
            account_id: 'dbid:FALLBACK',
            name: { display_name: 'Fallback Name' },
            email: 'a@x.com',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('dbid:FALLBACK');
        expect(details.details.name).toBe('Fallback Name');
    });

    it('getCredentialDetails uses the same OpenID sub', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/dropbox',
            access_token: 't',
        });
        api.getUserDetails = async () => ({
            sub: 'dbid:AA',
            given_name: 'A',
            family_name: 'B',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('dbid:AA');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('throws when neither OpenID nor get_current_account yields an id', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/dropbox',
            access_token: 't',
        });
        api.getUserDetails = async () => ({ given_name: 'No Id' });
        api.getCurrentAccount = async () => ({
            name: { display_name: 'No Id' },
        });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest calls getUserDetails (v1 Manager.testAuth)', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/dropbox',
            access_token: 't',
        });
        let called = false;
        api.getUserDetails = async () => {
            called = true;
            return { sub: 'dbid:1' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env wires DROPBOX_* client credentials and /dropbox redirect', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });
});
