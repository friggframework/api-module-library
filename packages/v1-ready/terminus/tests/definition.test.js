const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('Terminus Definition', () => {
    it('is an api-key module named terminus wired to the Api class', () => {
        expect(Definition.moduleName).toBe('terminus');
        expect(Definition.getName()).toBe('terminus');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Terminus');
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

    it('persists only the raw api_token credential', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_token'],
            entity: [],
        });
    });

    it('setAuthParams sets the api token from form params', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'form-key',
        });
        expect(api.api_token).toBe('form-key');
        expect(api.api_key).toBe('Bearer form-key');
    });

    it('getEntityDetails derives externalId from folder orgUuid', async () => {
        const api = new Api({ api_key: 'k' });
        api.listFolders = async () => ({
            folders: [
                {
                    uuid: 'folder-1',
                    name: 'Primary',
                    orgUuid: 'org-abc-123',
                    folderAccess: 'PUBLIC',
                },
            ],
            nextPageToken: '',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('org-abc-123');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Primary');
    });

    it('getEntityDetails falls back to the api-key fingerprint with no folders', async () => {
        const api = new Api({ api_key: 'key-abc' });
        api.listFolders = async () => ({ folders: [], nextPageToken: '' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-abc'));
        expect(details.identifiers.externalId).not.toBe('terminus-account');
    });

    it('getEntityDetails uses the fingerprint if the API throws', async () => {
        const api = new Api({ api_key: 'key-boom' });
        api.listFolders = async () => {
            throw new Error('boom');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-3'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-boom'));
    });

    it('fingerprint fallback is STABLE for the same key and UNIQUE across keys', async () => {
        const makeApi = (key) => {
            const api = new Api({ api_key: key });
            api.listFolders = async () => ({ folders: [] });
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
        api.api_token = null;
        api.api_key = null;
        api.listFolders = async () => ({ folders: [] });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]terminus-account['"]/);
    });

    it('testAuthRequest performs an authenticated listFolders call', async () => {
        const api = new Api({ api_key: 'k' });
        let called = false;
        api.testAuth = async () => {
            called = true;
            return { folders: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
