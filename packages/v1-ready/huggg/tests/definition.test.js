const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('Huggg Definition', () => {
    it('is an api-key module named huggg wired to the Api class', () => {
        expect(Definition.moduleName).toBe('huggg');
        expect(Definition.getName()).toBe('huggg');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Huggg');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
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

    it('setAuthParams reads nested data.api_key', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            data: { api_key: 'nested-key' },
        });
        expect(api.api_key).toBe('nested-key');
    });

    it('getEntityDetails fingerprints the api key', async () => {
        const api = new Api({ api_key: 'key-abc' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-abc'));
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Huggg');
    });

    it('fingerprint is STABLE for the same key and UNIQUE across keys', async () => {
        const idFor = async (key) =>
            (
                await Definition.requiredAuthMethods.getEntityDetails(
                    new Api({ api_key: key }),
                    {},
                    {},
                    'u'
                )
            ).identifiers.externalId;
        const credIdFor = async (key) =>
            (
                await Definition.requiredAuthMethods.getCredentialDetails(
                    new Api({ api_key: key }),
                    'u'
                )
            ).identifiers.externalId;

        expect(await idFor('cust-A-key')).toBe(await idFor('cust-A-key'));
        expect(await idFor('cust-A-key')).not.toBe(await idFor('cust-B-key'));
        expect(await idFor('cust-A-key')).toBe(await credIdFor('cust-A-key'));
    });

    it('throws rather than returning a shared constant when nothing can be derived', async () => {
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
        expect(src).not.toMatch(/externalId:\s*['"]huggg-account['"]/);
    });

    it('testAuthRequest performs an authenticated listProducts call', async () => {
        const api = new Api({ api_key: 'k' });
        let called = false;
        api.listProducts = async () => {
            called = true;
            return { data: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env maps HUGGG_API_KEY', () => {
        expect(Object.keys(Definition.env)).toEqual(
            expect.arrayContaining(['api_key', 'base_url'])
        );
    });
});
