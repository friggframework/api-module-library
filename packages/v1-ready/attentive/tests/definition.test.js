const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Attentive Definition', () => {
    it('is an oauth2 module named attentive wired to the Api class', () => {
        expect(Definition.moduleName).toBe('attentive');
        expect(Definition.getName()).toBe('attentive');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Attentive');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements with apiKey alternate', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example/redirect/attentive',
            scope: 'subscriptions:write',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain(
            'ui.attentivemobile.com/integrations/oauth-install'
        );
        expect(reqs.url).toContain('client_id=cid');
        expect(reqs.data.alternate.type).toBe('apiKey');
        expect(reqs.data.alternate.jsonSchema.required).toContain('api_key');
    });

    it('persists access_token and id_token credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'id_token'],
            entity: [],
        });
    });

    it('setAuthParams sets the Bearer token from api_key', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'private-key',
        });
        expect(api.access_token).toBe('private-key');
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'tok' };
        };
        const result = await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code' },
        });
        expect(seen).toBe('auth-code');
        expect(result.access_token).toBe('tok');
    });

    it('getToken throws when code is missing', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getToken(api, { data: {} })
        ).rejects.toThrow(/authorization code/i);
    });

    it('getEntityDetails uses companyId from /me', async () => {
        const api = new Api({ access_token: 'k' });
        api.getMe = async () => ({
            companyId: 'MDc6Q29tcGFueTI',
            companyName: 'Hudson & Ivy',
            attentiveDomainName: 'hudsonivy.attn.tv',
            applicationName: 'Pillow Api',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('MDc6Q29tcGFueTI');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Hudson & Ivy');
        expect(details.details.attentiveDomainName).toBe('hudsonivy.attn.tv');
    });

    it('getEntityDetails throws when companyId is missing', async () => {
        const api = new Api({ access_token: 'k' });
        api.getMe = async () => ({ companyName: 'No Id Co' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/companyId/i);
    });

    it('getCredentialDetails uses companyId from /me', async () => {
        const api = new Api({ access_token: 'k' });
        api.getMe = async () => ({
            companyId: 'cmp-99',
            companyName: 'Acme',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('cmp-99');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getMe', async () => {
        const api = new Api({ access_token: 'k' });
        let called = false;
        api.getMe = async () => {
            called = true;
            return { companyId: 'x' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('references business mapping via extensions.mapping', () => {
        expect(Definition.mappings.business).toBe('extensions.mapping');
    });
});
