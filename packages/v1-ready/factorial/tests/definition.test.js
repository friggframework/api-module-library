const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Factorial Definition', () => {
    it('is an oauth2 module named factorial wired to the Api class', () => {
        expect(Definition.moduleName).toBe('factorial');
        expect(Definition.getName()).toBe('factorial');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Factorial');
        expect(Definition.requiredAuthMethods.getToken).toEqual(
            expect.any(Function)
        );
    });

    it('persists access/refresh tokens and company_id', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token', 'api_key'],
            entity: ['company_id'],
        });
    });

    it('env exposes client credentials and redirect_uri', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('redirect_uri');
        expect(Definition.env.redirect_uri).toBe(
            process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/factorial`
                : undefined
        );
        expect(Definition.env).toHaveProperty('scope');
    });

    it('getEntityDetails derives externalId from credentials company_id', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://x/r',
            access_token: 't',
        });
        api.listCredentials = async () => ({
            data: [
                {
                    company_id: 157412,
                    name: 'Left Hook',
                    legal_name: 'Left Hook SL',
                },
            ],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('157412');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Left Hook');
        expect(api.company_id).toBe(157412);
    });

    it('getCredentialDetails agrees with getEntityDetails', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://x/r',
            access_token: 't',
        });
        api.listCredentials = async () => ({
            data: [{ company_id: 99, legal_name: 'Acme' }],
        });
        const entity = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'u'
        );
        const cred = await Definition.requiredAuthMethods.getCredentialDetails(
            api,
            'u'
        );
        expect(entity.identifiers.externalId).toBe(
            cred.identifiers.externalId
        );
        expect(cred.identifiers.externalId).toBe('99');
    });

    it('throws when credentials cannot yield company_id', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://x/r',
            access_token: 't',
        });
        api.listCredentials = async () => ({ data: [] });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest calls listCredentials', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://x/r',
            access_token: 't',
        });
        let called = false;
        api.listCredentials = async () => {
            called = true;
            return { data: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://x/r',
        });
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code' },
        });
        expect(seen).toBe('auth-code');
    });
});
