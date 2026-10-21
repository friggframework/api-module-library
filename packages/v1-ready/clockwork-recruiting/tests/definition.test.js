const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Clockwork Recruiting Definition', () => {
    it('is a clockwork-recruiting module wired to the Api class', () => {
        expect(Definition.moduleName).toBe('clockwork-recruiting');
        expect(Definition.getName()).toBe('clockwork-recruiting');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('ClockworkRecruiting');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain(
            'account.clockworkrecruiting.com/oauth/authorize'
        );
        expect(reqs.url).toContain('response_type=code');
        expect(reqs.url).toContain('scope=read');
    });

    it('persists OAuth tokens and firm_subdomain', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
            ],
            entity: ['firm_subdomain'],
        });
    });

    it('getToken sets firm_subdomain then exchanges the code', async () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'sec',
        });
        let saw;
        api.getTokenFromCode = async (code) => {
            saw = { code, firm: api.firm_subdomain };
            return { access_token: 'a', refresh_token: 'r' };
        };
        const res = await Definition.requiredAuthMethods.getToken(api, {
            code: 'auth-code',
            firm_subdomain: 'acme',
        });
        expect(saw).toEqual({ code: 'auth-code', firm: 'acme' });
        expect(res.access_token).toBe('a');
    });

    it('getEntityDetails uses firm_subdomain and calls testConnection', async () => {
        const api = new Api({ access_token: 't', firm_subdomain: 'acme' });
        let probed = false;
        api.testConnection = async () => {
            probed = true;
            return { people: [] };
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            { firm_subdomain: 'acme' },
            {},
            'user-1'
        );
        expect(probed).toBe(true);
        expect(details.identifiers.externalId).toBe('acme');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.firm_subdomain).toBe('acme');
    });

    it('getCredentialDetails matches entity externalId', async () => {
        const api = new Api({
            access_token: 't',
            firm_subdomain: 'firm-x',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('firm-x');
    });

    it('getEntityDetails throws without firm_subdomain', async () => {
        const api = new Api({ access_token: 't' });
        api.testConnection = async () => ({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/firm_subdomain/);
    });

    it('testAuthRequest calls testConnection', async () => {
        const api = new Api({ access_token: 't', firm_subdomain: 'acme' });
        let called = false;
        api.testConnection = async () => {
            called = true;
            return {};
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('references business mappings as extensions.mapping', () => {
        expect(Definition.mappings).toEqual({
            business: 'extensions.mapping',
        });
    });

    it('uses a dedicated CLOCKWORK_RECRUITING redirect env in definition source', () => {
        const fs = require('fs');
        const path = require('path');
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).toMatch(/CLOCKWORK_RECRUITING_REDIRECT_URI/);
        expect(src).toMatch(/CLOCKWORK_OAUTH_CLIENT_ID/);
        expect(src).toMatch(/CLOCKWORK_OAUTH_CLIENT_SECRET/);
    });
});
