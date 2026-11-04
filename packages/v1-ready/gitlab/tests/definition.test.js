const { Definition } = require('../definition');
const { Api } = require('../api');

describe('GitLab Definition', () => {
    it('is an oauth2 module named gitlab wired to the Api class', () => {
        expect(Definition.moduleName).toBe('gitlab');
        expect(Definition.getName()).toBe('gitlab');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('GitLab');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements via the Api', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app/redirect/gitlab',
            scope: 'api read_user',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('/oauth/authorize');
    });

    it('persists OAuth tokens and host', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'host',
            ],
            entity: ['host'],
        });
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        const token = await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code' },
        });
        expect(seen).toBe('auth-code');
        expect(token.access_token).toBe('a');
    });

    it('getToken throws when code is missing', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getToken(api, { data: {} })
        ).rejects.toThrow(/missing authorization code/i);
    });

    it('getEntityDetails derives externalId from GET /user id', async () => {
        const api = new Api({ access_token: 't', host: 'https://gitlab.com' });
        api.getCurrentUser = async () => ({
            id: 42,
            username: 'jane',
            name: 'Jane Doe',
            public_email: 'jane-public@example.com',
            email: 'jane-private@example.com',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('42');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Jane Doe');
        expect(details.details.username).toBe('jane');
        expect(details.details.email).toBe('jane-public@example.com');
        expect(details.details.host).toBe('https://gitlab.com');
    });

    it('getCredentialDetails uses the same user id', async () => {
        const api = new Api({ access_token: 't' });
        api.getCurrentUser = async () => ({ id: 99, username: 'bob' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('99');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('throws when GET /user has no id', async () => {
        const api = new Api({ access_token: 't' });
        api.getCurrentUser = async () => ({ username: 'orphan' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable externalId/i);
    });

    it('testAuthRequest calls getCurrentUser', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getCurrentUser = async () => {
            called = true;
            return { id: 1 };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('omits redirect_uri when REDIRECT_URI is unset', () => {
        expect(Definition.env.redirect_uri).toBe(
            process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/gitlab`
                : undefined
        );
    });

});
