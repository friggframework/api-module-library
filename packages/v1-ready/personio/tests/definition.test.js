const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Personio Definition', () => {
    it('is an oauth client-credentials module named personio wired to the Api class', () => {
        expect(Definition.moduleName).toBe('personio');
        expect(Definition.getName()).toBe('personio');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Personio');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey-style authorization form for client credentials', async () => {
        const api = new Api({});
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining([
                'client_id',
                'client_secret',
                'company_id',
            ])
        );
        expect(reqs.data.uiSchema.client_secret['ui:widget']).toBe('password');
    });

    it('persists credential secrets, token, and company_id', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'client_id',
                'client_secret',
                'access_token',
                'accessTokenExpire',
                'company_id',
                'scope',
            ],
            entity: ['company_id'],
        });
    });

    it('setAuthParams wires client credentials and company_id', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            client_id: 'cid',
            client_secret: 'csec',
            company_id: '27277',
            scope: 'personio:persons:read',
        });
        expect(api.client_id).toBe('cid');
        expect(api.client_secret).toBe('csec');
        expect(api.company_id).toBe('27277');
        expect(api.scope).toBe('personio:persons:read');
    });

    it('setAuthParams reads nested params.data', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            data: {
                clientId: 'nested-id',
                clientSecret: 'nested-sec',
                companyId: '99',
            },
        });
        expect(api.client_id).toBe('nested-id');
        expect(api.client_secret).toBe('nested-sec');
        expect(api.company_id).toBe('99');
    });

    it('getEntityDetails uses company_id as externalId', async () => {
        const api = new Api({ company_id: '27277' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('27277');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toContain('27277');
    });

    it('getCredentialDetails uses company_id as externalId', async () => {
        const api = new Api({ company_id: '27277' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('27277');
    });

    it('throws when company_id is missing for identity', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/company_id/i);
    });

    it('testAuthRequest performs an authenticated list call', async () => {
        const api = new Api({
            client_id: 'a',
            client_secret: 'b',
            access_token: 't',
        });
        api.accessTokenExpire = new Date(Date.now() + 60 * 60 * 1000);
        let called = false;
        api.listPersons = async () => {
            called = true;
            return { _data: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('getToken applies credentials and mints a client-credentials token', async () => {
        const api = new Api({});
        const tokenResponse = { access_token: 'tok', expires_in: 86400 };
        api.getTokenFromClientCredentials = jest.fn(async () => tokenResponse);
        const result = await Definition.requiredAuthMethods.getToken(api, {
            data: { client_id: 'cid', client_secret: 'csec', company_id: '27277' },
        });
        expect(api.client_id).toBe('cid');
        expect(api.client_secret).toBe('csec');
        expect(api.company_id).toBe('27277');
        expect(api.getTokenFromClientCredentials).toHaveBeenCalledTimes(1);
        expect(result).toBe(tokenResponse);
    });
});
