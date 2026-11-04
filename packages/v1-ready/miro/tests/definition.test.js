const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Miro Definition', () => {
    it('is an oauth2 module named miro wired to the Api class', () => {
        expect(Definition.moduleName).toBe('miro');
        expect(Definition.getName()).toBe('miro');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Miro');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements with the authorize URL', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example.com/redirect/miro',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toBe(api.authorizationUri);
        expect(decodeURIComponent(reqs.url)).toContain(
            'https://miro.com/oauth/authorize'
        );
    });

    it('persists access_token and refresh_token credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: [],
        });
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({});
        let seenCode = null;
        api.getTokenFromCode = async (code) => {
            seenCode = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        const result = await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code-1' },
        });
        expect(seenCode).toBe('auth-code-1');
        expect(result.access_token).toBe('a');
    });

    it('getToken throws when the callback has no code', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getToken(api, { data: {} })
        ).rejects.toThrow(/missing authorization code/i);
    });

    it('getEntityDetails derives externalId from token-info user.id', async () => {
        const api = new Api({ access_token: 't' });
        api.getTokenInfo = async () => ({
            type: 'access_token',
            user: { id: 'user-99', name: 'Ada' },
            team: { id: 'team-7', name: 'Left Hook' },
            organization: { id: 'org-1', name: 'LH Org' },
            createdBy: { id: 'user-99' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'frigg-user-1'
        );
        expect(details.identifiers.externalId).toBe('user-99');
        expect(details.identifiers.userId).toBe('frigg-user-1');
        expect(details.details.name).toBe('Left Hook');
        expect(details.details.teamId).toBe('team-7');
        expect(details.details.organizationId).toBe('org-1');
    });

    it('getEntityDetails falls back to user name when team name is missing', async () => {
        const api = new Api({ access_token: 't' });
        api.getTokenInfo = async () => ({
            type: 'access_token',
            user: { id: 'u1', name: 'Solo User' },
            team: { id: 't1' },
            organization: { id: 'o1' },
            createdBy: { id: 'u1' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'u'
        );
        expect(details.details.name).toBe('Solo User');
    });

    it('getEntityDetails throws when token-info has no user.id', async () => {
        const api = new Api({ access_token: 't' });
        api.getTokenInfo = async () => ({ type: 'access_token', user: {} });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('getCredentialDetails uses the same user.id externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.getTokenInfo = async () => ({
            user: { id: 'user-55', name: 'Bob' },
            team: { id: 'team-2', name: 'Team' },
            organization: { id: 'org-2' },
            createdBy: { id: 'user-55' },
            type: 'access_token',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'frigg-u'
            );
        expect(details.identifiers.externalId).toBe('user-55');
        expect(details.identifiers.userId).toBe('frigg-u');
    });

    it('testAuthRequest calls getTokenInfo', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getTokenInfo = async () => {
            called = true;
            return { user: { id: '1' } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env maps MIRO_* client credentials and redirect', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });
});
