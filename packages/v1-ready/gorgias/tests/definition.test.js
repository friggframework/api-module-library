const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Gorgias Definition', () => {
    it('is an oauth2 module named gorgias wired to the Api class', () => {
        expect(Definition.moduleName).toBe('gorgias');
        expect(Definition.getName()).toBe('gorgias');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Gorgias');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an oauth2 authorization form requiring subdomain', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('oauth2');
        expect(reqs.data.jsonSchema.required).toContain('subdomain');
        expect(reqs.data.jsonSchema.properties.subdomain.type).toBe('string');
        expect(reqs.url).toContain('gorgias.com/oauth/authorize');
        expect(reqs.url).not.toContain('{{subdomain}}');
    });

    it('persists oauth tokens, subdomain, and optional basic-auth fields', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'subdomain',
                'api_key',
                'api_user_email',
            ],
            entity: [],
        });
    });

    it('getToken sets subdomain then exchanges the code', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://app.example.com/redirect/gorgias',
        });
        let calledWith;
        api.getTokenFromCode = async (code) => {
            calledWith = { code, subdomain: api.subdomain };
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code', subdomain: 'acme' },
        });
        expect(calledWith).toEqual({ code: 'auth-code', subdomain: 'acme' });
        expect(api.baseUrl).toBe('https://acme.gorgias.com/api');
    });

    it('getToken accepts account as subdomain alias', async () => {
        const api = new Api({ client_id: 'c', client_secret: 's' });
        api.getTokenFromCode = async () => ({ access_token: 'a' });
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'c', account: 'shop' },
        });
        expect(api.subdomain).toBe('shop');
    });

    it('setAuthParams applies private-app Basic credentials', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            subdomain: 'acme',
            api_user_email: 'agent@acme.com',
            api_key: 'key',
        });
        expect(api.subdomain).toBe('acme');
        expect(api.api_user_email).toBe('agent@acme.com');
        expect(api.api_key).toBe('key');
        const headers = await api.addAuthHeaders({});
        expect(headers.Authorization).toMatch(/^Basic /);
    });

    it('getEntityDetails uses account.domain', async () => {
        const api = new Api({ subdomain: 'acme' });
        api.getAccount = async () => ({ domain: 'acme' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('acme');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('acme');
    });

    it('getEntityDetails falls back to subdomain when /account fails', async () => {
        const api = new Api({ subdomain: 'fallback-domain' });
        api.getAccount = async () => {
            throw new Error('boom');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('fallback-domain');
    });

    it('throws when neither account domain nor subdomain is available', async () => {
        const api = new Api({});
        api.getAccount = async () => ({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest calls getAccount', async () => {
        const api = new Api({ subdomain: 'acme' });
        let called = false;
        api.getAccount = async () => {
            called = true;
            return { domain: 'acme' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('source does not hard-code OAuth state', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'api.js'),
            'utf8'
        );
        expect(src).not.toMatch(/kxzcjhvwaasdbnfrtlkxu9ih/);
        expect(src).not.toMatch(/\{\{subdomain\}\}/);
    });
});
