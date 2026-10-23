const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('Shopmonkey Definition', () => {
    it('is an api-key module named shopmonkey wired to the Api class', () => {
        expect(Definition.moduleName).toBe('shopmonkey');
        expect(Definition.getName()).toBe('shopmonkey');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Shopmonkey');
        expect(Definition.moduleName).toMatch(
            /^[a-zA-Z][a-zA-Z0-9_-]*$/
        );
    });

    it('exposes an apiKey authorization form for the api_key field', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toContain('api_key');
        expect(reqs.data.jsonSchema.properties.api_key.type).toBe('string');
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('persists only the api_key credential', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_key'],
            entity: [],
        });
    });

    it('setAuthParams sets the api key from form params', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'form-key',
        });
        expect(api.api_key).toBe('form-key');
    });

    it('getEntityDetails derives externalId from getCurrentUser', async () => {
        const api = new Api({ api_key: 'k' });
        api.getCurrentUser = async () => ({
            data: {
                id: 'user_42',
                email: 'tech@example.com',
                firstName: 'Ada',
                lastName: 'Lovelace',
                companyId: 'co_1',
                company: { name: 'Example Auto' },
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('user_42');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Example Auto');
        expect(details.details.companyId).toBe('co_1');
    });

    it('getEntityDetails falls back to the api-key fingerprint', async () => {
        const api = new Api({ api_key: 'key-abc' });
        api.getCurrentUser = async () => {
            throw new Error('boom');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-abc'));
    });

    it('fingerprint fallback is STABLE for the same key and UNIQUE across keys', async () => {
        const makeApi = (key) => {
            const api = new Api({ api_key: key });
            api.getCurrentUser = async () => ({ data: {} });
            return api;
        };
        const idFor = async (key) =>
            (
                await Definition.requiredAuthMethods.getEntityDetails(
                    makeApi(key),
                    {},
                    {},
                    'u'
                )
            ).identifiers.externalId;

        expect(await idFor('cust-A-key')).toBe(await idFor('cust-A-key'));
        expect(await idFor('cust-A-key')).not.toBe(await idFor('cust-B-key'));
    });

    it('throws rather than returning a shared constant when nothing can be derived', async () => {
        const api = new Api({});
        api.api_key = null;
        api.getCurrentUser = async () => ({ data: {} });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]shopmonkey-account['"]/);
    });

    it('testAuthRequest performs getApiKeyStatus', async () => {
        const api = new Api({ api_key: 'k' });
        let called = false;
        api.getApiKeyStatus = async () => {
            called = true;
            return { success: true };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env reads SHOPMONKEY_API_KEY', () => {
        expect(Object.keys(Definition.env)).toContain('api_key');
    });
});
