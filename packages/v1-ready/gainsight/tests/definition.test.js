const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api, DEFAULT_BASE_URL } = require('../api');

const fingerprint = (baseUrl, key) =>
    crypto
        .createHash('sha256')
        .update(`${String(baseUrl || '')}|${String(key || '')}`)
        .digest('hex');

describe('Gainsight Definition', () => {
    it('is an api-key module named gainsight wired to the Api class', () => {
        expect(Definition.moduleName).toBe('gainsight');
        expect(Definition.getName()).toBe('gainsight');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Gainsight');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for access_key + base_url', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['access_key', 'base_url'])
        );
        expect(reqs.data.uiSchema.access_key['ui:widget']).toBe('password');
    });

    it('persists api_key and baseUrl credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_key', 'baseUrl'],
            entity: ['baseUrl'],
        });
    });

    it('setAuthParams sets access key and base URL', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            access_key: 'form-key',
            base_url: 'https://acme.gainsightcloud.com',
        });
        expect(api.api_key).toBe('form-key');
        expect(api.baseUrl).toBe('https://acme.gainsightcloud.com');
    });

    it('getEntityDetails fingerprints baseUrl|access_key', async () => {
        const api = new Api({
            api_key: 'key-abc',
            base_url: 'https://acme.gainsightcloud.com',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe(
            fingerprint('https://acme.gainsightcloud.com', 'key-abc')
        );
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.baseUrl).toBe('https://acme.gainsightcloud.com');
    });

    it('fingerprint is STABLE for the same key+domain and UNIQUE across keys', async () => {
        const makeApi = (key, base) =>
            new Api({ api_key: key, base_url: base });
        const idFor = async (key, base) =>
            (
                await Definition.requiredAuthMethods.getEntityDetails(
                    makeApi(key, base),
                    {},
                    {},
                    'u'
                )
            ).identifiers.externalId;

        expect(
            await idFor('cust-A', 'https://a.gainsightcloud.com')
        ).toBe(await idFor('cust-A', 'https://a.gainsightcloud.com'));
        expect(
            await idFor('cust-A', 'https://a.gainsightcloud.com')
        ).not.toBe(await idFor('cust-B', 'https://a.gainsightcloud.com'));
        expect(
            await idFor('cust-A', 'https://a.gainsightcloud.com')
        ).not.toBe(await idFor('cust-A', 'https://b.gainsightcloud.com'));
    });

    it('throws when nothing can be derived', async () => {
        const api = new Api({});
        api.api_key = null;
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]gainsight-account['"]/);
    });

    it('testAuthRequest performs listObjects', async () => {
        const api = new Api({ api_key: 'k' });
        let called = false;
        api.listObjects = async () => {
            called = true;
            return { data: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('default Api baseUrl matches OpenAPI placeholder when unset', () => {
        expect(new Api({ api_key: 'k' }).baseUrl).toBe(DEFAULT_BASE_URL);
    });

    it('declares ADR-057 mappings pointers', () => {
        expect(Definition.mappings.business).toBe('extensions.mapping');
        expect(Definition.mappings.AccountHealth).toBe('extensions.mapping');
    });
});
