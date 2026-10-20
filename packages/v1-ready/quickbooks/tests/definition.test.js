const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('QuickBooks Definition', () => {
    it('is an oauth2 module named quickbooks wired to the Api class', () => {
        expect(Definition.moduleName).toBe('quickbooks');
        expect(Definition.getName()).toBe('quickbooks');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('QuickBooks');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements with an authorize URL', () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'sec',
            redirect_uri: 'https://app.example/redirect/quickbooks',
            scope: 'com.intuit.quickbooks.accounting',
            state: 'abc',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('appcenter.intuit.com/connect/oauth2');
        expect(reqs.url).toContain('client_id=cid');
        expect(reqs.url).toContain(
            encodeURIComponent('com.intuit.quickbooks.accounting')
        );
    });

    it('persists tokens and realmId', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'realmId',
            ],
            entity: ['realmId'],
        });
    });

    it('getToken captures realmId from the OAuth callback and exchanges the code', async () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'sec',
            redirect_uri: 'https://app.example/redirect/quickbooks',
        });
        const spy = jest
            .spyOn(api, 'getTokenFromCode')
            .mockResolvedValue({ access_token: 'a', refresh_token: 'r' });
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code', realmId: '9130354628571476' },
        });
        expect(api.realmId).toBe('9130354628571476');
        expect(spy).toHaveBeenCalledWith('auth-code');
    });

    it('getEntityDetails uses realmId as externalId and company name for display', async () => {
        const api = new Api({
            access_token: 'a',
            refresh_token: 'r',
            realmId: '99',
        });
        api.getCompanyInfo = async () => ({
            CompanyInfo: { CompanyName: 'Acme Books' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            { realmId: '9130354628571476' },
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('9130354628571476');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Books');
        expect(details.details.realmId).toBe('9130354628571476');
    });

    it('getEntityDetails fails closed when realmId is missing', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/realmId/);
    });

    it('getCredentialDetails keys on realmId', async () => {
        const api = new Api({ realmId: 'realm-7' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('realm-7');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getCompanyInfo', async () => {
        const api = new Api({ realmId: '1' });
        const spy = jest
            .spyOn(api, 'getCompanyInfo')
            .mockResolvedValue({ CompanyInfo: {} });
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(spy).toHaveBeenCalled();
    });

    it('env maps QuickBooks OAuth variables', () => {
        expect(Definition.env).toEqual(
            expect.objectContaining({
                client_id: process.env.QUICKBOOKS_CLIENT_ID,
                client_secret: process.env.QUICKBOOKS_CLIENT_SECRET,
            })
        );
        expect(Definition.env.scope).toContain(
            'com.intuit.quickbooks.accounting'
        );
    });

    it('capability manifest maps every method to an Api method', () => {
        const manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'quickbooks.capabilities.json'),
                'utf8'
            )
        );
        expect(manifest.$schema).toContain('capability-manifest/v0.1');
        expect(manifest.module).toBe('quickbooks');
        expect(manifest.package).toBe(
            '@friggframework/api-module-quickbooks'
        );
        expect(manifest.version).toBe(
            require('../package.json').version
        );
        expect(manifest.auth).toBe('oauth2');
        expect(manifest.webhook.verify).toBe('verifyWebhookSignature');

        const clientMethods = Object.getOwnPropertyNames(Api.prototype);
        for (const [name, cap] of Object.entries(manifest.capabilities)) {
            expect(clientMethods).toContain(cap.method);
            expect(typeof Api.prototype[cap.method]).toBe('function');
            expect(name).toBeTruthy();
        }
        expect(
            typeof Api.prototype[manifest.webhook.verify]
        ).toBe('function');
    });
});
