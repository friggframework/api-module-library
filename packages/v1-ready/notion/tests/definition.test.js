const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Notion Definition', () => {
    it('is an oauth2 module named notion wired to the Api class', () => {
        expect(Definition.moduleName).toBe('notion');
        expect(Definition.getName()).toBe('notion');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Notion');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements via the Api', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://example.com/redirect/notion',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('oauth/authorize');
    });

    it('persists oauth tokens and workspace identity fields', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'workspace_id',
                'workspace_name',
                'bot_id',
            ],
            entity: ['workspace_id'],
        });
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'at', workspace_id: 'ws' };
        };
        const result = await Definition.requiredAuthMethods.getToken(api, {
            code: 'auth-code',
        });
        expect(seen).toBe('auth-code');
        expect(result.workspace_id).toBe('ws');
    });

    it('getEntityDetails uses workspace_id from the token response', async () => {
        const api = new Api({ access_token: 't' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            { workspace_id: 'ws-99', workspace_name: 'Acme Corp' },
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('ws-99');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Corp');
        expect(api.workspace_id).toBe('ws-99');
    });

    it('getEntityDetails falls back to getSelf bot id', async () => {
        const api = new Api({ access_token: 't' });
        api.getSelf = async () => ({
            object: 'user',
            id: 'bot-42',
            name: 'My Bot',
            type: 'bot',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('bot-42');
        expect(details.details.name).toBe('My Bot');
    });

    it('getCredentialDetails uses persisted workspace_id', async () => {
        const api = new Api({
            access_token: 't',
            workspace_id: 'ws-cred',
            workspace_name: 'Cred WS',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('ws-cred');
    });

    it('testAuthRequest calls getSelf', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getSelf = async () => {
            called = true;
            return { id: 'bot' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env maps Notion OAuth variables', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });
});
