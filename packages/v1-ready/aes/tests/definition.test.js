const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const md5 = (v) => crypto.createHash('md5').update(String(v)).digest('hex');

describe('AES Definition', () => {
    it('is an api-key module named aes wired to the Api class', () => {
        expect(Definition.moduleName).toBe('aes');
        expect(Definition.getName()).toBe('aes');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('AES');
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

    it('getEntityDetails uses MD5(api_key) and prefers event_title for name', async () => {
        const api = new Api({ api_key: 'org-key' });
        api.getOrganizationEvents = async () => [
            { event_id: 1, event_title: 'Gala 2026' },
        ];
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe(md5('org-key'));
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Gala 2026');
    });

    it('getEntityDetails falls back to a default name when no events', async () => {
        const api = new Api({ api_key: 'key-abc' });
        api.getOrganizationEvents = async () => [];
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe(md5('key-abc'));
        expect(details.details.name).toBe('AES Organization');
    });

    it('getEntityDetails still fingerprints when the API throws', async () => {
        const api = new Api({ api_key: 'key-boom' });
        api.getOrganizationEvents = async () => {
            throw new Error('boom');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-3'
        );
        expect(details.identifiers.externalId).toBe(md5('key-boom'));
    });

    it('fingerprint is STABLE for the same key and UNIQUE across keys', async () => {
        const makeApi = (key) => {
            const api = new Api({ api_key: key });
            api.getOrganizationEvents = async () => [];
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

    it('throws rather than returning a shared constant when no key', async () => {
        const api = new Api({});
        api.api_key = null;
        api.getOrganizationEvents = async () => [];
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable organization identity/i);
    });

    it('retains NO hardcoded shared-account constant in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]aes-account['"]/);
    });

    it('testAuthRequest performs getOrganizationEvents', async () => {
        const api = new Api({ api_key: 'k' });
        let called = false;
        api.getOrganizationEvents = async () => {
            called = true;
            return [];
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
