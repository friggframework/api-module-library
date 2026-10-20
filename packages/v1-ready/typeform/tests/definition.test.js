const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Typeform Definition', () => {
    it('is an oauth2 module named typeform wired to the Api class', () => {
        expect(Definition.moduleName).toBe('typeform');
        expect(Definition.getName()).toBe('typeform');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Typeform');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes getToken and persists access/refresh tokens', () => {
        expect(typeof Definition.requiredAuthMethods.getToken).toBe('function');
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: [],
        });
    });

    it('getEntityDetails derives externalId from /me email', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
            access_token: 't',
        });
        api.getMe = async () => ({
            alias: 'Batman',
            email: 'bruce@wayne.com',
            language: 'en',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('bruce@wayne.com');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Batman');
        expect(details.details.email).toBe('bruce@wayne.com');
    });

    it('getEntityDetails falls back to email as name when alias missing', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        api.getMe = async () => ({ email: 'a@b.com', language: 'en' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'u'
        );
        expect(details.details.name).toBe('a@b.com');
    });

    it('throws when /me has no email', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        api.getMe = async () => ({ alias: 'NoEmail' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('getCredentialDetails uses the same email externalId', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        api.getMe = async () => ({
            alias: 'A',
            email: 'cred@example.com',
            language: 'en',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('cred@example.com');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getMe', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        let called = false;
        api.getMe = async () => {
            called = true;
            return { email: 'x@y.com' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('getToken reads code from flat or nested params', async () => {
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
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'nested-code' },
        });
        expect(seen).toBe('nested-code');
        await Definition.requiredAuthMethods.getToken(api, {
            code: 'flat-code',
        });
        expect(seen).toBe('flat-code');
    });

    it('env maps TYPEFORM_* and redirect_uri', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
        expect(Definition.env.redirect_uri).toBe(
            process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/typeform`
                : undefined
        );
        expect(Definition.env).toHaveProperty('base_url');
    });
});
