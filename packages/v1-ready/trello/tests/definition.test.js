const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Trello Definition', () => {
    it('is an api-key module named trello wired to the Api class', () => {
        expect(Definition.moduleName).toBe('trello');
        expect(Definition.getName()).toBe('trello');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Trello');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for api_key and token', () => {
        const api = new Api({});
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['api_key', 'token'])
        );
        expect(reqs.data.uiSchema.token['ui:widget']).toBe('password');
    });

    it('persists api_key and token credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_key', 'token'],
            entity: [],
        });
    });

    it('setAuthParams sets key and token from form params', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'form-key',
            token: 'form-token',
        });
        expect(api.api_key).toBe('form-key');
        expect(api.token).toBe('form-token');
    });

    it('setAuthParams also reads nested params.data', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            data: { api_key: 'nested-key', token: 'nested-token' },
        });
        expect(api.api_key).toBe('nested-key');
        expect(api.token).toBe('nested-token');
    });

    it('getEntityDetails derives externalId from /members/me id', async () => {
        const api = new Api({ api_key: 'k', token: 't' });
        api.getMember = async () => ({
            id: 'mem_abc',
            fullName: 'Ada Lovelace',
            username: 'ada',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('mem_abc');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Ada Lovelace');
        expect(details.details.username).toBe('ada');
    });

    it('getCredentialDetails uses the same member id', async () => {
        const api = new Api({ api_key: 'k', token: 't' });
        api.getMember = async () => ({
            id: 'mem_xyz',
            fullName: 'Grace',
            username: 'grace',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('mem_xyz');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('throws when /members/me has no id', async () => {
        const api = new Api({ api_key: 'k', token: 't' });
        api.getMember = async () => ({ fullName: 'Anon' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest calls getMember(me)', async () => {
        const api = new Api({ api_key: 'k', token: 't' });
        let calledWith;
        api.getMember = async (id) => {
            calledWith = id;
            return { id: 'm1' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(calledWith).toBe('me');
    });
});
