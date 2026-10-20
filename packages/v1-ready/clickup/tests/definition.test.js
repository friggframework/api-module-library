const { Definition } = require('../definition');
const { Api } = require('../api');

describe('ClickUp Definition', () => {
    it('is an oauth2 module named clickup wired to the Api class', () => {
        expect(Definition.moduleName).toBe('clickup');
        expect(Definition.getName()).toBe('clickup');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('ClickUp');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements with a URL', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example.com/redirect/clickup',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('https://app.clickup.com/api?');
        expect(reqs.url).toContain('client_id=cid');
    });

    it('persists only the access_token credential', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token'],
            entity: [],
        });
    });

    it('getToken exchanges the OAuth code', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://x/clickup',
        });
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'tok' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'abc' },
        });
        expect(seen).toBe('abc');
    });

    it('getEntityDetails prefers the first authorized team id', async () => {
        const api = new Api({ access_token: 'k' });
        api.getAuthorizedTeams = async () => ({
            teams: [{ id: '999', name: 'Acme WS' }],
        });
        api.getAuthorizedUser = async () => {
            throw new Error('should not be called');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('999');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme WS');
    });

    it('getEntityDetails falls back to authorized user id', async () => {
        const api = new Api({ access_token: 'k' });
        api.getAuthorizedTeams = async () => ({ teams: [] });
        api.getAuthorizedUser = async () => ({
            user: { id: 42, username: 'Pat', email: 'pat@example.com' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('42');
        expect(details.details.name).toBe('Pat');
    });

    it('getCredentialDetails agrees with entity externalId', async () => {
        const api = new Api({ access_token: 'k' });
        api.getAuthorizedTeams = async () => ({
            teams: [{ id: '777', name: 'T' }],
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
        expect(cred.identifiers.externalId).toBe(
            entity.identifiers.externalId
        );
    });

    it('throws when neither teams nor user yield an id', async () => {
        const api = new Api({ access_token: 'k' });
        api.getAuthorizedTeams = async () => ({ teams: [] });
        api.getAuthorizedUser = async () => ({ user: {} });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest calls getAuthorizedUser', async () => {
        const api = new Api({ access_token: 'k' });
        let called = false;
        api.getAuthorizedUser = async () => {
            called = true;
            return { user: { id: 1 } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env maps ClickUp OAuth variables', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });
});
