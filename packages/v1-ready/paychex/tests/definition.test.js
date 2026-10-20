const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Paychex Definition', () => {
    it('is an oauth2 module named paychex wired to the Api class', () => {
        expect(Definition.moduleName).toBe('paychex');
        expect(Definition.getName()).toBe('paychex');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Paychex');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists client credentials, access token, and company_id', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'accessTokenExpire',
                'client_id',
                'client_secret',
            ],
            entity: ['company_id'],
        });
    });

    it('exposes OAuth env keys (snake_case)', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('base_url');
    });

    it('getToken mints a token via getTokenFromClientCredentials', async () => {
        const api = new Api({});
        let called = false;
        api.getTokenFromClientCredentials = async () => {
            called = true;
            return { access_token: 'a', expires_in: 600 };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { client_id: 'cid', client_secret: 'csec' },
        });
        expect(called).toBe(true);
        expect(api.client_id).toBe('cid');
        expect(api.client_secret).toBe('csec');
    });

    it('setAuthParams wires company_id when provided', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            client_id: 'cid',
            client_secret: 'sec',
            company_id: 'co-42',
        });
        expect(api.company_id).toBe('co-42');
    });

    it('getEntityDetails uses a single discovered company', async () => {
        const api = new Api({ client_id: 'cid', access_token: 't' });
        api.listCompanies = async () => ({
            content: [
                {
                    companyId: 'co-uuid-99',
                    legalName: 'Monsters, Inc',
                    displayId: '09620579',
                },
            ],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('co-uuid-99');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Monsters, Inc');
        expect(api.company_id).toBe('co-uuid-99');
    });

    it('getEntityDetails falls back to client_id for multi-company apps', async () => {
        const api = new Api({ client_id: 'app-key', access_token: 't' });
        api.listCompanies = async () => ({
            content: [
                { companyId: 'a', legalName: 'A' },
                { companyId: 'b', legalName: 'B' },
            ],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('app-key');
        expect(details.details.name).toContain('2 companies');
    });

    it('getCredentialDetails keys off resolved identity', async () => {
        const api = new Api({
            client_id: 'cid',
            company_id: 'co-3',
            access_token: 't',
        });
        api.getCompany = async () => ({
            content: [{ companyId: 'co-3', legalName: 'Acme' }],
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-3'
            );
        expect(details.identifiers.externalId).toBe('co-3');
        expect(details.identifiers.userId).toBe('user-3');
    });

    it('testAuthRequest calls listCompanies', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.listCompanies = async () => {
            called = true;
            return { content: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('matches the required shape from the api-module-definition schema', () => {
        expect(typeof Definition.getName).toBe('function');
        expect(typeof Definition.moduleName).toBe('string');
        expect(Definition.requiredAuthMethods).toEqual(
            expect.objectContaining({
                getToken: expect.any(Function),
                getEntityDetails: expect.any(Function),
                getCredentialDetails: expect.any(Function),
                testAuthRequest: expect.any(Function),
                apiPropertiesToPersist: expect.objectContaining({
                    credential: expect.any(Array),
                    entity: expect.any(Array),
                }),
            })
        );
        expect(
            Definition.requiredAuthMethods.getAuthorizationRequirements ||
                Definition.requiredAuthMethods.setAuthParams
        ).toBeTruthy();
    });
});
