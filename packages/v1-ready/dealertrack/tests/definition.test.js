const { Definition } = require('../definition');
const { Api, AUTHORIZE_URL } = require('../api');

describe('Dealertrack Definition', () => {
    it('is an oauth2 module named dealertrack wired to the Api class', () => {
        expect(Definition.moduleName).toBe('dealertrack');
        expect(Definition.getName()).toBe('dealertrack');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Dealertrack');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example/redirect/dealertrack',
            scope: 'service customers',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain(AUTHORIZE_URL);
        expect(reqs.url).toContain('client_id=cid');
    });

    it('persists OAuth tokens and dealer/location entity fields', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
            ],
            entity: ['dealerId', 'locationId'],
        });
    });

    it('setAuthParams sets access_token and refresh_token', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            access_token: 'tok',
            refresh_token: 'ref',
        });
        expect(api.access_token).toBe('tok');
        expect(api.refresh_token).toBe('ref');
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'tok' };
        };
        const result = await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code' },
        });
        expect(seen).toBe('auth-code');
        expect(result.access_token).toBe('tok');
    });

    it('getToken throws when code is missing', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getToken(api, { data: {} })
        ).rejects.toThrow(/authorization code/i);
    });

    it('getEntityDetails uses dealer.id from getDealer', async () => {
        const api = new Api({ access_token: 'k' });
        api.getDealer = async () => ({ id: 42, name: 'Acme Motors' });
        api.listLocations = async () => ({
            data: [{ id: 'l1', name: 'Main Lot' }],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('42');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Motors');
        expect(details.details.locationName).toBe('Main Lot');
    });

    it('getEntityDetails throws when dealer id is missing', async () => {
        const api = new Api({ access_token: 'k' });
        api.getDealer = async () => ({ name: 'No Id' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/dealer did not return an id/i);
    });

    it('getCredentialDetails uses dealer.id', async () => {
        const api = new Api({ access_token: 'k' });
        api.getDealer = async () => ({ id: 'd-9', name: 'Shop' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('d-9');
        expect(details.details.name).toBe('Shop');
    });

    it('testAuthRequest calls getDealer', async () => {
        const api = new Api({ access_token: 'k' });
        let called = false;
        api.getDealer = async () => {
            called = true;
            return { id: 1 };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('declares dedicated DEALERTRACK env vars including redirect URI', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });
});
