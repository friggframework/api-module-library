const { Definition } = require('../definition');
const { Api } = require('../api');

describe('GitHub Definition', () => {
    it('is an oauth2 module named github wired to the Api class', () => {
        expect(Definition.moduleName).toBe('github');
        expect(Definition.getName()).toBe('github');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('GitHub');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example.com/redirect/github',
            scope: 'repo',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('github.com/login/oauth/authorize');
    });

    it('persists access and refresh tokens on the credential', () => {
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

    it('getToken exchanges the code via the api', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 't' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'abc123' },
        });
        expect(seen).toBe('abc123');
    });

    it('getEntityDetails uses GET /user id as externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.getAuthenticatedUser = async () => ({
            id: 4242,
            login: 'octocat',
            name: 'The Octocat',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('4242');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('The Octocat');
        expect(details.details.login).toBe('octocat');
    });

    it('getEntityDetails falls back to login when name is null', async () => {
        const api = new Api({ access_token: 't' });
        api.getAuthenticatedUser = async () => ({
            id: 7,
            login: 'octocat',
            name: null,
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'u'
        );
        expect(details.details.name).toBe('octocat');
    });

    it('getEntityDetails throws when /user has no id', async () => {
        const api = new Api({ access_token: 't' });
        api.getAuthenticatedUser = async () => ({ login: 'x' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/did not return an id/i);
    });

    it('getCredentialDetails uses the same user id', async () => {
        const api = new Api({ access_token: 't' });
        api.getAuthenticatedUser = async () => ({
            id: 99,
            login: 'octocat',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('99');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getAuthenticatedUser', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getAuthenticatedUser = async () => {
            called = true;
            return { id: 1, login: 'x' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('declares OAuth env keys', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });
});
