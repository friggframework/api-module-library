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

    it('getEntityDetails uses the first phone number only for the display name, not identity', async () => {
        const api = new Api({ api_key: 'k' });
        jest.spyOn(api, 'listPhoneNumbers').mockResolvedValue({
            data: [{ id: 'PN123', name: 'Sales Line', number: '+15555550100' }],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        // Identity is a sha256 fingerprint of the key — NOT the phone-number id.
        expect(details.identifiers.externalId).not.toBe('PN123');
        expect(details.identifiers.externalId).toMatch(/^[a-f0-9]{64}$/);
        expect(details.identifiers.user).toBe('user-1');
        expect(details.details.name).toBe('Sales Line');
    });

    describe('externalId identity (key fingerprint)', () => {
        const { requiredAuthMethods } = Definition;

        const entityIdFor = async (key) => {
            const api = new Api({ api_key: key });
            // A phone-number listing must not influence identity.
            jest.spyOn(api, 'listPhoneNumbers').mockResolvedValue({
                data: [{ id: `PN-${Math.random()}` }],
            });
            const d = await requiredAuthMethods.getEntityDetails(api, {}, {}, 'u');
            return d.identifiers.externalId;
        };

        it('is a stable sha256 hex derived from the key, never a constant', async () => {
            const first = await entityIdFor('op_key_alpha');
            const second = await entityIdFor('op_key_alpha');
            expect(first).toMatch(/^[a-f0-9]{64}$/);
            // Stable: same key → same id, regardless of phone-number churn.
            expect(first).toBe(second);
            // Never the removed shared constant.
            expect(first).not.toBe('quo-workspace');
            // Never the raw key.
            expect(first).not.toBe('op_key_alpha');
        });

        it('is unique per key (different keys → different ids)', async () => {
            const a = await entityIdFor('op_key_alpha');
            const b = await entityIdFor('op_key_beta');
            expect(a).not.toBe(b);
        });

        it('getEntityDetails and getCredentialDetails agree for the same key', async () => {
            const api = new Api({ api_key: 'op_key_shared' });
            jest.spyOn(api, 'listPhoneNumbers').mockResolvedValue({ data: [] });
            const entity = await requiredAuthMethods.getEntityDetails(api, {}, {}, 'u');
            const credential = await requiredAuthMethods.getCredentialDetails(api, 'u');
            expect(entity.identifiers.externalId).toBe(
                credential.identifiers.externalId
            );
        });

        it('throws rather than emitting a shared constant when no key is present', async () => {
            const api = new Api({});
            await expect(
                requiredAuthMethods.getCredentialDetails(api, 'u')
            ).rejects.toThrow();
        });
    });
});
