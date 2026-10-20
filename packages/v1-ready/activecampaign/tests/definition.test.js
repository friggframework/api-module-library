const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('ActiveCampaign Definition', () => {
    it('is an api-key module named activecampaign wired to the Api class', () => {
        expect(Definition.moduleName).toBe('activecampaign');
        expect(Definition.getName()).toBe('activecampaign');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('ActiveCampaign');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for api_url + api_key', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['api_url', 'api_key'])
        );
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('persists api_key and api_url credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_key', 'api_url'],
            entity: [],
        });
    });

    it('setAuthParams sets api key and api url', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'form-key',
            api_url: 'https://tenant.api-us1.com',
        });
        expect(api.api_key).toBe('form-key');
        expect(api.api_url).toBe('https://tenant.api-us1.com');
        expect(api.baseUrl).toBe('https://tenant.api-us1.com/api/3');
    });

    it('getEntityDetails derives externalId from /users/me', async () => {
        const api = new Api({
            api_key: 'k',
            api_url: 'https://demo.api-us1.com',
        });
        api.getUser = async () => ({
            user: {
                id: '42',
                username: 'jdoe',
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com',
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('42');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Jane Doe');
        expect(details.details.email).toBe('jane@example.com');
    });

    it('getCredentialDetails uses the same user id', async () => {
        const api = new Api({ api_key: 'k' });
        api.getUser = async () => ({
            user: { id: '7', username: 'u' },
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('7');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getUser', async () => {
        const api = new Api({ api_key: 'k' });
        let called = false;
        api.getUser = async () => {
            called = true;
            return { user: { id: '1' } };
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
                path.join(__dirname, '..', 'activecampaign.capabilities.json'),
                'utf8'
            )
        );
        expect(caps.version).toBe(
            require('../package.json').version
        );
        expect(caps.module).toBe('activecampaign');
        expect(caps.package).toBe('@friggframework/api-module-activecampaign');
        expect(caps.auth).toBe('apiKey');

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
