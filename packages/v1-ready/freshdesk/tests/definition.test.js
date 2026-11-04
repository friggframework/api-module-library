const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Freshdesk Definition', () => {
    it('is a basic-auth module named freshdesk wired to the Api class', () => {
        expect(Definition.moduleName).toBe('freshdesk');
        expect(Definition.getName()).toBe('freshdesk');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Freshdesk');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes a basic authorization form for domain + api_key', async () => {
        const api = new Api({});
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('basic');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['domain', 'api_key'])
        );
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('persists api_key and domain credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_key', 'domain'],
            entity: [],
        });
    });

    it('setAuthParams wires domain + api_key onto the Api', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            domain: 'acme',
            api_key: 'form-key',
        });
        expect(api.domain).toBe('acme');
        expect(api.baseUrl).toBe('https://acme.freshdesk.com/api/v2');
        expect(api.api_key).toBe('form-key');
        expect(api.username).toBe('form-key');
        expect(api.password).toBe('X');
    });

    it('setAuthParams accepts nested params.data', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            data: { domain: 'nested', api_key: 'nested-key' },
        });
        expect(api.domain).toBe('nested');
        expect(api.api_key).toBe('nested-key');
    });

    it('getEntityDetails derives externalId from account_id', async () => {
        const api = new Api({ domain: 'acme', api_key: 'k' });
        api.getAccount = async () => ({
            account_id: 1840509,
            account_name: 'Daily Planet',
            account_domain: 'dailyplanet.freshdesk.com',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('1840509');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Daily Planet');
        expect(details.details.domain).toBe('dailyplanet.freshdesk.com');
    });

    it('getCredentialDetails uses the same account_id', async () => {
        const api = new Api({ domain: 'acme', api_key: 'k' });
        api.getAccount = async () => ({
            account_id: 99,
            account_name: 'Acme',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('99');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('throws when /account has no account_id', async () => {
        const api = new Api({ domain: 'acme', api_key: 'k' });
        api.getAccount = async () => ({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/account_id/i);
    });

    it('testAuthRequest performs getAccount / testAuth', async () => {
        const api = new Api({ domain: 'acme', api_key: 'k' });
        let called = false;
        api.testAuth = async () => {
            called = true;
            return { account_id: 1 };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
