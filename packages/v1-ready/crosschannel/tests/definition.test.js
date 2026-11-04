const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition, clientIdFingerprint } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('CrossChannel Definition', () => {
    it('is an oauth2 client_credentials module named crosschannel', () => {
        expect(Definition.moduleName).toBe('crosschannel');
        expect(Definition.getName()).toBe('crosschannel');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('CrossChannel');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an oauth2 authorization form for client credentials', () => {
        const api = new Api({});
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['client_id', 'client_secret'])
        );
        expect(reqs.data.uiSchema.client_secret['ui:widget']).toBe('password');
    });

    it('persists token + client credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'accessTokenExpire',
                'client_id',
                'client_secret',
            ],
            entity: [],
        });
    });

    it('setAuthParams wires client credentials from form params', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            client_id: 'form-id',
            client_secret: 'form-secret',
        });
        expect(api.client_id).toBe('form-id');
        expect(api.client_secret).toBe('form-secret');
    });

    it('getToken calls setAuthParams then getTokenFromClientCredentials', async () => {
        const api = new Api({});
        let minted = false;
        api.getTokenFromClientCredentials = async () => {
            minted = true;
            expect(api.client_id).toBe('tok-id');
            return { access_token: 't' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            client_id: 'tok-id',
            client_secret: 'tok-secret',
        });
        expect(minted).toBe(true);
    });

    it('getEntityDetails fingerprints client_id', async () => {
        const api = new Api({ client_id: 'acct-A' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe(sha256('acct-A'));
        expect(details.identifiers.externalId).toBe(
            clientIdFingerprint('acct-A')
        );
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Cross Channel');
    });

    it('fingerprint is STABLE for the same client_id and UNIQUE across ids', async () => {
        const idFor = async (clientId) =>
            (
                await Definition.requiredAuthMethods.getEntityDetails(
                    new Api({ client_id: clientId }),
                    {},
                    {},
                    'u'
                )
            ).identifiers.externalId;
        const credIdFor = async (clientId) =>
            (
                await Definition.requiredAuthMethods.getCredentialDetails(
                    new Api({ client_id: clientId }),
                    'u'
                )
            ).identifiers.externalId;

        expect(await idFor('cust-A')).toBe(await idFor('cust-A'));
        expect(await idFor('cust-A')).not.toBe(await idFor('cust-B'));
        expect(await idFor('cust-A')).toBe(await credIdFor('cust-A'));
    });

    it('throws rather than returning a shared constant when client_id is missing', async () => {
        const api = new Api({});
        api.client_id = null;
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]crosschannel-account['"]/);
        expect(src).not.toMatch(/lefthook|clyde|microsoft\.com/i);
    });

    it('strips client-specific references from module sources', () => {
        const roots = [
            path.join(__dirname, '..', 'api.js'),
            path.join(__dirname, '..', 'definition.js'),
            path.join(__dirname, '..', 'README.md'),
            path.join(__dirname, '..', 'defaultConfig.json'),
        ];
        for (const file of roots) {
            const src = fs.readFileSync(file, 'utf8');
            expect(src).not.toMatch(/lefthookhq|Clyde|clyde--frigg/i);
            expect(src).not.toMatch(/graph\.microsoft\.com/i);
            expect(src).not.toMatch(/Product Warranty Plans/i);
        }
    });

    it('testAuthRequest performs an authenticated list call', async () => {
        const api = new Api({ client_id: 'k', client_secret: 's' });
        let called = false;
        api.getEventConfigurations = async () => {
            called = true;
            return { data: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env uses CROSSCHANNEL_ prefixes (no redirect URI for client_credentials)', () => {
        expect(Object.keys(Definition.env)).toEqual(
            expect.arrayContaining(['client_id', 'client_secret'])
        );
        expect(Definition.env).not.toHaveProperty('redirect_uri');
        expect(Definition.env).not.toHaveProperty('scope');
    });
});
