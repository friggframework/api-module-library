const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('ServiceNow Definition', () => {
    it('is an oauth2 module named servicenow wired to the Api class', () => {
        expect(Definition.moduleName).toBe('servicenow');
        expect(Definition.getName()).toBe('servicenow');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('ServiceNow');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements with instance field', () => {
        const api = new Api({ client_id: 'cid', redirect_uri: 'https://r' });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.data.jsonSchema.required).toContain('instance');
        expect(reqs.url).toContain('oauth_auth.do');
    });

    it('persists tokens, instance, and optional basic credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'instance',
                'username',
                'password',
            ],
            entity: ['instance'],
        });
    });

    it('getToken exchanges code after setting instance', async () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'sec',
            redirect_uri: 'https://r/servicenow',
        });
        let codeSeen;
        api.getTokenFromCode = async (code) => {
            codeSeen = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        const result = await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code', instance: 'dev99' },
        });
        expect(api.instance).toBe('dev99');
        expect(api.baseUrl).toBe('https://dev99.service-now.com');
        expect(codeSeen).toBe('auth-code');
        expect(result.access_token).toBe('a');
    });

    it('getToken accepts basic auth alternate without code', async () => {
        const api = new Api({});
        const result = await Definition.requiredAuthMethods.getToken(api, {
            data: {
                instance: 'dev99',
                username: 'alice',
                password: 's3cret',
            },
        });
        expect(api.instance).toBe('dev99');
        expect(api.username).toBe('alice');
        expect(api.password).toBe('s3cret');
        expect(api.isRefreshable).toBe(false);
        expect(result.username).toBe('alice');
    });

    it('setAuthParams restores instance and credentials', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            instance: 'restored',
            access_token: 'tok',
            refresh_token: 'ref',
        });
        expect(api.instance).toBe('restored');
        expect(api.access_token).toBe('tok');
        expect(api.refresh_token).toBe('ref');
    });

    it('getEntityDetails uses instance as externalId', async () => {
        const api = new Api({ instance: 'acme', access_token: 't' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('acme');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.instance).toBe('acme');
    });

    it('getCredentialDetails uses instance as externalId', async () => {
        const api = new Api({ instance: 'acme', access_token: 't' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('acme');
        expect(details.details.instance).toBe('acme');
    });

    it('throws when instance cannot be derived', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/instance/i);
    });

    it('testAuthRequest lists sys_user with limit 1', async () => {
        const api = new Api({ instance: 'acme', access_token: 't' });
        let calledWith;
        api.listSysUsers = async (q) => {
            calledWith = q;
            return { result: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(calledWith).toEqual({ sysparm_limit: 1 });
    });

    it('points mappings at extensions.mapping for support and business', () => {
        expect(Definition.mappings).toEqual({
            support: 'extensions.mapping',
            business: 'extensions.mapping',
        });
    });

    it('does not invent a webhook subscribe helper in source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'api.js'),
            'utf8'
        );
        expect(src).not.toMatch(/createWebhook|subscribeWebhook/);
    });
});
