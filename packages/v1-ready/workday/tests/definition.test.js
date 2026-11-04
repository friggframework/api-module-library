const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Workday Definition', () => {
    it('is an oauth module named workday wired to the Api class', () => {
        expect(Definition.moduleName).toBe('workday');
        expect(Definition.getName()).toBe('workday');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Workday');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes required auth methods', () => {
        const m = Definition.requiredAuthMethods;
        expect(typeof m.getAuthorizationRequirements).toBe('function');
        expect(typeof m.setAuthParams).toBe('function');
        expect(typeof m.getToken).toBe('function');
        expect(typeof m.getEntityDetails).toBe('function');
        expect(typeof m.getCredentialDetails).toBe('function');
        expect(typeof m.testAuthRequest).toBe('function');
        expect(m.apiPropertiesToPersist.credential).toEqual(
            expect.arrayContaining([
                'client_id',
                'client_secret',
                'access_token',
                'refresh_token',
                'tenant_alias',
            ])
        );
        expect(m.apiPropertiesToPersist.entity).toContain('tenant_alias');
    });

    it('setAuthParams configures integrations mode endpoints', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            client_id: 'cid',
            client_secret: 'sec',
            refresh_token: 'rt',
            tenant_alias: 'acme',
            auth_mode: 'integrations',
            tenant_hostname: 'impl.workday.com',
        });
        expect(api.client_id).toBe('cid');
        expect(api.tenant_alias).toBe('acme');
        expect(api.auth_mode).toBe('integrations');
        expect(api.baseUrl).toBe(
            'https://impl.workday.com/api/common/v1/acme'
        );
        expect(api.tokenUri).toBe(
            'https://impl.workday.com/ccx/oauth2/acme/token'
        );
    });

    it('getEntityDetails uses tenant_alias as externalId', async () => {
        const api = new Api({
            tenant_alias: 'gms',
            access_token: 't',
        });
        api.getCurrentWorker = async () => ({
            id: 'w1',
            descriptor: 'Logan McNeil',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('gms');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toContain('Logan McNeil');
    });

    it('getEntityDetails throws without tenant_alias', async () => {
        const api = new Api({});
        api.tenant_alias = null;
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/tenant_alias/i);
    });

    it('getCredentialDetails agrees with entity externalId', async () => {
        const api = new Api({ tenant_alias: 'gms' });
        api.getCurrentWorker = async () => {
            throw new Error('offline');
        };
        const entity = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'u'
        );
        const cred = await Definition.requiredAuthMethods.getCredentialDetails(
            api,
            'u'
        );
        expect(entity.identifiers.externalId).toBe(
            cred.identifiers.externalId
        );
        expect(cred.identifiers.externalId).toBe('gms');
    });

    it('testAuthRequest calls api.testAuth', async () => {
        const api = new Api({ tenant_alias: 'gms', access_token: 't' });
        let called = false;
        api.testAuth = async () => {
            called = true;
            return { id: 'me' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('getToken forwards authorization code when present', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            tenant_alias: 't',
        });
        let sawCode = null;
        api.getTokenFromCode = async (code) => {
            sawCode = code;
            return { access_token: 'a' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'authcode' },
        });
        expect(sawCode).toBe('authcode');
    });

    it('moduleName matches Frigg schema pattern', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'defaultConfig.json'),
            'utf8'
        );
        const cfg = JSON.parse(src);
        expect(cfg.name).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });
});
