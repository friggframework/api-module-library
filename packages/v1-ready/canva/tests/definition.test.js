const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Canva Definition', () => {
    it('is an oauth2 module named canva wired to the Api class', () => {
        expect(Definition.moduleName).toBe('canva');
        expect(Definition.getName()).toBe('canva');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Canva');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists access/refresh tokens on the credential and team_id on the entity', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token', 'accessTokenExpire'],
            entity: ['team_id'],
        });
    });

    it('getToken exchanges code with PKCE code_verifier from params.data', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://x/canva',
        });
        let seen;
        api.getTokenFromCode = async (code, verifier) => {
            seen = { code, verifier };
            return { access_token: 'a' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code', code_verifier: 'pkce-v' },
        });
        expect(seen).toEqual({ code: 'auth-code', verifier: 'pkce-v' });
    });

    it('getEntityDetails prefers introspect sub (v1 getTokenIdentity) as externalId', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://x/canva',
        });
        api.getUserDetails = async () => ({
            sub: 'introspect_sub',
            user_id: 'u_123',
            team_id: 't_456',
            name: 'Jane Doe',
            email: 'jane@example.com',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('introspect_sub');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Jane Doe');
        expect(details.details.team_id).toBe('t_456');
    });

    it('getCredentialDetails uses the same introspect sub', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://x/canva',
        });
        api.getUserDetails = async () => ({
            sub: 'cred_sub',
            user_id: 'u_abc',
            team_id: 't1',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('cred_sub');
    });

    it('testAuthRequest calls usersMe', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://x/canva',
        });
        let called = false;
        api.usersMe = async () => {
            called = true;
            return { team_user: { user_id: 'u', team_id: 't' } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env wires CANVA_* credentials and /canva redirect', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env.redirect_uri).toBe(
            process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/canva`
                : undefined
        );
    });
});
