const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Microsoft Outlook Definition', () => {
    it('is an oauth2 module named microsoft-outlook wired to the Api class', () => {
        expect(Definition.moduleName).toBe('microsoft-outlook');
        expect(Definition.getName()).toBe('microsoft-outlook');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('MicrosoftOutlook');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements via the Api', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example/redirect/microsoft-outlook',
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
            data: { code: 'auth-code', tenant: 'tid-1' },
        });
        expect(api.tenant_id).toBe('tid-1');
        expect(api.getTokenFromCode).toHaveBeenCalledWith('auth-code');
    });

    it('getToken without params uses client credentials', async () => {
        const api = new Api({});
        api.getTokenFromClientCredentials = jest
            .fn()
            .mockResolvedValue({ access_token: 'app' });
        await Definition.requiredAuthMethods.getToken(api);
        expect(api.getTokenFromClientCredentials).toHaveBeenCalled();
    });

    it('getEntityDetails derives externalId from /me', async () => {
        const api = new Api({ access_token: 't', tenant_id: 'common' });
        api.getMe = async () => ({
            id: 'user-1',
            displayName: 'Ada Lovelace',
            userPrincipalName: 'ada@contoso.com',
            mail: 'ada@contoso.com',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-frigg'
        );
        expect(details.identifiers.externalId).toBe('user-1');
        expect(details.identifiers.userId).toBe('user-frigg');
        expect(details.details.name).toBe('Ada Lovelace');
        expect(details.details.mail).toBe('ada@contoso.com');
    });

    it('getEntityDetails falls back to organization when /me fails', async () => {
        const api = new Api({ access_token: 't', tenant_id: 'common' });
        api.getMe = async () => {
            throw new Error('no me');
        };
        api.getOrganization = async () => ({
            id: 'org-9',
            displayName: 'Contoso',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'u'
        );
        expect(details.identifiers.externalId).toBe('org-9');
        expect(details.details.name).toBe('Contoso');
        expect(api.tenant_id).toBe('org-9');
    });

    it('getCredentialDetails uses the same identity', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({ id: 'user-2', displayName: 'Bob' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'u2'
            );
        expect(details.identifiers.externalId).toBe('user-2');
        expect(details.identifiers.userId).toBe('u2');
    });

    it('throws when neither /me nor organization can identify the account', async () => {
        const api = new Api({});
        api.getMe = async () => ({});
        api.getOrganization = async () => ({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest calls getMe', async () => {
        const api = new Api({});
        let called = false;
        api.getMe = async () => {
            called = true;
            return { id: 'x' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env wires OUTLOOK_* client credentials and redirect path', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env.redirect_uri).toMatch(
            /^https?:\/\/.+\/microsoft-outlook$/
        );
    });
});
