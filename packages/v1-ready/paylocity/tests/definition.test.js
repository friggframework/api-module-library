const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api, WEBLINK_SCOPE } = require('../api');

describe('Paylocity Definition', () => {
    it('is an oauth2 client-credentials module named paylocity wired to Api', () => {
        expect(Definition.moduleName).toBe('paylocity');
        expect(Definition.getName()).toBe('paylocity');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Paylocity');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes getAuthorizationRequirements for the credential form', () => {
        const api = new Api({});
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.data.jsonSchema.required).toContain('client_id');
        expect(reqs.data.jsonSchema.required).toContain('client_secret');
        expect(reqs.data.jsonSchema.required).toContain('company_id');
        expect(reqs.data.uiSchema.client_secret['ui:widget']).toBe('password');
    });

    it('persists tokens, client credentials, and company_id', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'accessTokenExpire',
                'client_id',
                'client_secret',
                'company_id',
                'scope',
                'environment',
            ],
            entity: ['company_id', 'environment'],
        });
    });

    it('setAuthParams wires credentials and company_id onto the api', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            client_id: 'cid',
            client_secret: 'csec',
            company_id: 'A12345',
            environment: 'sandbox',
        });
        expect(api.client_id).toBe('cid');
        expect(api.client_secret).toBe('csec');
        expect(api.company_id).toBe('A12345');
        expect(api.environment).toBe('sandbox');
        expect(api.baseUrl).toBe('https://dc1demogw.paylocity.com/api/v2');
        expect(api.tokenUri).toBe(
            'https://dc1demogw.paylocity.com/IdentityServer/connect/token'
        );
    });

    it('setAuthParams also accepts nested params.data and camelCase aliases', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            data: {
                clientId: 'x',
                clientSecret: 'y',
                companyId: 'B99',
            },
        });
        expect(api.client_id).toBe('x');
        expect(api.client_secret).toBe('y');
        expect(api.company_id).toBe('B99');
    });

    it('getToken calls getTokenFromClientCredentials after setAuthParams', async () => {
        const api = new Api({});
        let called = false;
        api.getTokenFromClientCredentials = async () => {
            called = true;
            return { access_token: 't', expires_in: 3600, token_type: 'Bearer' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            client_id: 'cid',
            client_secret: 'csec',
            company_id: 'A12345',
        });
        expect(api.company_id).toBe('A12345');
        expect(called).toBe(true);
    });

    it('getEntityDetails uses company_id as externalId', async () => {
        const api = new Api({ company_id: 'A12345' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('A12345');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Paylocity A12345');
        expect(details.details.company_id).toBe('A12345');
    });

    it('getEntityDetails throws when company_id is missing', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/company_id/i);
    });

    it('getCredentialDetails uses company_id as externalId', async () => {
        const api = new Api({ company_id: 'C777' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('C777');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls listEmployees', async () => {
        const api = new Api({ company_id: 'A12345' });
        let called = false;
        api.listEmployees = async () => {
            called = true;
            return [];
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('defaults scope to WebLinkAPI on new Api instances', () => {
        const api = new Api({});
        expect(api.scope).toBe(WEBLINK_SCOPE);
    });

    it('retains no Mongoose manager/credential/entity imports', () => {
        const defSrc = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(defSrc).not.toMatch(/mongoose/i);
        expect(defSrc).not.toMatch(/require\(['"]\.\/manager/);
        expect(defSrc).not.toMatch(/models\/credential/);
        expect(defSrc).not.toMatch(/models\/entity/);
    });
});
