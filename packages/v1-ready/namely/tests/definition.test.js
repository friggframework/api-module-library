const { Definition } = require('../definition');
const { Api } = require('../api');

// Offline: exercises the Definition auth methods with a fake api whose network
// calls are stubbed. No real HTTP.
describe('Namely Definition', () => {
    it('is an api-key module named namely wired to the Api class', () => {
        expect(Definition.moduleName).toBe('namely');
        expect(Definition.getName()).toBe('namely');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Namely');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for company + access_token', async () => {
        const api = new Api({});
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['company', 'access_token'])
        );
        expect(reqs.data.uiSchema.access_token['ui:widget']).toBe('password');
    });

    it('persists access_token + company on the credential and company on the entity', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'company'],
            entity: ['company'],
        });
    });

    it('setAuthParams sets company and access token from form params', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            company: 'acme',
            access_token: 'form-token',
        });
        expect(api.company).toBe('acme');
        expect(api.access_token).toBe('form-token');
        expect(api.baseUrl).toBe('https://acme.namely.com/api/v1');
        expect(api.api_key).toBe('Bearer form-token');
    });

    it('setAuthParams accepts nested data and alias field names', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            data: {
                company_subdomain: 'reed-sandbox',
                api_token: 'nested-token',
            },
        });
        expect(api.company).toBe('reed-sandbox');
        expect(api.access_token).toBe('nested-token');
    });

    it('getEntityDetails uses the company subdomain as externalId', async () => {
        const api = new Api({ company: 'acme', access_token: 't' });
        api.getCurrentProfile = async () => ({
            profiles: [
                {
                    id: 'p1',
                    full_name: 'Ada Lovelace',
                    email: 'ada@acme.com',
                },
            ],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('acme');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Ada Lovelace');
        expect(details.details.company).toBe('acme');
    });

    it('getEntityDetails falls back to a company label when /profiles/me fails', async () => {
        const api = new Api({ company: 'acme', access_token: 't' });
        api.getCurrentProfile = async () => {
            throw new Error('boom');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('acme');
        expect(details.details.name).toBe('Namely acme');
    });

    it('getEntityDetails throws when company is missing', async () => {
        const api = new Api({ access_token: 't' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/company subdomain/i);
    });

    it('getCredentialDetails uses the company subdomain', async () => {
        const api = new Api({ company: 'acme', access_token: 't' });
        api.getCurrentProfile = async () => ({ profiles: [] });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('acme');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getCurrentProfile via testAuth', async () => {
        const api = new Api({ company: 'acme', access_token: 't' });
        let called = false;
        api.testAuth = async () => {
            called = true;
            return { profiles: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
