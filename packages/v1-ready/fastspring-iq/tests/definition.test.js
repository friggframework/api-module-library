const { Definition } = require('../definition');
const { Api } = require('../api');

describe('FastSpring IQ Definition', () => {
    it('is an api-key module named fastspring-iq wired to the Api class', () => {
        expect(Definition.moduleName).toBe('fastspring-iq');
        expect(Definition.getName()).toBe('fastspring-iq');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('FastSpringIQ');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for the api_key field', () => {
        const api = new Api({});
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toContain('api_key');
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

    it('getEntityDetails derives externalId from organization id', async () => {
        const api = new Api({ api_key: 'k' });
        api.getMyOrganization = async () => ({
            id: 'org-123',
            name: 'Acme Quotes',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('org-123');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Quotes');
    });

    it('getCredentialDetails uses the same organization id', async () => {
        const api = new Api({ api_key: 'k' });
        api.getMyOrganization = async () => ({
            id: 'org-xyz',
            name: 'Org',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('org-xyz');
    });

    it('throws when organization id is missing', async () => {
        const api = new Api({ api_key: 'k' });
        api.getMyOrganization = async () => ({ name: 'no-id' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/organization id/i);
    });

    it('testAuthRequest calls getMyOrganization', async () => {
        const api = new Api({ api_key: 'k' });
        let called = false;
        api.getMyOrganization = async () => {
            called = true;
            return { id: 'o1' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
