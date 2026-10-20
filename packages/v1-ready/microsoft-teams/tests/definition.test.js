const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Microsoft Teams Definition', () => {
    it('is an oauth2 module named microsoft-teams wired to the Api class', () => {
        expect(Definition.moduleName).toBe('microsoft-teams');
        expect(Definition.getName()).toBe('microsoft-teams');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('MicrosoftTeams');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements via the Api', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example/redirect/microsoft-teams',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('login.microsoftonline.com');
    });

    it('persists tokens and tenant_id', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'tenant_id',
            ],
            entity: ['tenant_id'],
        });
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({});
        api.getTokenFromCode = jest
            .fn()
            .mockResolvedValue({ access_token: 'a' });
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code', tenant: 'tenant-guid' },
        });
        expect(api.tenant_id).toBe('tenant-guid');
        expect(api.getTokenFromCode).toHaveBeenCalledWith('auth-code');
    });

    it('getToken without params uses client credentials', async () => {
        const api = new Api({});
        api.getTokenFromClientCredentials = jest
            .fn()
            .mockResolvedValue({ access_token: 'a' });
        await Definition.requiredAuthMethods.getToken(api);
        expect(api.getTokenFromClientCredentials).toHaveBeenCalled();
    });

    it('getEntityDetails uses organization id when available', async () => {
        const api = new Api({ access_token: 't' });
        api.getOrganization = async () => ({
            id: 'org-1',
            displayName: 'Contoso',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('org-1');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Contoso');
        expect(details.details.tenant_id).toBe('org-1');
    });

    it('getEntityDetails falls back to /me when organization fails', async () => {
        const api = new Api({ access_token: 't', tenant_id: 'common' });
        api.getOrganization = async () => {
            throw new Error('forbidden');
        };
        api.getMe = async () => ({
            id: 'user-guid',
            displayName: 'Ada Lovelace',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('user-guid');
        expect(details.details.name).toBe('Ada Lovelace');
    });

    it('getCredentialDetails returns the same externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.getOrganization = async () => ({
            id: 'org-9',
            displayName: 'Fabrikam',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('org-9');
    });

    it('testAuthRequest calls getMe', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getMe = async () => {
            called = true;
            return { id: 'u' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env uses TEAMS_* variables and redirect suffix', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env.redirect_uri).toMatch(/\/microsoft-teams$/);
    });
});
