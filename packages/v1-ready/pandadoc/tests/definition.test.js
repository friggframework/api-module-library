const { Definition } = require('../definition');
const { Api } = require('../api');

describe('PandaDoc Definition', () => {
    it('is an oauth2 module named pandadoc wired to the Api class', () => {
        expect(Definition.moduleName).toBe('pandadoc');
        expect(Definition.getName()).toBe('pandadoc');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('PandaDoc');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists access_token and refresh_token', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: [],
        });
    });

    it('exposes OAuth env keys', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
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

    it('getEntityDetails uses workspace id as externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.detailsCurrentMember = async () => ({
            user_id: 'u1',
            membership_id: 'm1',
            email: 'josh@example.com',
            first_name: 'Josh',
            last_name: 'Ron',
            workspace: 'ws_abc',
            workspace_name: 'Acme Workspace',
            role: 'Admin',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('ws_abc');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Workspace');
        expect(details.details.email).toBe('josh@example.com');
        expect(details.details.membershipId).toBe('m1');
    });

    it('getCredentialDetails uses the same workspace externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.detailsCurrentMember = async () => ({
            workspace: 'ws_abc',
            workspace_name: 'Acme',
            email: 'josh@example.com',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('ws_abc');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls detailsCurrentMember', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.detailsCurrentMember = async () => {
            called = true;
            return { workspace: 'ws' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
