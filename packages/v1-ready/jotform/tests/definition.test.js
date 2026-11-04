const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Jotform Definition', () => {
    it('is an api-key module named jotform wired to the Api class', () => {
        expect(Definition.moduleName).toBe('jotform');
        expect(Definition.getName()).toBe('jotform');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Jotform');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for api_key (+ optional base_url)', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toContain('api_key');
        expect(reqs.data.jsonSchema.properties.api_key.type).toBe('string');
        expect(reqs.data.jsonSchema.properties.base_url.type).toBe('string');
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('persists api_key and base_url credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_key', 'base_url'],
            entity: [],
        });
    });

    it('setAuthParams sets the api key and optional base url', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'form-key',
            base_url: 'https://eu-api.jotform.com',
        });
        expect(api.api_key).toBe('form-key');
        expect(api.baseUrl).toBe('https://eu-api.jotform.com');
    });

    it('getEntityDetails derives externalId from GET /user username', async () => {
        const api = new Api({ api_key: 'k' });
        api.getUser = async () => ({
            responseCode: 200,
            content: {
                username: 'acme-forms',
                name: 'Acme Forms',
                email: 'ops@acme.example',
                account_type: 'GOLD',
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('acme-forms');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Forms');
        expect(details.details.email).toBe('ops@acme.example');
    });

    it('getEntityDetails accepts an already-unwrapped user payload', async () => {
        const api = new Api({ api_key: 'k' });
        api.getUser = async () => ({
            username: 'plain',
            email: 'plain@example.com',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('plain');
    });

    it('getCredentialDetails uses the same username', async () => {
        const api = new Api({ api_key: 'k' });
        api.getUser = async () => ({
            content: { username: 'cred-user', email: 'c@x.com' },
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('cred-user');
        expect(details.identifiers.userId).toBe('user-c');
        expect(details.details.base_url).toBe('https://api.jotform.com');
    });

    it('throws when GET /user has no username/email', async () => {
        const api = new Api({ api_key: 'k' });
        api.getUser = async () => ({ content: {} });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/externalId/i);
    });

    it('testAuthRequest calls getUser', async () => {
        const api = new Api({ api_key: 'k' });
        let called = false;
        api.getUser = async () => {
            called = true;
            return { content: { username: 'x' } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('exports Api and Definition from index', () => {
        const mod = require('../index');
        expect(mod.Api).toBe(Api);
        expect(mod.Definition).toBe(Definition);
    });

    it('capability methods all exist on Api', () => {
        const caps = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'jotform.capabilities.json'),
                'utf8'
            )
        );
        expect(caps.version).toBe(require('../package.json').version);
        expect(caps.module).toBe('jotform');
        expect(caps.package).toBe('@friggframework/api-module-jotform');
        expect(caps.auth).toBe('apiKey');
        expect(caps.$schema).toContain('capability-manifest/v0.1');

        const missing = [];
        for (const [name, cap] of Object.entries(caps.capabilities || {})) {
            const method = cap.method;
            if (typeof Api.prototype[method] !== 'function') {
                missing.push(`${name} → ${method}`);
            }
        }
        expect(missing).toEqual([]);
    });
});
