const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Close Definition', () => {
    it('is a close module wired to the Api class', () => {
        expect(Definition.moduleName).toBe('close');
        expect(Definition.getName()).toBe('close');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Close');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements with optional api_key', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('app.close.com/oauth2/authorize');
        expect(reqs.data.jsonSchema.properties.api_key.type).toBe('string');
    });

    it('persists OAuth tokens, api_key, and organization_id', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'api_key',
                'organization_id',
            ],
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

    it('getEntityDetails uses organization_id from the token response', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => {
            throw new Error('should not call getMe when org is on token');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            { organization_id: 'orga_abc' },
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('orga_abc');
        expect(details.identifiers.userId).toBe('user-1');
    });

    it('getEntityDetails falls back to GET /me/ organizations[0].id', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({
            id: 'user_1',
            email: 'a@example.com',
            first_name: 'Ann',
            last_name: 'Example',
            organizations: [{ id: 'orga_from_me', name: 'Acme Org' }],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('orga_from_me');
        expect(details.details.name).toBe('Acme Org');
    });

    it('getCredentialDetails matches entity externalId', async () => {
        const api = new Api({
            access_token: 't',
            organization_id: 'orga_cred',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('orga_cred');
    });

    it('testAuthRequest calls getMe', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getMe = async () => {
            called = true;
            return { id: 'user_x' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('getToken exchanges the code via api.getTokenFromCode', async () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'sec',
        });
        let saw;
        api.getTokenFromCode = async (code) => {
            saw = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        const res = await Definition.requiredAuthMethods.getToken(api, {
            code: 'auth-code',
        });
        expect(saw).toBe('auth-code');
        expect(res.access_token).toBe('a');
    });

    it('references business mappings as extensions.mapping', () => {
        expect(Definition.mappings).toEqual({
            business: 'extensions.mapping',
        });
    });
});
