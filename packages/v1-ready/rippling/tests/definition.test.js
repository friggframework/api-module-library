const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Rippling Definition', () => {
    it('is an oauth2 module named rippling wired to the Api class', () => {
        expect(Definition.moduleName).toBe('rippling');
        expect(Definition.getName()).toBe('rippling');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Rippling');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements via the Api', () => {
        const api = new Api({ app_name: 'Demo' });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.data.jsonSchema.required).toContain('client_id');
    });

    it('persists OAuth credential fields and app_name on the entity', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'client_id',
                'client_secret',
            ],
            entity: ['app_name'],
        });
    });

    it('setAuthParams wires client credentials and app name', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            client_id: 'cid',
            client_secret: 'csec',
            app_name: 'MyApp',
        });
        expect(api.client_id).toBe('cid');
        expect(api.client_secret).toBe('csec');
        expect(api.app_name).toBe('MyApp');
        expect(api.authorizationUri).toContain('/PLATFORM/MyApp/authorize');
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex/r',
        });
        api.getTokenFromCode = jest.fn().mockResolvedValue({
            access_token: 'a',
            refresh_token: 'r',
        });
        await Definition.requiredAuthMethods.getToken(api, {
            code: 'the-code',
        });
        expect(api.getTokenFromCode).toHaveBeenCalledWith('the-code');
    });

    it('getToken rejects when code is missing', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getToken(api, {})
        ).rejects.toThrow(/authorization code/i);
    });

    it('getEntityDetails uses company id from listCompanies', async () => {
        const api = new Api({ access_token: 't' });
        api.listCompanies = async () => ({
            results: [
                {
                    id: '595f75ffd2a5f80ae22ce88e',
                    name: "Bob's Bakery",
                },
            ],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe(
            '595f75ffd2a5f80ae22ce88e'
        );
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe("Bob's Bakery");
    });

    it('getEntityDetails accepts a bare company object response shape', async () => {
        const api = new Api({ access_token: 't' });
        api.listCompanies = async () => ({
            id: 'company-bare',
            name: 'Bare Co',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'u'
        );
        expect(details.identifiers.externalId).toBe('company-bare');
    });

    it('getEntityDetails throws when no company id is available', async () => {
        const api = new Api({ access_token: 't' });
        api.listCompanies = async () => ({ results: [] });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/company id/i);
    });

    it('getCredentialDetails matches entity externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.listCompanies = async () => ({
            results: [{ id: 'co-1', name: 'Co' }],
        });
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

    it('testAuthRequest lists companies', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.listCompanies = async () => {
            called = true;
            return { results: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env wires RIPPLING_* variables and redirect suffix', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('app_name');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env.redirect_uri).toMatch(/\/rippling$/);
    });
});
