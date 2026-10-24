const { Definition } = require('../definition');
const { Api } = require('../api');

describe('SharePoint Definition', () => {
    it('is an oauth2 module named microsoft-sharepoint wired to the Api class', () => {
        expect(Definition.moduleName).toBe('microsoft-sharepoint');
        expect(Definition.getName()).toBe('microsoft-sharepoint');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('SharePoint');
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

    it('getEntityDetails prefers organization id when available', async () => {
        const api = new Api({ access_token: 't' });
        api.getOrganization = async () => ({
            id: 'tenant-abc',
            displayName: 'Contoso',
        });
        api.getUser = async () => {
            throw new Error('should not be called');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('tenant-abc');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Contoso');
    });

    it('getEntityDetails falls back to user id when organization fails', async () => {
        const api = new Api({ access_token: 't' });
        api.getOrganization = async () => {
            throw new Error('no org');
        };
        api.getUser = async () => ({
            id: 'user-xyz',
            displayName: 'Ada',
            userPrincipalName: 'ada@contoso.com',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('user-xyz');
        expect(details.details.name).toBe('Ada (ada@contoso.com)');
    });

    it('getCredentialDetails uses the same identity', async () => {
        const api = new Api({ access_token: 't' });
        api.getOrganization = async () => ({
            id: 'tenant-1',
            displayName: 'Org',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('tenant-1');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest lists sites', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.listSites = async (params) => {
            called = true;
            expect(params.search).toBe('*');
            return { value: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env maps SHAREPOINT_* credentials', () => {
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
