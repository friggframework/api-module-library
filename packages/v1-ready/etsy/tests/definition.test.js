const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Etsy Definition', () => {
    it('is an etsy module wired to the Api class', () => {
        expect(Definition.moduleName).toBe('etsy');
        expect(Definition.getName()).toBe('etsy');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Etsy');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements with PKCE URL', () => {
        Definition.env.client_id = 'cid';
        Definition.env.client_secret = 'csecret';
        Definition.env.redirect_uri = 'https://app.example/redirect/etsy';
        Definition.env.scope = 'shops_r';
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('www.etsy.com/oauth/connect');
        expect(reqs.url).toContain('code_challenge_method=S256');
    });

    it('persists OAuth access and refresh tokens', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: [],
        });
    });

    it('uses dedicated ETSY_* env keys including ETSY_REDIRECT_URI', () => {
        expect(Object.keys(Definition.env).sort()).toEqual(
            ['client_id', 'client_secret', 'redirect_uri', 'scope'].sort()
        );
    });

    it('getToken restores PKCE verifier from state and exchanges the code', async () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'csecret',
            redirect_uri: 'https://app.example/redirect/etsy',
        });
        const url = api.getAuthorizationUri({ state: 's1' });
        const state = new URL(url).searchParams.get('state');
        let saw;
        api.getTokenFromCode = async (code, verifier) => {
            saw = { code, verifier };
            return { access_token: 'a', refresh_token: 'r' };
        };
        const res = await Definition.requiredAuthMethods.getToken(api, {
            code: 'auth-code',
            state,
        });
        expect(saw.code).toBe('auth-code');
        expect(typeof saw.verifier).toBe('string');
        expect(saw.verifier.length).toBeGreaterThanOrEqual(43);
        expect(res.access_token).toBe('a');
    });

    it('getEntityDetails uses shop_id from getMe as externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({ user_id: 11, shop_id: 22 });
        api.getShop = async (id) => {
            expect(id).toBe(22);
            return { shop_id: 22, shop_name: 'Clay Studio' };
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('22');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Clay Studio');
        expect(details.details.shopId).toBe(22);
    });

    it('getEntityDetails falls back to user_id when shop_id is absent', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({ user_id: 77 });
        api.getShop = async () => {
            throw new Error('should not fetch shop without shop_id');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('77');
    });

    it('getCredentialDetails matches entity externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({ user_id: 1, shop_id: 55 });
        api.getShop = async () => ({ shop_name: 'S' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('55');
    });

    it('testAuthRequest calls getMe', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getMe = async () => {
            called = true;
            return { user_id: 1, shop_id: 2 };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('does not declare ADR-057 mappings (marketplace objects)', () => {
        expect(Definition.mappings).toBeUndefined();
    });
});
