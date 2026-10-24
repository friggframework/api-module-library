const crypto = require('crypto');
const { Definition, pickOrgIdentity } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('Outreach Definition', () => {
    it('is an oauth2 module named outreach wired to the Api class', () => {
        expect(Definition.moduleName).toBe('outreach');
        expect(Definition.getName()).toBe('outreach');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Outreach');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists OAuth tokens (and optional webhook_secret)', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'webhook_secret',
            ],
            entity: [],
        });
    });

    it('getAuthorizationRequirements returns an oauth2 authorize URL', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example/redirect/outreach',
            scope: 'prospects.read',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('api.outreach.io/oauth/authorize');
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

    it('getToken also accepts a flat code param', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return {};
        };
        await Definition.requiredAuthMethods.getToken(api, { code: 'flat' });
        expect(seen).toBe('flat');
    });

    it('pickOrgIdentity reads orgGuid from meta when present', () => {
        expect(
            pickOrgIdentity({
                meta: { orgGuid: 'org-1', orgName: 'Acme Org' },
            })
        ).toEqual({ externalId: 'org-1', name: 'Acme Org' });
    });

    it('getEntityDetails uses orgGuid from getApiRoot when available', async () => {
        const api = new Api({ access_token: 'tok' });
        api.getApiRoot = async () => ({
            meta: { orgGuid: 'guid-abc', orgName: 'Left Hook' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('guid-abc');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Left Hook');
    });

    it('getEntityDetails falls back to access-token fingerprint', async () => {
        const api = new Api({ access_token: 'token-xyz' });
        api.getApiRoot = async () => ({ meta: {} });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe(sha256('token-xyz'));
    });

    it('getEntityDetails uses the fingerprint if getApiRoot throws', async () => {
        const api = new Api({ access_token: 'token-boom' });
        api.getApiRoot = async () => {
            throw new Error('boom');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-3'
        );
        expect(details.identifiers.externalId).toBe(sha256('token-boom'));
    });

    it('fingerprint fallback is stable for the same token and unique across tokens', async () => {
        const makeApi = (token) => {
            const api = new Api({ access_token: token });
            api.getApiRoot = async () => ({ meta: {} });
            return api;
        };
        const idFor = async (token) =>
            (
                await Definition.requiredAuthMethods.getEntityDetails(
                    makeApi(token),
                    {},
                    {},
                    'u'
                )
            ).identifiers.externalId;

        expect(await idFor('cust-A')).toBe(await idFor('cust-A'));
        expect(await idFor('cust-A')).not.toBe(await idFor('cust-B'));
    });

    it('throws when nothing can be derived', async () => {
        const api = new Api({});
        api.access_token = null;
        api.getApiRoot = async () => ({ meta: {} });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest calls getApiRoot', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getApiRoot = async () => {
            called = true;
            return { meta: {} };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env wires OUTREACH_CLIENT_ID / SECRET / SCOPE and redirect', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });
});
