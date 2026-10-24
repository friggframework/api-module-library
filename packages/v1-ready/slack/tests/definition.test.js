const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Slack Definition', () => {
    it('is an oauth2 module named slack wired to the Api class', () => {
        expect(Definition.moduleName).toBe('slack');
        expect(Definition.getName()).toBe('slack');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Slack');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements via the Api', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example/redirect/slack',
            scope: 'chat:write',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('slack.com/oauth/v2/authorize');
    });

    it('persists tokens and team_id on credential/entity', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'team_id',
                'team_name',
            ],
            entity: ['team_id'],
        });
    });

    it('getToken exchanges the code via getTokenFromCode', async () => {
        const api = new Api({});
        const spy = jest
            .spyOn(api, 'getTokenFromCode')
            .mockResolvedValue({
                ok: true,
                access_token: 'xoxb-1',
                team: { id: 'T9', name: 'Nine' },
            });
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'the-code' },
        });
        expect(spy).toHaveBeenCalledWith('the-code');
    });

    it('getToken rejects a missing code', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getToken(api, { data: {} })
        ).rejects.toThrow(/missing authorization code/i);
    });

    it('getEntityDetails uses team_id from auth.test', async () => {
        const api = new Api({ access_token: 'xoxb-1', team_id: 'Tlegacy' });
        api.authTest = async () => ({
            ok: true,
            team_id: 'T123',
            team: 'Acme Workspace',
            user_id: 'U1',
            bot_id: 'B1',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            { team: { id: 'T123', name: 'Acme Workspace' } },
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('T123');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Workspace');
        expect(details.details.team_id).toBe('T123');
    });

    it('getCredentialDetails uses team_id from auth.test', async () => {
        const api = new Api({ access_token: 'xoxb-1' });
        api.authTest = async () => ({
            ok: true,
            team_id: 'T999',
            team: 'T999 Workspace',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('T999');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls authTest', async () => {
        const api = new Api({ access_token: 'xoxb-1' });
        let called = false;
        api.authTest = async () => {
            called = true;
            return { ok: true, team_id: 'T1' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env wires Slack OAuth client credentials', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });
});
