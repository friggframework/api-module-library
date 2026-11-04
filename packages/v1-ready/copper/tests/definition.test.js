const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Copper Definition', () => {
    it('is an api-key module named copper wired to the Api class', () => {
        expect(Definition.moduleName).toBe('copper');
        expect(Definition.getName()).toBe('copper');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Copper');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for api_key + user_email', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['api_key', 'user_email'])
        );
        expect(reqs.data.jsonSchema.properties.api_key.type).toBe('string');
        expect(reqs.data.jsonSchema.properties.user_email.type).toBe('string');
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('persists api_key and user_email credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_key', 'user_email'],
            entity: [],
        });
    });

    it('setAuthParams sets the api key and user email from form params', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'form-key',
            user_email: 'form@example.com',
        });
        expect(api.api_key).toBe('form-key');
        expect(api.user_email).toBe('form@example.com');
    });

    it('setAuthParams also reads nested params.data', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            data: { api_key: 'nested-key', user_email: 'nested@example.com' },
        });
        expect(api.api_key).toBe('nested-key');
        expect(api.user_email).toBe('nested@example.com');
    });

    it('getEntityDetails derives externalId from GET /account id', async () => {
        const api = new Api({ api_key: 'k', user_email: 'e@x.com' });
        api.getAccount = async () => ({
            id: 12345,
            name: 'Acme Corp',
            primary_timezone: 'America/New_York',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('12345');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Corp');
        expect(details.details.primary_timezone).toBe('America/New_York');
    });

    it('getCredentialDetails uses the same account id', async () => {
        const api = new Api({
            api_key: 'k',
            user_email: 'owner@example.com',
        });
        api.getAccount = async () => ({ id: 99, name: 'Co' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('99');
        expect(details.details.user_email).toBe('owner@example.com');
    });

    it('throws when /account returns no id', async () => {
        const api = new Api({ api_key: 'k' });
        api.getAccount = async () => ({ name: 'broken' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/account id/i);
    });

    it('testAuthRequest performs getAccount', async () => {
        const api = new Api({ api_key: 'k' });
        let called = false;
        api.getAccount = async () => {
            called = true;
            return { id: 1 };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('every capability method exists on Api', () => {
        const manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'copper.capabilities.json'),
                'utf8'
            )
        );
        const methods = Object.getOwnPropertyNames(Api.prototype).filter(
            (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
        );
        const missing = Object.values(manifest.capabilities || {})
            .map((c) => c.method)
            .filter((m) => m && !methods.includes(m));
        expect(missing).toEqual([]);
    });
});
