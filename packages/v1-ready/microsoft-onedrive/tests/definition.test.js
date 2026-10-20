const { Definition } = require('../definition');
const { Api } = require('../api');

describe('OneDrive Definition', () => {
    it('is an oauth2 module named microsoft-onedrive wired to the Api class', () => {
        expect(Definition.moduleName).toBe('microsoft-onedrive');
        expect(Definition.getName()).toBe('microsoft-onedrive');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('OneDrive');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists access_token and refresh_token credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: [],
        });
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code' },
        });
        expect(seen).toBe('auth-code');
    });

    it('getEntityDetails derives externalId from signed-in user id', async () => {
        const api = new Api({ access_token: 't' });
        api.getUser = async () => ({
            id: 'user-xyz',
            displayName: 'Ada',
            userPrincipalName: 'ada@contoso.com',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('user-xyz');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Ada (ada@contoso.com)');
    });

    it('getCredentialDetails uses the same user identity', async () => {
        const api = new Api({ access_token: 't' });
        api.getUser = async () => ({
            id: 'user-xyz',
            displayName: 'Ada',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('user-xyz');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('throws when GET /me yields no id', async () => {
        const api = new Api({ access_token: 't' });
        api.getUser = async () => ({ displayName: 'Anon' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest calls getMyDrive', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getMyDrive = async () => {
            called = true;
            return { id: 'drive-1' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env maps MICROSOFT_ONEDRIVE_* credentials', () => {
        expect(Object.keys(Definition.env)).toEqual(
            expect.arrayContaining([
                'client_id',
                'client_secret',
                'scope',
                'redirect_uri',
            ])
        );
    });
});
