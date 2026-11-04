const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Jobber Definition', () => {
    it('is an oauth2 module named jobber wired to the Api class', () => {
        expect(Definition.moduleName).toBe('jobber');
        expect(Definition.getName()).toBe('jobber');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Jobber');
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

    it('getEntityDetails uses account.id as externalId', async () => {
        const api = new Api({});
        api.getAccount = async () => ({ id: 'acc-1', name: 'Lawn Co' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('acc-1');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Lawn Co');
    });

    it('getEntityDetails throws when account id is missing', async () => {
        const api = new Api({});
        api.getAccount = async () => ({ name: 'No Id' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/account id/i);
    });

    it('getCredentialDetails uses account.id', async () => {
        const api = new Api({});
        api.getAccount = async () => ({ id: 'acc-2', name: 'X' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('acc-2');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getAccount', async () => {
        const api = new Api({});
        let called = false;
        api.getAccount = async () => {
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

    it('env keys map to JOBBER_* / REDIRECT_URI', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });
});
