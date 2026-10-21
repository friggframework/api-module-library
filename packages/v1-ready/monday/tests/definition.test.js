const { Definition } = require('../definition');
const { Api } = require('../api');

describe('monday Definition', () => {
    const prevRedirect = process.env.MONDAY_REDIRECT_URI;

    afterAll(() => {
        if (prevRedirect === undefined) delete process.env.MONDAY_REDIRECT_URI;
        else process.env.MONDAY_REDIRECT_URI = prevRedirect;
    });

    it('is an oauth2 module named monday wired to the Api class', () => {
        expect(Definition.moduleName).toBe('monday');
        expect(Definition.getName()).toBe('monday');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Monday');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements with an authorize URL', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example.com/redirect/monday',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('https://auth.monday.com/oauth2/authorize');
    });

    it('persists access_token and accountSlug (classic OAuth has no refresh)', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token'],
            entity: ['accountSlug'],
        });
    });

    it('declares business mappings via extensions.mapping', () => {
        expect(Definition.mappings).toEqual({ business: 'extensions.mapping' });
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'tok' };
        };
        const token = await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code' },
        });
        expect(seen).toBe('auth-code');
        expect(token.access_token).toBe('tok');
    });

    it('getToken throws when the code is missing', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getToken(api, { data: {} })
        ).rejects.toThrow(/authorization code/i);
    });

    it('getEntityDetails derives externalId from me.account.id and sets accountSlug', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({
            id: 'u1',
            name: 'Ada',
            account: { id: 42, name: 'Acme Corp', slug: 'acme' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('42');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Corp');
        expect(api.accountSlug).toBe('acme');
    });

    it('getEntityDetails falls back to account query when me has no account', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({ id: 'u1', name: 'Ada' });
        api.getAccount = async () => ({ id: '99', name: 'Fallback Co' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('99');
        expect(details.details.name).toBe('Fallback Co');
    });

    it('getCredentialDetails uses the same account externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({
            account: { id: '77', name: 'Same' },
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('77');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('throws when neither me nor account can provide an id', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({});
        api.getAccount = async () => null;
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest calls getMe', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getMe = async () => {
            called = true;
            return { id: '1' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env uses dedicated MONDAY_REDIRECT_URI (not REDIRECT_URI/monday)', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
        // Source must reference MONDAY_REDIRECT_URI, not REDIRECT_URI composition.
        const src = require('fs').readFileSync(
            require('path').join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).toMatch(/process\.env\.MONDAY_REDIRECT_URI/);
        expect(src).not.toMatch(
            /redirect_uri:\s*`\$\{process\.env\.REDIRECT_URI\}\/monday`/
        );
    });
});
