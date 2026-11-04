const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Aspire Definition', () => {
    it('is a client-credentials module named aspire wired to the Api class', () => {
        expect(Definition.moduleName).toBe('aspire');
        expect(Definition.getName()).toBe('aspire');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Aspire');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for ClientId + Secret', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['clientId', 'secret'])
        );
        expect(reqs.data.uiSchema.secret['ui:widget']).toBe('password');
    });

    it('persists access/refresh tokens and client credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'client_id',
                'client_secret',
            ],
            entity: [],
        });
    });

    it('setAuthParams applies clientId/secret from form params', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            clientId: 'form-id',
            secret: 'form-secret',
        });
        expect(api.client_id).toBe('form-id');
        expect(api.client_secret).toBe('form-secret');
    });

    it('getToken authenticates and returns token fields', async () => {
        const api = new Api({});
        api.getTokenFromClientCredentials = async function () {
            this.client_id = 'c1';
            this.client_secret = 's1';
            return { Token: 'tok', RefreshToken: 'ref' };
        };
        const result = await Definition.requiredAuthMethods.getToken(api, {
            clientId: 'c1',
            secret: 's1',
        });
        expect(result).toEqual({
            access_token: 'tok',
            refresh_token: 'ref',
            client_id: 'c1',
            client_secret: 's1',
        });
    });

    it('getEntityDetails uses client_id as externalId', async () => {
        const api = new Api({ client_id: 'ext-123' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('ext-123');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Aspire API');
    });

    it('getCredentialDetails uses client_id as externalId', async () => {
        const api = new Api({ client_id: 'cred-9' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('cred-9');
    });

    it('throws when client_id is missing for identity', async () => {
        const api = new Api({});
        api.client_id = '';
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/client_id is required/);
    });

    it('testAuthRequest lists companies with top=1', async () => {
        const api = new Api({ client_id: 'c', client_secret: 's' });
        let calledWith;
        api.getCompanies = async (params) => {
            calledWith = params;
            return [];
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(calledWith).toEqual({ top: 1 });
    });

    it('declares ADR-057 mapping hooks for business and billing', () => {
        expect(Definition.mappings).toEqual({
            business: 'extensions.mapping',
            billing: 'extensions.mapping',
        });
    });

    it('env reads ASPIRE_* variables', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('base_url');
    });
});
