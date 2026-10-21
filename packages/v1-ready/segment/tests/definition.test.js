const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('Segment Definition', () => {
    it('is an api-key module named segment wired to the Api class', () => {
        expect(Definition.moduleName).toBe('segment');
        expect(Definition.getName()).toBe('segment');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Segment');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for the Public API token', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toContain('access_token');
        expect(reqs.data.jsonSchema.properties.access_token.type).toBe(
            'string'
        );
        expect(reqs.data.uiSchema.access_token['ui:widget']).toBe('password');
        expect(reqs.data.jsonSchema.properties.profile_api_token).toBeTruthy();
        expect(reqs.data.jsonSchema.properties.space_id).toBeTruthy();
    });

    it('persists Public API token plus optional Profile credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'profile_api_token', 'space_id'],
            entity: [],
        });
    });

    it('setAuthParams sets Public and Profile credentials', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            access_token: 'pub-token',
            profile_api_token: 'prof-token',
            space_id: 'space_1',
        });
        expect(api.access_token).toBe('pub-token');
        expect(api.profile_api_token).toBe('prof-token');
        expect(api.space_id).toBe('space_1');
    });

    it('getEntityDetails derives externalId from workspace id', async () => {
        const api = new Api({ access_token: 'k' });
        api.getWorkspace = async () => ({
            data: {
                workspace: {
                    id: 'ws_abc',
                    name: 'Acme CDP',
                    slug: 'acme-cdp',
                },
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('ws_abc');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme CDP');
    });

    it('getEntityDetails falls back to token fingerprint when getWorkspace fails', async () => {
        const api = new Api({ access_token: 'key-abc' });
        api.getWorkspace = async () => {
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
            const api = new Api({ access_token: key });
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

        expect(await idFor('cust-A-key')).toBe(await idFor('cust-A-key'));
        expect(await idFor('cust-A-key')).not.toBe(await idFor('cust-B-key'));
    });

    it('throws rather than returning a shared constant when nothing can be derived', async () => {
        const api = new Api({});
        api.access_token = null;
        api.api_key = null;
        api.getWorkspace = async () => ({ data: {} });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest performs getWorkspace', async () => {
        const api = new Api({ access_token: 'k' });
        let called = false;
        api.getWorkspace = async () => {
            called = true;
            return { data: { workspace: { id: 'w' } } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('references ADR-057 mappings via extensions.mapping', () => {
        expect(Definition.mappings).toEqual({
            business: 'extensions.mapping',
        });
        const indexSrc = fs.readFileSync(
            path.join(__dirname, '..', 'index.js'),
            'utf8'
        );
        expect(indexSrc).toMatch(/status:\s*'UNVALIDATED'/);
        expect(indexSrc).toMatch(/mappings\/contact/);
        expect(indexSrc).toMatch(/mappings\/company/);
    });
});
