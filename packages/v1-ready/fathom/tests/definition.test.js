const { Definition } = require('../definition');
const { Api } = require('../api');

// Offline: exercises the Definition auth methods with a fake api whose network
// calls are stubbed. No real HTTP.
describe('Fathom Definition', () => {
    it('is an api-key module named fathom wired to the Api class', () => {
        expect(Definition.moduleName).toBe('fathom');
        expect(Definition.getName()).toBe('fathom');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Fathom');
    });

    it('exposes an apiKey authorization form for the api_key field', () => {
        const reqs = Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toContain('api_key');
        expect(reqs.data.jsonSchema.properties.api_key.type).toBe('string');
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('persists only the api_key credential', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_key'],
            entity: [],
        });
    });

    it('setAuthParams sets the api key from form params', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'form-key',
        });
        expect(api.api_key).toBe('form-key');
    });

    it('getEntityDetails derives externalId from recorded_by email', async () => {
        const api = new Api({ api_key: 'k' });
        api.listMeetings = async () => ({
            items: [
                {
                    recording_id: 1,
                    recorded_by: {
                        name: 'Sean',
                        email: 'sean@lefthook.co',
                        team: 'Left Hook',
                    },
                },
            ],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('sean@lefthook.co');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Left Hook');
    });

    it('getEntityDetails falls back to a stable identity with no meetings', async () => {
        const api = new Api({ api_key: 'k' });
        api.listMeetings = async () => ({ items: [] });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('fathom-account');
    });

    it('getEntityDetails stays stable if the API throws', async () => {
        const api = new Api({ api_key: 'k' });
        api.listMeetings = async () => {
            throw new Error('boom');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-3'
        );
        expect(details.identifiers.externalId).toBe('fathom-account');
    });

    it('testAuthRequest performs an authenticated list call', async () => {
        const api = new Api({ api_key: 'k' });
        let called = false;
        api.listMeetings = async () => {
            called = true;
            return { items: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
