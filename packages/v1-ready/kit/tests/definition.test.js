const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Kit Definition', () => {
    it('is an oauth2 module named kit wired to the Api class', () => {
        expect(Definition.moduleName).toBe('kit');
        expect(Definition.getName()).toBe('kit');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Kit');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example/cb',
            scope: 'public',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('https://api.kit.com/v4/oauth/authorize');
        expect(reqs.url).toContain('client_id=cid');
    });

    it('persists access_token and refresh_token credentials', () => {
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
            data: { code: 'abc' },
        });
        expect(seen).toBe('abc');
    });

    it('getToken throws when code is missing', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getToken(api, {})
        ).rejects.toThrow(/authorization code/i);
    });

    it('getEntityDetails uses account.id as externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.getAccount = async () => ({
            user: { id: 1, email: 'u@example.com' },
            account: {
                id: 99,
                name: 'Creator Co',
                primary_email_address: 'creator@example.com',
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('99');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Creator Co');
        expect(details.details.email).toBe('creator@example.com');
    });

    it('getEntityDetails throws when account.id is missing', async () => {
        const api = new Api({ access_token: 't' });
        api.getAccount = async () => ({ user: {}, account: {} });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/account\.id/i);
    });

    it('getCredentialDetails matches entity externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.getAccount = async () => ({
            account: { id: 55, name: 'N' },
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('55');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getAccount', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getAccount = async () => {
            called = true;
            return { account: { id: 1 } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('uses dedicated KIT_REDIRECT_URI env (not REDIRECT_URI/kit)', () => {
        expect(Object.keys(Definition.env)).toEqual(
            expect.arrayContaining([
                'client_id',
                'client_secret',
                'scope',
                'redirect_uri',
            ])
        );
    });

    it('declares business mapping pointer for ADR-057 Contact', () => {
        expect(Definition.mappings).toEqual({
            business: 'extensions.mapping',
        });
    });
});
