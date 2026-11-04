const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Square Definition', () => {
    it('is an oauth2 module named square wired to the Api class', () => {
        expect(Definition.moduleName).toBe('square');
        expect(Definition.getName()).toBe('square');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Square');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists access_token, refresh_token, and merchant_id', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token', 'merchant_id'],
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
            return { access_token: 'a', merchant_id: 'M1' };
        };
        await Definition.requiredAuthMethods.getToken(api, { code: 'abc' });
        expect(seen).toBe('abc');
    });

    it('getEntityDetails uses RetrieveMerchant me', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
            access_token: 't',
        });
        api.retrieveMerchant = async (id) => {
            expect(id).toBe('me');
            return {
                merchant: { id: 'ML_ABC', business_name: 'Acme Coffee' },
            };
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('ML_ABC');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Coffee');
    });

    it('getEntityDetails falls back to token merchant_id', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        api.retrieveMerchant = async () => {
            throw new Error('network');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            { merchant_id: 'ML_FROM_TOKEN' },
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('ML_FROM_TOKEN');
    });

    it('throws when no merchant identity can be derived', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        api.retrieveMerchant = async () => ({ merchant: {} });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable merchant identity/i);
    });

    it('testAuthRequest calls retrieveMerchant me', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        let called = false;
        api.retrieveMerchant = async (id) => {
            called = id === 'me';
            return { merchant: { id: 'M' } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('declares OAuth env bindings', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });
});
