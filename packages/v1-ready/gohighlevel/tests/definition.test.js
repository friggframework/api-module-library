const { Definition } = require('../definition');
const { Api } = require('../api');

describe('GoHighLevel Definition', () => {
    it('is a gohighlevel OAuth module wired to the Api class', () => {
        expect(Definition.moduleName).toBe('gohighlevel');
        expect(Definition.getName()).toBe('gohighlevel');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('GoHighLevel');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain(
            'marketplace.gohighlevel.com/v2/oauth/chooselocation'
        );
    });

    it('persists OAuth tokens on credential and locationId on entity', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'expires_in',
                'token_type',
            ],
            entity: ['locationId'],
        });
    });

    it('setAuthParams applies tokens and locationId', async () => {
        const api = new Api({});
        api.setTokens = async (p) => {
            api.access_token = p.access_token;
            api.refresh_token = p.refresh_token;
        };
        await Definition.requiredAuthMethods.setAuthParams(api, {
            access_token: 'tok',
            refresh_token: 'ref',
            locationId: 'loc_set',
        });
        expect(api.access_token).toBe('tok');
        expect(api.locationId).toBe('loc_set');
    });

    it('getEntityDetails uses locationId from the token response', async () => {
        const api = new Api({ access_token: 't' });
        api.getLocation = async () => ({
            location: { id: 'loc_abc', name: 'Dental Co' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            { locationId: 'loc_abc' },
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('loc_abc');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Dental Co');
        expect(details.details.locationId).toBe('loc_abc');
    });

    it('getEntityDetails falls back to name when getLocation fails', async () => {
        const api = new Api({ access_token: 't', locationId: 'loc_x' });
        api.getLocation = async () => {
            throw new Error('no locations.readonly');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            { locationId: 'loc_x' },
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('loc_x');
        expect(details.details.name).toBe('GoHighLevel Location');
    });

    it('getEntityDetails throws without locationId', async () => {
        const api = new Api({ access_token: 't' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/locationId is required/);
    });

    it('getCredentialDetails matches entity externalId', async () => {
        const api = new Api({
            access_token: 't',
            locationId: 'loc_cred',
        });
        api.getLocation = async () => ({ location: { name: 'X' } });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('loc_cred');
        expect(details.details.locationId).toBe('loc_cred');
    });

    it('getToken requires a code', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getToken(api, {})
        ).rejects.toThrow(/Authorization code is required/);
    });

    it('testAuthRequest calls api.testAuthRequest', async () => {
        const api = new Api({ access_token: 'k', locationId: 'loc_1' });
        let called = false;
        api.testAuthRequest = async () => {
            called = true;
            return { location: { id: 'loc_1' } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('maps business@1 via Definition.mappings', () => {
        expect(Definition.mappings.business).toBe('extensions.mapping');
    });
});
