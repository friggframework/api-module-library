const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Mailchimp Definition', () => {
    it('is an oauth2 module named mailchimp wired to the Api class', () => {
        expect(Definition.moduleName).toBe('mailchimp');
        expect(Definition.getName()).toBe('mailchimp');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Mailchimp');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an oauth2 authorization URL', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements.call({
                api: new Api({
                    client_id: 'cid',
                    client_secret: 'csec',
                    redirect_uri: 'https://app.example.com/redirect/mailchimp',
                }),
            });
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain(
            'https://login.mailchimp.com/oauth2/authorize?'
        );
        expect(reqs.url).toContain('client_id=cid');
    });

    it('persists access_token, api_key, and server_prefix (no refresh_token)', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'api_key', 'server_prefix'],
            entity: [],
        });
    });

    it('getToken exchanges the code via api.getTokenFromCode', async () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'csec',
            redirect_uri: 'https://app.example.com/redirect/mailchimp',
        });
        let seen = null;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'a' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            code: 'auth-code',
        });
        expect(seen).toBe('auth-code');
    });

    it('setAuthParams sets api_key and server_prefix', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'key-us6',
            server_prefix: 'us6',
        });
        expect(api.api_key).toBe('key-us6');
        expect(api.server_prefix).toBe('us6');
        expect(api.baseUrl).toBe('https://us6.api.mailchimp.com/3.0');
    });

    it('getEntityDetails derives externalId from account_id', async () => {
        const api = new Api({ access_token: 't', server_prefix: 'us1' });
        api.getAccount = async () => ({
            account_id: 'acc-123',
            account_name: 'Acme Co',
            email: 'owner@acme.com',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('acc-123');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Co');
        expect(details.details.server_prefix).toBe('us1');
    });

    it('getCredentialDetails uses the same account_id', async () => {
        const api = new Api({ access_token: 't' });
        api.getAccount = async () => ({
            account_id: 'acc-99',
            account_name: 'Zed',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('acc-99');
    });

    it('throws when account_id is missing', async () => {
        const api = new Api({ access_token: 't' });
        api.getAccount = async () => ({ account_name: 'No Id' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/account_id/i);
    });

    it('testAuthRequest pings the API', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.ping = async () => {
            called = true;
            return { health_status: "Everything's Chimpy!" };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
