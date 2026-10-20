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

    it('getEntityDetails uses account_id and display_name', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/dropbox',
            access_token: 't',
        });
        api.getCurrentAccount = async () => ({
            account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc',
            name: { display_name: 'Franz Ferdinand (Personal)' },
            email: 'franz@dropbox.com',
        });
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
        expect(details.details.name).toBe('Franz Ferdinand (Personal)');
    });

    it('getCredentialDetails uses the same account_id', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/dropbox',
            access_token: 't',
        });
        api.getCurrentAccount = async () => ({
            account_id: 'dbid:AA',
            name: { display_name: 'A' },
            email: 'a@x.com',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('dbid:AA');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('throws when get_current_account has no account_id', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/dropbox',
            access_token: 't',
        });
        api.getCurrentAccount = async () => ({
            name: { display_name: 'No Id' },
        });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest calls getCurrentAccount', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r/dropbox',
            access_token: 't',
        });
        let called = false;
        api.getCurrentAccount = async () => {
            called = true;
            return { account_id: 'dbid:1' };
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
