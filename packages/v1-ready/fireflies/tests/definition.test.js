const { Definition } = require('../definition');

const { requiredAuthMethods } = Definition;

const validUser = {
    user_id: 'ff-user-9',
    name: 'Test User',
    email: 'test@example.com',
};

function makeStubApi(user, keyRef = {}) {
    return {
        api_key: keyRef.api_key,
        getUser: async () => user,
        setApiKey(k) {
            this.api_key = k;
            keyRef.api_key = k;
        },
    };
}

describe('Fireflies Definition', () => {
    it('is an api-key module named "fireflies"', () => {
        expect(Definition.moduleName).toBe('fireflies');
        expect(Definition.getName()).toBe('fireflies');
    });

    describe('getToken()', () => {
        it('stores the supplied api_key and returns it as the credential', async () => {
            const api = makeStubApi(validUser);
            const token = await requiredAuthMethods.getToken(api, {
                api_key: 'sk_from_form',
            });
            expect(api.api_key).toBe('sk_from_form');
            expect(token).toEqual({
                access_token: 'sk_from_form',
                api_key: 'sk_from_form',
            });
        });
    });

    describe('setAuthParams()', () => {
        it('exists (core calls it on the real non-oauth2 callback)', () => {
            expect(typeof requiredAuthMethods.setAuthParams).toBe('function');
        });

        it('sets the api key from api_key', async () => {
            const api = makeStubApi(validUser);
            await requiredAuthMethods.setAuthParams(api, {
                api_key: 'sk_from_callback',
            });
            expect(api.api_key).toBe('sk_from_callback');
        });

        it('falls back to access_token and to nested data', async () => {
            const a1 = makeStubApi(validUser);
            await requiredAuthMethods.setAuthParams(a1, {
                access_token: 'sk_access',
            });
            expect(a1.api_key).toBe('sk_access');

            const a2 = makeStubApi(validUser);
            await requiredAuthMethods.setAuthParams(a2, {
                data: { api_key: 'sk_nested' },
            });
            expect(a2.api_key).toBe('sk_nested');
        });
    });

    describe('testAuthRequest()', () => {
        it('resolves with the user payload for a valid key', async () => {
            const api = makeStubApi(validUser);
            await expect(
                requiredAuthMethods.testAuthRequest(api)
            ).resolves.toEqual(validUser);
        });

        it('rejects when the user query returns nothing', async () => {
            const api = makeStubApi(undefined);
            await expect(
                requiredAuthMethods.testAuthRequest(api)
            ).rejects.toThrow(/not valid/i);
        });
    });

    describe('getEntityDetails()', () => {
        it('returns identifiers keyed on the Fireflies user_id', async () => {
            const api = makeStubApi(validUser);
            const result = await requiredAuthMethods.getEntityDetails(
                api,
                null,
                null,
                'frigg-user-1'
            );
            expect(result.identifiers).toEqual({
                externalId: 'ff-user-9',
                userId: 'frigg-user-1',
            });
            expect(result.details.name).toBe('Test User');
        });

        it('rejects when the user payload lacks user_id', async () => {
            const api = makeStubApi({ email: 'x@y.com' });
            await expect(
                requiredAuthMethods.getEntityDetails(api, null, null, 'u')
            ).rejects.toThrow(/valid user info/i);
        });
    });

    describe('getCredentialDetails()', () => {
        it('returns identifiers with empty details', async () => {
            const api = makeStubApi(validUser);
            const result = await requiredAuthMethods.getCredentialDetails(
                api,
                'frigg-user-1'
            );
            expect(result.identifiers).toEqual({
                externalId: 'ff-user-9',
                userId: 'frigg-user-1',
            });
            expect(result.details).toEqual({});
        });
    });

    describe('apiPropertiesToPersist', () => {
        it('persists the credential key', () => {
            expect(
                requiredAuthMethods.apiPropertiesToPersist.credential
            ).toEqual(expect.arrayContaining(['api_key']));
        });
    });
});
