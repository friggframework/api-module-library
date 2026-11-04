const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Tekmetric Definition', () => {
    it('is an oauth2 client_credentials module named tekmetric wired to Api', () => {
        expect(Definition.moduleName).toBe('tekmetric');
        expect(Definition.getName()).toBe('tekmetric');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Tekmetric');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes client_credentials authorization requirements', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('oauth2');
        expect(reqs.grant_type).toBe('client_credentials');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['client_id', 'client_secret'])
        );
    });

    it('persists access_token and client credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'client_id', 'client_secret'],
            entity: [],
        });
    });

    it('setAuthParams hydrates client credentials and bearer token', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            client_id: 'c1',
            client_secret: 's1',
            api_key: 'Bearer tok',
        });
        expect(api.client_id).toBe('c1');
        expect(api.client_secret).toBe('s1');
        expect(api.access_token).toBe('tok');
    });

    it('getToken accepts a pre-issued access_token without exchanging', async () => {
        const api = new Api({ client_id: 'c', client_secret: 's' });
        let exchanged = false;
        api.getAccessToken = async () => {
            exchanged = true;
            return { access_token: 'nope' };
        };
        const tokens = await Definition.requiredAuthMethods.getToken(api, {
            data: { access_token: 'provided' },
        });
        expect(tokens.access_token).toBe('provided');
        expect(exchanged).toBe(false);
    });

    it('getToken exchanges client_credentials when no access_token given', async () => {
        const api = new Api({ client_id: 'c', client_secret: 's' });
        api.getAccessToken = async () => ({
            access_token: 'minted',
            scope: '11',
        });
        const tokens = await Definition.requiredAuthMethods.getToken(api, {});
        expect(tokens.access_token).toBe('minted');
    });

    it('getEntityDetails derives externalId from the first shop', async () => {
        const api = new Api({ access_token: 'k' });
        api.listShops = async () => [
            { id: 55, name: 'Main Street Auto', phone: '555' },
        ];
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('55');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Main Street Auto');
        expect(details.details.phone).toBe('555');
    });

    it('getEntityDetails falls back to token-scope shop id', async () => {
        const api = new Api({ access_token: 'k' });
        api.shopIds = ['77'];
        api.listShops = async () => [];
        api.getShop = async (id) => ({ id: Number(id), name: 'Scoped Shop' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('77');
        expect(details.details.name).toBe('Scoped Shop');
    });

    it('getEntityDetails throws when no shop identity can be derived', async () => {
        const api = new Api({ access_token: 'k' });
        api.listShops = async () => [];
        api.shopIds = [];
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable shop identity/i);
    });

    it('getCredentialDetails uses the same shop identity', async () => {
        const api = new Api({ access_token: 'k' });
        api.listShops = async () => [{ id: 3, name: 'Bay 3' }];
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('3');
        expect(details.details.name).toBe('Bay 3');
    });

    it('testAuthRequest performs an authenticated listShops call', async () => {
        const api = new Api({ access_token: 'k' });
        let called = false;
        api.listShops = async () => {
            called = true;
            return [];
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
