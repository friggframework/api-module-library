const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Salesloft Definition', () => {
    it('is an oauth2 module named salesloft wired to the Api class', () => {
        expect(Definition.moduleName).toBe('salesloft');
        expect(Definition.getName()).toBe('salesloft');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Salesloft');
    });

    it('exposes oauth2 authorization requirements with the authorize URL', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example/redirect/salesloft',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain(
            'https://accounts.salesloft.com/oauth/authorize'
        );
        expect(reqs.url).toContain('client_id=cid');
    });

    it('persists access_token and refresh_token', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: [],
        });
    });

    it('getToken exchanges the authorization code', async () => {
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

    it('getEntityDetails uses team id as externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.getTeam = async () => ({
            data: { id: 9911, name: 'Left Hook Team' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('9911');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Left Hook Team');
    });

    it('getCredentialDetails uses team id as externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.getTeam = async () => ({ data: { id: 42, name: 'T' } });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('42');
    });

    it('throws when team identity cannot be resolved', async () => {
        const api = new Api({ access_token: 't' });
        api.getTeam = async () => ({ data: {} });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/team id/i);
    });

    it('testAuthRequest calls getMe', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getMe = async () => {
            called = true;
            return { data: { id: 1 } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('declares Salesloft OAuth env bindings', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });
});
