const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Klaviyo Definition', () => {
    it('is an api-key module named klaviyo wired to the Api class', () => {
        expect(Definition.moduleName).toBe('klaviyo');
        expect(Definition.getName()).toBe('klaviyo');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Klaviyo');
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
            api_key: 'pk_form',
        });
        expect(api.api_key).toBe('pk_form');
    });

    it('getEntityDetails derives externalId from account id', async () => {
        const api = new Api({ api_key: 'pk_k' });
        api.listAccounts = async () => ({
            data: [
                {
                    type: 'account',
                    id: 'AbC123',
                    attributes: {
                        contact_information: {
                            organization_name: 'Acme Co',
                        },
                    },
                },
            ],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('AbC123');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Co');
    });

    it('getCredentialDetails uses the same account id', async () => {
        const api = new Api({ api_key: 'pk_k' });
        api.listAccounts = async () => ({
            data: [{ type: 'account', id: 'Acct9' }],
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('Acct9');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('throws when accounts returns no id', async () => {
        const api = new Api({ api_key: 'pk_k' });
        api.listAccounts = async () => ({ data: [] });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/no account id/i);
    });

    it('testAuthRequest performs listAccounts', async () => {
        const api = new Api({ api_key: 'pk_k' });
        let called = false;
        api.listAccounts = async () => {
            called = true;
            return { data: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
