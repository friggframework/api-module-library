const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api, SANDBOX_BASE_URL } = require('../api');
const { extensions } = require('../index');

describe('DaySmart Vet Definition', () => {
    it('is an oauth2 client-credentials module named daysmartvet wired to Api', () => {
        expect(Definition.moduleName).toBe('daysmartvet');
        expect(Definition.getName()).toBe('daysmartvet');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('DaySmartVet');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes getAuthorizationRequirements for the credential form', () => {
        const api = new Api({});
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.data.jsonSchema.required).toContain('client_id');
        expect(reqs.data.jsonSchema.required).toContain('client_secret');
        expect(reqs.data.jsonSchema.required).toContain('api_key');
        expect(reqs.data.uiSchema.client_secret['ui:widget']).toBe('password');
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('persists tokens, client credentials, and clinic api_key', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'accessTokenExpire',
                'client_id',
                'client_secret',
                'api_key',
                'scope',
                'environment',
            ],
            entity: ['api_key', 'environment'],
        });
    });

    it('setAuthParams wires credentials and api_key onto the api', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            client_id: 'cid',
            client_secret: 'csec',
            api_key: 'clinic-abc',
            environment: 'sandbox',
        });
        expect(api.client_id).toBe('cid');
        expect(api.client_secret).toBe('csec');
        expect(api.api_key).toBe('clinic-abc');
        expect(api.environment).toBe('sandbox');
        expect(api.baseUrl).toBe(SANDBOX_BASE_URL);
        expect(api.tokenUri).toBe(`${SANDBOX_BASE_URL}/oauth/access_token`);
    });

    it('setAuthParams also accepts nested params.data and camelCase aliases', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            data: {
                clientId: 'x',
                clientSecret: 'y',
                apiKey: 'clinic-z',
            },
        });
        expect(api.client_id).toBe('x');
        expect(api.client_secret).toBe('y');
        expect(api.api_key).toBe('clinic-z');
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
            api_key: 'clinic-1',
        });
        expect(api.api_key).toBe('clinic-1');
        expect(called).toBe(true);
    });

    it('getEntityDetails prefers clinic.apiKey from getClinic', async () => {
        const api = new Api({ api_key: 'fallback-key' });
        api.getClinic = async () => ({
            response: {
                resource: {
                    apiKey: 'clinic-from-api',
                    name: 'Northside Animal Hospital',
                    email: 'front@example.com',
                },
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('clinic-from-api');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Northside Animal Hospital');
        expect(details.details.email).toBe('front@example.com');
    });

    it('getEntityDetails falls back to configured api_key when clinic lookup fails', async () => {
        const api = new Api({ api_key: 'configured-key' });
        api.getClinic = async () => {
            throw new Error('network');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('configured-key');
        expect(details.details.name).toBe('DaySmart Vet');
    });

    it('getEntityDetails throws when nothing can be derived', async () => {
        const api = new Api({});
        api.getClinic = async () => ({ response: { resource: {} } });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('getCredentialDetails uses the same clinic identity', async () => {
        const api = new Api({ api_key: 'cred-key' });
        api.getClinic = async () => ({
            response: { resource: { apiKey: 'cred-key', name: 'Clinic' } },
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('cred-key');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getClinic', async () => {
        const api = new Api({ api_key: 'k' });
        let called = false;
        api.getClinic = async () => {
            called = true;
            return { response: { resource: { apiKey: 'k' } } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env keys use the DAYSMARTVET_ prefix (no client-owned prefixes)', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).toMatch(/DAYSMARTVET_CLIENT_ID/);
        expect(src).toMatch(/DAYSMARTVET_CLIENT_SECRET/);
        expect(src).toMatch(/DAYSMARTVET_API_KEY/);
        expect(src).not.toMatch(/PAYJUNCTION/i);
        expect(src).not.toMatch(/lefthookhq/i);
    });

    it('exposes UNVALIDATED ADR-057 mappings for business and billing', () => {
        expect(extensions.mapping.schemas.business.validation).toBe(
            'UNVALIDATED'
        );
        expect(extensions.mapping.schemas.business.schema).toBe('business@1');
        expect(extensions.mapping.schemas.business.objects.clinic).toBeTruthy();
        expect(extensions.mapping.schemas.business.objects.client).toBeTruthy();
        expect(extensions.mapping.schemas.billing.validation).toBe(
            'UNVALIDATED'
        );
        expect(extensions.mapping.schemas.billing.schema).toBe('billing@1');
        expect(extensions.mapping.schemas.billing.objects.invoice).toBeTruthy();
        expect(extensions.mapping.schemas.billing.objects.payment).toBeTruthy();
    });
});
