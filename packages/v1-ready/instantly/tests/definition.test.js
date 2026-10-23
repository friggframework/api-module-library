const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('Instantly Definition', () => {
    it('is an api-key module named instantly wired to the Api class', () => {
        expect(Definition.moduleName).toBe('instantly');
        expect(Definition.getName()).toBe('instantly');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Instantly');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for the api_key field', async () => {
        const api = new Api({});
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
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

    it('getEntityDetails derives externalId from workspace id', async () => {
        const api = new Api({ api_key: 'k' });
        api.getWorkspace = async () => ({
            id: 'ws-123',
            name: 'Acme Outreach',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('ws-123');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Outreach');
    });

    it('getEntityDetails falls back to the api-key fingerprint when workspace fails', async () => {
        const api = new Api({ api_key: 'key-abc' });
        api.getWorkspace = async () => {
            throw new Error('missing scope');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-abc'));
        expect(details.identifiers.externalId).not.toBe('instantly-account');
    });

    it('getEntityDetails falls back when workspace has no id', async () => {
        const api = new Api({ api_key: 'key-xyz' });
        api.getWorkspace = async () => ({ name: 'Nameless' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2b'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-xyz'));
    });

    it('fingerprint fallback is STABLE for the same key and UNIQUE across keys', async () => {
        const makeApi = (key) => {
            const api = new Api({ api_key: key });
            api.getWorkspace = async () => {
                throw new Error('nope');
            };
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
        const credIdFor = async (key) =>
            (
                await Definition.requiredAuthMethods.getCredentialDetails(
                    makeApi(key),
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
        api.getWorkspace = async () => ({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]instantly-account['"]/);
    });

    it('testAuthRequest performs getWorkspace via testAuth', async () => {
        const api = new Api({ api_key: 'k' });
        let called = false;
        api.testAuth = async () => {
            called = true;
            return { id: 'ws' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env reads INSTANTLY_API_KEY', () => {
        expect(Object.keys(Definition.env)).toContain('api_key');
    });
});
