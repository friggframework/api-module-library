const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('Left Hook Definition', () => {
    it('is an api-key module named lefthook-api wired to the Api class', () => {
        expect(Definition.moduleName).toBe('lefthook-api');
        expect(Definition.getName()).toBe('lefthook-api');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('LefthookApi');
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

    it('setAuthParams sets the bare api key from form params', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'Bearer form-key',
        });
        expect(api.api_key).toBe('form-key');
    });

    it('getEntityDetails uses the api-key fingerprint', async () => {
        const api = new Api({ api_key: 'key-abc' });
        api.verifyAuth = async () => ({ ok: true });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-abc'));
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Left Hook API');
    });

    it('fingerprint is STABLE for the same key and UNIQUE across keys', async () => {
        const makeApi = (key) => {
            const api = new Api({ api_key: key });
            api.verifyAuth = async () => ({ ok: true });
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

    it('throws rather than returning a shared constant when no key exists', async () => {
        const api = new Api({});
        api.api_key = null;
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded client company names in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/lefthookhq/i);
        // No hardcoded framework actor identity in definition
        expect(src).not.toMatch(/actor:\s*\{\s*id:\s*['"]frigg['"]/i);
    });

    it('testAuthRequest calls verifyAuth', async () => {
        const api = new Api({ api_key: 'k' });
        let called = false;
        api.verifyAuth = async () => {
            called = true;
            return { ok: true };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env reads LEFTHOOK_API_KEY', () => {
        expect(Object.keys(Definition.env)).toContain('api_key');
    });
});
