const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Neon Definition', () => {
    it('is a basic-auth module named neon wired to the Api class', () => {
        expect(Definition.moduleName).toBe('neon');
        expect(Definition.getName()).toBe('neon');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Neon');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes a basic authorization form for orgId and apiKey', async () => {
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                new Api({})
            );
        expect(reqs.type).toBe('basic');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['orgId', 'apiKey'])
        );
        expect(reqs.data.uiSchema.apiKey['ui:widget']).toBe('password');
    });

    it('persists orgId, apiKey, environment, and baseUrl', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['orgId', 'apiKey', 'environment', 'baseUrl'],
            entity: [],
        });
    });

    it('setAuthParams requires orgId and apiKey and applies them', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.setAuthParams(api, { orgId: 'x' })
        ).rejects.toThrow(/API key/i);

        await Definition.requiredAuthMethods.setAuthParams(api, {
            orgId: 'org-a',
            apiKey: 'key-a',
            environment: 'trial',
        });
        expect(api.orgId).toBe('org-a');
        expect(api.apiKey).toBe('key-a');
        expect(api.baseUrl).toBe('https://trial.neoncrm.com/v2');
    });

    it('getEntityDetails uses Org ID as externalId', async () => {
        const api = new Api({ orgId: 'stable-org', apiKey: 'k' });
        api.getOrganizationProfile = async () => ({
            organizationName: 'Acme Nonprofit',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('stable-org');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Nonprofit');
    });

    it('getEntityDetails falls back to Neon CRM name if profile fails', async () => {
        const api = new Api({ orgId: 'org-z', apiKey: 'k' });
        api.getOrganizationProfile = async () => {
            throw new Error('boom');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'u'
        );
        expect(details.identifiers.externalId).toBe('org-z');
        expect(details.details.name).toBe('Neon CRM');
    });

    it('getCredentialDetails agrees with getEntityDetails on externalId', async () => {
        const api = new Api({ orgId: 'same-org', apiKey: 'k' });
        api.getOrganizationProfile = async () => ({});
        const entity = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'u'
        );
        const cred = await Definition.requiredAuthMethods.getCredentialDetails(
            api,
            'u'
        );
        expect(cred.identifiers.externalId).toBe(
            entity.identifiers.externalId
        );
    });

    it('throws when Org ID is missing', async () => {
        const api = new Api({});
        api.orgId = null;
        api.username = null;
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/Org ID/i);
    });

    it('testAuthRequest calls testAuth', async () => {
        const api = new Api({ orgId: 'o', apiKey: 'k' });
        let called = false;
        api.testAuth = async () => {
            called = true;
            return { ok: true };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('declares business mappings extension pointer', () => {
        expect(Definition.mappings).toEqual({
            business: 'extensions.mapping',
        });
    });
});
