const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Airwallex Definition', () => {
    it('is an api-key module named airwallex wired to the Api class', () => {
        expect(Definition.moduleName).toBe('airwallex');
        expect(Definition.getName()).toBe('airwallex');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Airwallex');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for client_id and api_key', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['client_id', 'api_key'])
        );
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('persists api key credentials and minted bearer token fields', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'api_key',
                'client_id',
                'access_token',
                'expires_at',
                'login_as',
                'base_url',
            ],
            entity: [],
        });
    });

    it('setAuthParams sets credentials and calls login', async () => {
        const api = new Api({});
        let loggedIn = false;
        api.login = async () => {
            loggedIn = true;
            api.access_token = 'tok_from_login';
            return { token: 'tok_from_login' };
        };
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'k',
            client_id: 'c',
            base_url: 'https://api.sandbox.airwallex.com',
        });
        expect(api.api_key).toBe('k');
        expect(api.client_id).toBe('c');
        expect(api.baseUrl).toBe('https://api.sandbox.airwallex.com');
        expect(loggedIn).toBe(true);
    });

    it('getEntityDetails uses account id as externalId', async () => {
        const api = new Api({ api_key: 'k', client_id: 'c' });
        api.getAccount = async () => ({
            id: 'acct_123',
            nickname: 'Left Hook Treasury',
            status: 'ACTIVE',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('acct_123');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Left Hook Treasury');
    });

    it('getCredentialDetails uses account id', async () => {
        const api = new Api({ api_key: 'k', client_id: 'c' });
        api.getAccount = async () => ({ id: 'acct_9' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('acct_9');
    });

    it('testAuthRequest calls getAccount', async () => {
        const api = new Api({ api_key: 'k', client_id: 'c' });
        let called = false;
        api.getAccount = async () => {
            called = true;
            return { id: 'acct' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
