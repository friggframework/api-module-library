const { Definition } = require('../definition');
const { Api } = require('../api');

describe('ADP Definition', () => {
    it('is an oauth/client-credentials module named adp wired to the Api class', () => {
        expect(Definition.moduleName).toBe('adp');
        expect(Definition.getName()).toBe('adp');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Adp');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey-style authorization form for client credentials + cert', async () => {
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
                'ssl_cert',
                'ssl_key',
            ])
        );
    });

    it('persists credential fields including TLS material', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'client_id',
                'client_secret',
                'access_token',
                'accessTokenExpire',
                'ssl_cert',
                'ssl_key',
                'ssl_passphrase',
            ],
            entity: [],
        });
    });

    it('setAuthParams applies form params and configures the TLS agent', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            client_id: 'form-id',
            client_secret: 'form-secret',
            ssl_cert: 'CERT',
            ssl_key: 'KEY',
        });
        expect(api.client_id).toBe('form-id');
        expect(api.client_secret).toBe('form-secret');
        expect(api.ssl_cert).toBe('CERT');
        expect(api.ssl_key).toBe('KEY');
        expect(api.agent).toBeTruthy();
    });

    it('setAuthParams reads nested params.data', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            data: {
                client_id: 'nested-id',
                client_secret: 'nested-secret',
                ssl_cert: 'C',
                ssl_key: 'K',
            },
        });
        expect(api.client_id).toBe('nested-id');
    });

    it('getEntityDetails uses client_id as externalId', async () => {
        const api = new Api({ client_id: 'connector-123' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('connector-123');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('ADP connector-123');
    });

    it('getCredentialDetails uses client_id as externalId', async () => {
        const api = new Api({ client_id: 'connector-xyz' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('connector-xyz');
    });

    it('throws when client_id is missing for identity', async () => {
        const api = new Api({});
        api.client_id = null;
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/client_id/i);
    });

    it('testAuthRequest performs an authenticated meta call', async () => {
        const api = new Api({
            client_id: 'a',
            client_secret: 'b',
            access_token: 't',
        });
        api.accessTokenExpire = new Date(Date.now() + 60_000);
        let called = false;
        api.getWorkersMeta = async () => {
            called = true;
            return {};
        };
        api.testAuth = async () => api.getWorkersMeta();
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
