const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('PostHog Definition', () => {
    it('is an api-key module named posthog wired to the Api class', () => {
        expect(Definition.moduleName).toBe('posthog');
        expect(Definition.getName()).toBe('posthog');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('PostHog');
    });

    it('exposes an apiKey authorization form for api_key, project_id, host', async () => {
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['api_key', 'project_id'])
        );
        expect(reqs.data.jsonSchema.properties.api_key.type).toBe('string');
        expect(reqs.data.jsonSchema.properties.host.default).toBe(
            'https://us.posthog.com'
        );
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('persists api_key, project_id, and host on the credential', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_key', 'project_id', 'host'],
            entity: [],
        });
    });

    it('setAuthParams sets key, project, and validated host', async () => {
        const api = new Api({});
        const result = await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: ' form-key',
            project_id: '99',
            host: 'https://eu.posthog.com',
        });
        expect(api.api_key).toBe('form-key');
        expect(api.project_id).toBe('99');
        expect(api.host).toBe('https://eu.posthog.com');
        expect(api.baseUrl).toBe('https://eu.posthog.com');
        expect(result).toEqual({
            api_key: 'form-key',
            project_id: '99',
            host: 'https://eu.posthog.com',
        });
    });

    it('setAuthParams defaults blank host to US cloud', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'k',
            project_id: '1',
            host: '  ',
        });
        expect(api.host).toBe('https://us.posthog.com');
    });

    it('setAuthParams rejects a missing api_key or project_id', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.setAuthParams(api, {
                project_id: '1',
            })
        ).rejects.toThrow(/api_key/i);
        await expect(
            Definition.requiredAuthMethods.setAuthParams(api, {
                api_key: 'k',
            })
        ).rejects.toThrow(/project_id/i);
    });

    it('setAuthParams rejects a non-PostHog host', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.setAuthParams(api, {
                api_key: 'k',
                project_id: '1',
                host: 'https://evil.example.com',
            })
        ).rejects.toThrow(/posthog\.com/i);
    });

    it('getEntityDetails derives externalId from /api/users/@me/ uuid', async () => {
        const api = new Api({ api_key: 'k', project_id: '1' });
        api.getCurrentUser = async () => ({
            uuid: 'user-uuid-1',
            email: 'ada@example.com',
            first_name: 'Ada',
            last_name: 'Lovelace',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('user-uuid-1');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Ada Lovelace');
        expect(details.details.email).toBe('ada@example.com');
        expect(details.details.projectId).toBe('1');
    });

    it('getEntityDetails falls back to the api-key fingerprint when @me fails', async () => {
        const api = new Api({ api_key: 'key-abc', project_id: '1' });
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
            const api = new Api({ api_key: key, project_id: '1' });
            api.getCurrentUser = async () => {
                throw new Error('offline');
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
        api.getCurrentUser = async () => {
            throw new Error('offline');
        };
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded shared-constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]posthog-account['"]/);
    });

    it('testAuthRequest calls getCurrentUser via testAuth', async () => {
        const api = new Api({ api_key: 'k', project_id: '1' });
        let called = false;
        api.getCurrentUser = async () => {
            called = true;
            return { uuid: 'u1' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('declares ADR-057 business mapping via extensions.mapping', () => {
        expect(Definition.mappings).toEqual({
            business: 'extensions.mapping',
        });
    });

    it('env reads POSTHOG_* variables', () => {
        expect(Definition.env).toHaveProperty('api_key');
        expect(Definition.env).toHaveProperty('project_id');
        expect(Definition.env).toHaveProperty('host');
    });
});
