const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition, hashEnvironmentId } = require('../definition');
const { Api } = require('../api');

describe("Raiser's Edge NXT Definition", () => {
    it('is an oauth2 module named raisersedge wired to the Api class', () => {
        expect(Definition.moduleName).toBe('raisersedge');
        expect(Definition.getName()).toBe('raisersedge');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('RaisersEdge');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('oauth2.sky.blackbaud.com/authorization');
    });

    it('persists tokens, expiry, and environment_id', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'environment_id',
            ],
            entity: [],
        });
    });

    it('uses dedicated RAISERSEDGE_REDIRECT_URI (not REDIRECT_URI/raisersedge)', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).toContain('RAISERSEDGE_REDIRECT_URI');
        expect(src).not.toMatch(/REDIRECT_URI\}\/raisersedge/);
        expect(src).not.toMatch(/\$\{process\.env\.REDIRECT_URI\}/);
    });

    it('strips client-specific AES / lefthookhq coupling from defaultConfig', () => {
        const config = require('../defaultConfig.json');
        const blob = JSON.stringify(config).toLowerCase();
        expect(blob).not.toContain('aes');
        expect(blob).not.toContain('lefthookhq');
    });

    it('hashes environment_id for stable externalId', () => {
        const envId = 'p-test-environment';
        expect(hashEnvironmentId(envId)).toBe(
            crypto.createHash('md5').update(envId).digest('hex')
        );
    });

    it('getEntityDetails uses md5(environment_id) from token response', async () => {
        const api = new Api({});
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            { environment_id: 'env-abc' },
            'user-1'
        );
        expect(details.identifiers.externalId).toBe(hashEnvironmentId('env-abc'));
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.environment_id).toBe('env-abc');
        expect(api.environment_id).toBe('env-abc');
    });

    it('getEntityDetails throws when environment_id is missing', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/environment_id/);
    });

    it('getCredentialDetails hashes environment_id', async () => {
        const api = new Api({ environment_id: 'env-xyz' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe(
            hashEnvironmentId('env-xyz')
        );
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 't', environment_id: 'e' };
        };
        await Definition.requiredAuthMethods.getToken(api, { code: 'abc' });
        expect(seen).toBe('abc');
    });

    it('testAuthRequest lists constituents', async () => {
        const api = new Api({});
        let called = false;
        api.listConstituents = async (params) => {
            called = true;
            expect(params).toEqual({ limit: 1 });
            return { value: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('declares business mappings via extensions.mapping', () => {
        expect(Definition.mappings).toEqual({
            business: 'extensions.mapping',
        });
    });
});
