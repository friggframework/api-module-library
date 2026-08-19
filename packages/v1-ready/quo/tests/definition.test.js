const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Quo Definition (offline)', () => {
    it('is an API-key module named "quo"', () => {
        expect(Definition.moduleName).toBe('quo');
        expect(Definition.getName()).toBe('quo');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Quo');
    });

    it('exposes an apiKey authorization form requiring api_key (masked)', () => {
        const reqs = Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toContain('api_key');
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('setAuthParams sets the key on the api instance', async () => {
        const api = new Api({});
        expect(api.isAuthenticated()).toBe(false);
        await Definition.requiredAuthMethods.setAuthParams(api, { api_key: 'k1' });
        expect(api.api_key).toBe('k1');
        expect(api.isAuthenticated()).toBe(true);
    });

    it('persists the key as access_token for rehydration', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist.credential)
            .toEqual(expect.arrayContaining(['access_token']));
    });

    it('testAuthRequest calls an authenticated endpoint', async () => {
        const api = new Api({ api_key: 'k' });
        const spy = jest.spyOn(api, 'listPhoneNumbers').mockResolvedValue({ data: [] });
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(spy).toHaveBeenCalled();
    });

    it('getEntityDetails derives identifiers from the first phone number', async () => {
        const api = new Api({ api_key: 'k' });
        jest.spyOn(api, 'listPhoneNumbers').mockResolvedValue({
            data: [{ id: 'PN123', name: 'Sales Line', number: '+15555550100' }],
        });
        const details = await api.constructor === Api // noop guard
            ? await Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'user-1')
            : null;
        expect(details.identifiers.externalId).toBe('PN123');
        expect(details.identifiers.user).toBe('user-1');
        expect(details.details.name).toBe('Sales Line');
    });
});
