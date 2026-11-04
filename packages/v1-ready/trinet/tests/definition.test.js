const { Definition } = require('../definition');
const { Api } = require('../api');

describe('TriNet Definition', () => {
    it('is an oauth2 module named trinet wired to the Api class', () => {
        expect(Definition.moduleName).toBe('trinet');
        expect(Definition.getName()).toBe('trinet');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('TriNet');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements with authorize URL', async () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example.com/redirect/trinet',
            scope: 'platform companies',
        });
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain(
            'https://secure.trinet.com/oauth2/platform-authorize/'
        );
        expect(reqs.url).toContain('client_id=cid');
    });

    it('persists access_token and refresh_token', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: [],
        });
    });

    it('getToken exchanges the OAuth code', async () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'csec',
            redirect_uri: 'https://x/trinet',
        });
        let got;
        api.getTokenFromCode = async (code) => {
            got = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, { code: 'abc' });
        expect(got).toBe('abc');
    });

    it('getEntityDetails uses company id from /core/me', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({
            data: {
                company: {
                    id: '48',
                    name: 'Acme Inc',
                    object: '/core/companies',
                },
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('48');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Inc');
    });

    it('getEntityDetails parses company id from a ref URL', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({
            data: {
                company: {
                    url: 'https://api.trinet.com/core/companies/99',
                    object: '/meta/ref/detail',
                    ref_object: '/core/companies',
                },
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('99');
    });

    it('getEntityDetails falls back to listCompanies', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({ data: { company: null } });
        api.listCompanies = async () => ({
            data: { data: [{ id: '7', name: 'Fallback Co' }] },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-3'
        );
        expect(details.identifiers.externalId).toBe('7');
        expect(details.details.name).toBe('Fallback Co');
    });

    it('throws rather than returning a shared constant when nothing can be derived', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({ data: {} });
        api.listCompanies = async () => ({ data: { data: [] } });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable company identity/i);
    });

    it('getCredentialDetails agrees with entity externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({
            data: { company: { id: '48', name: 'Acme' } },
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

    it('testAuthRequest calls getMe via testAuth', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.testAuth = async () => {
            called = true;
            return { data: {} };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env wires TriNet OAuth env vars', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
        expect(Definition.env.redirect_uri).toBe(
            process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/trinet`
                : undefined
        );
    });
});
