const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Zendesk Definition', () => {
    it('is an oauth2 module named zendesk wired to the Api class', () => {
        expect(Definition.moduleName).toBe('zendesk');
        expect(Definition.getName()).toBe('zendesk');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Zendesk');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements via the Api', () => {
        const api = new Api({ subdomain: 'acme', client_id: 'cid' });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.data.jsonSchema.required).toContain('subdomain');
    });

    it('persists tokens and subdomain on the credential', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'subdomain',
            ],
            entity: ['subdomain'],
        });
    });

    it('getToken sets subdomain then exchanges the code', async () => {
        const api = new Api({ client_id: 'cid', client_secret: 'sec' });
        let exchanged;
        api.getTokenFromCode = async (code) => {
            exchanged = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code', subdomain: 'acme' },
        });
        expect(api.subdomain).toBe('acme');
        expect(api.baseUrl).toBe('https://acme.zendesk.com/api/v2');
        expect(exchanged).toBe('auth-code');
    });

    it('getToken throws when code or subdomain is missing', async () => {
        await expect(
            Definition.requiredAuthMethods.getToken(new Api({}), {
                data: { subdomain: 'acme' },
            })
        ).rejects.toThrow(/authorization code/i);
        await expect(
            Definition.requiredAuthMethods.getToken(new Api({}), {
                data: { code: 'c' },
            })
        ).rejects.toThrow(/subdomain/i);
    });

    it('getEntityDetails uses subdomain:user.id as externalId', async () => {
        const api = new Api({ subdomain: 'acme', access_token: 't' });
        api.getCurrentUser = async () => ({
            user: { id: 42, name: 'Ada', email: 'ada@acme.com' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('acme:42');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Ada');
        expect(details.details.subdomain).toBe('acme');
        expect(details.details.email).toBe('ada@acme.com');
    });

    it('getCredentialDetails mirrors the identity', async () => {
        const api = new Api({ subdomain: 'acme' });
        api.getCurrentUser = async () => ({
            user: { id: 9, name: 'Bob' },
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('acme:9');
        expect(details.identifiers.userId).toBe('user-c');
        expect(details.details.subdomain).toBe('acme');
    });

    it('testAuthRequest calls getCurrentUser', async () => {
        const api = new Api({ subdomain: 'acme' });
        let called = false;
        api.getCurrentUser = async () => {
            called = true;
            return { user: { id: 1 } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env maps ZENDESK_* credentials and redirect', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env.redirect_uri).toMatch(/\/zendesk$/);
    });

    it('does not export Mongoose manager/models from the package entry', () => {
        const pkg = require('../index');
        expect(pkg.Api).toBe(Api);
        expect(pkg.Definition).toBe(Definition);
        expect(pkg.ModuleManager).toBeUndefined();
        expect(pkg.Credential).toBeUndefined();
        expect(pkg.Entity).toBeUndefined();
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'index.js'),
            'utf8'
        );
        expect(src).not.toMatch(/manager/i);
        expect(src).not.toMatch(/models\//);
    });
});
