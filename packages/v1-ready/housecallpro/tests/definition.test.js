const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Housecall Pro Definition', () => {
    it('is an oauth2 module named housecallpro wired to the Api class', () => {
        expect(Definition.moduleName).toBe('housecallpro');
        expect(Definition.getName()).toBe('housecallpro');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('HousecallPro');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists access_token and refresh_token credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: [],
        });
    });

    it('exposes the required auth methods', () => {
        const m = Definition.requiredAuthMethods;
        expect(typeof m.getToken).toBe('function');
        expect(typeof m.getEntityDetails).toBe('function');
        expect(typeof m.getCredentialDetails).toBe('function');
        expect(typeof m.testAuthRequest).toBe('function');
        expect(m.apiPropertiesToPersist).toBeDefined();
    });

    it('getEntityDetails uses company.id as externalId', async () => {
        const api = new Api({});
        api.getCompany = async () => ({ id: 'co-1', name: 'Acme HVAC' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('co-1');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme HVAC');
    });

    it('getEntityDetails throws when company id is missing', async () => {
        const api = new Api({});
        api.getCompany = async () => ({ name: 'No Id' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/company id/i);
    });

    it('getCredentialDetails uses company.id', async () => {
        const api = new Api({});
        api.getCompany = async () => ({ id: 'co-2', name: 'X' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('co-2');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getCompany', async () => {
        const api = new Api({});
        let called = false;
        api.getCompany = async () => {
            called = true;
            return { id: 'a', name: 'n' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('getToken exchanges the OAuth code', async () => {
        const api = new Api({});
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

    it('env keys map to HOUSECALLPRO_* / REDIRECT_URI', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('redirect_uri');
        expect(Definition.env).toHaveProperty('scope');
    });
});
