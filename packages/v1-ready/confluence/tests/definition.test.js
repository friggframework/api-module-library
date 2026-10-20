const { Definition } = require('../definition');
const { Api } = require('../api');

const CLOUD = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('Confluence Definition', () => {
    it('is an oauth2 module named confluence wired to the Api class', () => {
        expect(Definition.moduleName).toBe('confluence');
        expect(Definition.getName()).toBe('confluence');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Confluence');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements via the Api', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://example.com/redirect/confluence',
            scope: 'read:me offline_access read:space:confluence',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('auth.atlassian.com/authorize');
    });

    it('persists oauth tokens and site identity fields', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'cloudId',
                'siteUrl',
                'siteName',
            ],
            entity: ['cloudId'],
        });
    });

    it('getToken exchanges the authorization code and resolves cloudId', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'at', refresh_token: 'rt', expires_in: 3600 };
        };
        api.resolveCloudId = async () => {
            api.setCloudId(CLOUD, {
                siteUrl: 'https://acme.atlassian.net',
                siteName: 'Acme',
            });
            return { id: CLOUD, url: 'https://acme.atlassian.net', name: 'Acme' };
        };
        const result = await Definition.requiredAuthMethods.getToken(api, {
            code: 'auth-code',
        });
        expect(seen).toBe('auth-code');
        expect(result.cloudId).toBe(CLOUD);
        expect(result.siteName).toBe('Acme');
    });

    it('getEntityDetails uses cloudId from the token response', async () => {
        const api = new Api({ access_token: 't' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {
                cloudId: CLOUD,
                siteName: 'Acme Corp',
                siteUrl: 'https://acme.atlassian.net',
            },
            'user-1'
        );
        expect(details.identifiers.externalId).toBe(CLOUD);
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Corp');
        expect(api.cloudId).toBe(CLOUD);
    });

    it('getEntityDetails falls back to resolveCloudId', async () => {
        const api = new Api({ access_token: 't' });
        api.resolveCloudId = async () => {
            api.setCloudId(CLOUD, { siteName: 'Resolved' });
            return { id: CLOUD, name: 'Resolved' };
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe(CLOUD);
        expect(details.details.name).toBe('Resolved');
    });

    it('getCredentialDetails uses persisted cloudId', async () => {
        const api = new Api({
            access_token: 't',
            cloudId: CLOUD,
            siteName: 'Cred Site',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe(CLOUD);
    });

    it('testAuthRequest lists spaces after ensuring cloudId', async () => {
        const api = new Api({ access_token: 't', cloudId: CLOUD });
        let called = false;
        api.getSpaces = async (params) => {
            called = true;
            expect(params).toEqual({ limit: 1 });
            return { results: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
