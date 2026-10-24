const { Definition } = require('../definition');
const { Api } = require('../api');

describe('RingCentral Definition', () => {
    it('is an oauth2 module named ringcentral wired to the Api class', () => {
        expect(Definition.moduleName).toBe('ringcentral');
        expect(Definition.getName()).toBe('ringcentral');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('RingCentral');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements via the Api', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example/redirect/ringcentral',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('/restapi/oauth/authorize');
    });

    it('persists access and refresh tokens', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
            ],
            entity: [],
        });
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({});
        api.getTokenFromCode = jest.fn().mockResolvedValue({
            access_token: 'a',
            refresh_token: 'r',
        });
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code' },
        });
        expect(api.getTokenFromCode).toHaveBeenCalledWith('auth-code');
    });

    it('getToken throws when code is missing', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getToken(api, { data: {} })
        ).rejects.toThrow(/authorization code/);
    });

    it('getEntityDetails uses account.id from readAccountInfo', async () => {
        const api = new Api({ access_token: 't' });
        api.readAccountInfo = async () => ({
            id: 401836781008,
            mainNumber: '+15551234567',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('401836781008');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('+15551234567');
        expect(details.details.accountId).toBe('401836781008');
    });

    it('getEntityDetails falls back to extension id', async () => {
        const api = new Api({ access_token: 't' });
        api.readAccountInfo = async () => {
            throw new Error('no account');
        };
        api.readExtension = async () => ({
            id: 256440016,
            name: 'Alice Smith',
            contact: { email: 'alice@example.com' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('256440016');
        expect(details.details.name).toBe('Alice Smith');
        expect(details.details.extensionId).toBe('256440016');
    });

    it('getCredentialDetails matches entity externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.readAccountInfo = async () => ({ id: 'acct-9' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('acct-9');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('throws when neither account nor extension yields an id', async () => {
        const api = new Api({ access_token: 't' });
        api.readAccountInfo = async () => ({});
        api.readExtension = async () => ({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest calls readExtension', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.readExtension = async (a, e) => {
            called = true;
            expect(a).toBe('~');
            expect(e).toBe('~');
            return { id: 1 };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('wires env from RINGCENTRAL_* variables', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });
});
