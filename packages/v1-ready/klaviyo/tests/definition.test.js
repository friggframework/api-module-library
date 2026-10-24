const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Klaviyo Definition', () => {
    it('is an oauth2 module named klaviyo wired to the Api class', () => {
        expect(Definition.moduleName).toBe('klaviyo');
        expect(Definition.getName()).toBe('klaviyo');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Klaviyo');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an oauth2 authorization URL with PKCE', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements.call({
                api: new Api({
                    client_id: 'cid',
                    client_secret: 'csec',
                    redirect_uri: 'https://app.example.com/redirect/klaviyo',
                    scope: 'profiles:read',
                }),
            });
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain(
            'https://www.klaviyo.com/oauth/authorize?'
        );
        expect(reqs.url).toContain('code_challenge_method=S256');
    });

    it('persists OAuth tokens and optional api_key', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token', 'api_key'],
            entity: [],
        });
    });

    it('getToken restores PKCE verifier from state and exchanges the code', async () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'csec',
            redirect_uri: 'https://app.example.com/redirect/klaviyo',
        });
        let seen = null;
        api.getTokenFromCode = async (code) => {
            seen = { code, verifier: api.code_verifier };
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            code: 'auth-code',
            state: 'cust~pkce-verifier-value',
        });
        expect(seen).toEqual({
            code: 'auth-code',
            verifier: 'pkce-verifier-value',
        });
    });

    it('setAuthParams optionally sets a private api_key', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'pk_form',
        });
        expect(api.api_key).toBe('pk_form');
    });

    it('getEntityDetails derives externalId from account id', async () => {
        const api = new Api({ access_token: 't' });
        api.listAccounts = async () => ({
            data: [
                {
                    type: 'account',
                    id: 'AbC123',
                    attributes: {
                        contact_information: {
                            organization_name: 'Acme Co',
                        },
                    },
                },
            ],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('AbC123');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Co');
    });

    it('getCredentialDetails uses the same account id', async () => {
        const api = new Api({ access_token: 't' });
        api.listAccounts = async () => ({
            data: [{ type: 'account', id: 'Acct9' }],
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('Acct9');
    });

    it('throws when accounts returns no id', async () => {
        const api = new Api({ access_token: 't' });
        api.listAccounts = async () => ({ data: [] });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/no account id/i);
    });

    it('testAuthRequest performs listAccounts', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.listAccounts = async () => {
            called = true;
            return { data: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env declares OAuth client fields', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });
});
