const { Definition } = require('../definition');
const { Api } = require('../api');

describe('PagerDuty Definition', () => {
    it('is an oauth2 module named pagerduty wired to the Api class', () => {
        expect(Definition.moduleName).toBe('pagerduty');
        expect(Definition.getName()).toBe('pagerduty');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('PagerDuty');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists access_token, refresh_token, account_id, and subdomain', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'account_id',
                'subdomain',
            ],
            entity: [],
        });
    });

    it('getToken exchanges the OAuth code', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'a' };
        };
        await Definition.requiredAuthMethods.getToken(api, { code: 'abc' });
        expect(seen).toBe('abc');
    });

    it('getEntityDetails uses getCurrentUser and prefers account_id', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
            access_token: 't',
            account_id: 'ACCT99',
        });
        api.getCurrentUser = async () => ({
            user: {
                id: 'PUSER',
                name: 'Ada',
                email: 'ada@acme.com',
                html_url: 'https://acme.pagerduty.com/users/PUSER',
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('ACCT99');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Ada');
        expect(details.details.subdomain).toBe('acme');
        expect(details.details.user_id).toBe('PUSER');
    });

    it('getEntityDetails falls back to subdomain from html_url', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        api.getCurrentUser = async () => ({
            user: {
                id: 'PUSER2',
                name: 'Bob',
                html_url: 'https://widgets.pagerduty.com/users/PUSER2',
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('widgets');
        expect(details.details.subdomain).toBe('widgets');
    });

    it('getEntityDetails falls back to id_token claims when /users/me fails', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        api.getCurrentUser = async () => {
            throw new Error('network');
        };
        const idToken =
            'x.' +
            Buffer.from(
                JSON.stringify({
                    account_id: 'FROMJWT',
                    subdomain: 'jwtland',
                    user_id: 'U1',
                })
            ).toString('base64url') +
            '.y';
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            { id_token: idToken },
            'user-3'
        );
        expect(details.identifiers.externalId).toBe('FROMJWT');
        expect(details.details.subdomain).toBe('jwtland');
    });

    it('throws when no account identity can be derived', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        api.getCurrentUser = async () => ({ user: {} });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest calls getCurrentUser', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        let called = false;
        api.getCurrentUser = async () => {
            called = true;
            return { user: { id: 'P' } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('declares OAuth env bindings', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
        expect(Definition.env.redirect_uri).toBe(
            process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/pagerduty`
                : undefined
        );
    });
});
