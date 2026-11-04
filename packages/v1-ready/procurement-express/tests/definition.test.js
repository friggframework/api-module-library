const { Definition } = require('../definition');
const { Api } = require('../api');

describe('ProcurementExpress Definition', () => {
    it('is a procurement-express module wired to the Api class', () => {
        expect(Definition.moduleName).toBe('procurement-express');
        expect(Definition.getName()).toBe('procurement-express');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('ProcurementExpress');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for authenticationToken', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toContain('authenticationToken');
        expect(reqs.data.jsonSchema.properties.authenticationToken.type).toBe(
            'string'
        );
        expect(reqs.data.uiSchema.authenticationToken['ui:widget']).toBe(
            'password'
        );
    });

    it('persists authenticationToken and companyId', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['authenticationToken', 'companyId'],
            entity: ['companyId'],
        });
    });

    it('setAuthParams sets token and company id from form params', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            authenticationToken: 'form-token',
            companyId: '55',
        });
        expect(api.authenticationToken).toBe('form-token');
        expect(api.companyId).toBe('55');
    });

    it('getEntityDetails prefers company-scoped externalId', async () => {
        const api = new Api({
            authenticationToken: 't',
            companyId: 10,
        });
        api.getCurrentUser = async () => ({
            id: 3,
            email: 'buyer@example.com',
            name: 'Buyer',
            employer_id: 10,
            companies: [{ id: 10, name: 'Example Co' }],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('company:10');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Example Co');
        expect(details.details.email).toBe('buyer@example.com');
    });

    it('getEntityDetails falls back to user id without a company', async () => {
        const api = new Api({ authenticationToken: 't' });
        api.getCurrentUser = async () => ({
            id: 99,
            email: 'solo@example.com',
            name: 'Solo',
            companies: [],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('user:99');
        expect(details.details.name).toBe('Solo');
    });

    it('getCredentialDetails matches entity externalId', async () => {
        const api = new Api({
            authenticationToken: 't',
            companyId: 10,
        });
        api.getCurrentUser = async () => ({
            id: 3,
            employer_id: 10,
            companies: [{ id: 10, name: 'Example Co' }],
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('company:10');
    });

    it('throws when currentuser has no id', async () => {
        const api = new Api({ authenticationToken: 't' });
        api.getCurrentUser = async () => ({ email: 'x@example.com' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable entity identifier/i);
    });

    it('testAuthRequest calls getCurrentUser', async () => {
        const api = new Api({ authenticationToken: 't' });
        let called = false;
        api.getCurrentUser = async () => {
            called = true;
            return { id: 1 };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env uses PROCUREMENT_EXPRESS_* variables', () => {
        expect(Definition.env).toHaveProperty('authenticationToken');
        expect(Definition.env).toHaveProperty('companyId');
        expect(Definition.env.base_url).toContain('procurementexpress.com');
    });
});
