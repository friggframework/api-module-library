const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition, hashApiKey } = require('../definition');
const { Api } = require('../api');

const md5 = (v) => crypto.createHash('md5').update(String(v)).digest('hex');

describe('DonorPerfect Definition', () => {
    it('is an api-key module named donorperfect wired to the Api class', () => {
        expect(Definition.moduleName).toBe('donorperfect');
        expect(Definition.getName()).toBe('donorperfect');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Donorperfect');
        expect(Definition.mappings).toEqual({ business: 'extensions.mapping' });
    });

    it('exposes an apiKey authorization form for the api_key field', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.data.jsonSchema.required).toContain('api_key');
        expect(reqs.data.jsonSchema.properties.api_key.type).toBe('string');
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('persists only the api_key credential', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_key'],
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

    it('setAuthParams rejects a missing key', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.setAuthParams(api, {})
        ).rejects.toThrow(/API key is required/i);
    });

    it('getEntityDetails hashes the key exactly as stored (incl. %2f)', async () => {
        const key = 'abc%2fxyz%2b';
        const api = new Api({ api_key: key });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe(md5(key));
        expect(details.identifiers.externalId).toBe(hashApiKey(key));
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toMatch(/DonorPerfect/i);
    });

    it('getEntityDetails prefers tokenResponse.api_key', async () => {
        const api = new Api({ api_key: 'old' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            { api_key: 'from-token' },
            'u'
        );
        expect(details.identifiers.externalId).toBe(md5('from-token'));
    });

    it('fingerprint is STABLE for the same key and UNIQUE across keys', async () => {
        const idFor = async (key) =>
            (
                await Definition.requiredAuthMethods.getEntityDetails(
                    new Api({ api_key: key }),
                    {},
                    {},
                    'u'
                )
            ).identifiers.externalId;
        const credIdFor = async (key) =>
            (
                await Definition.requiredAuthMethods.getCredentialDetails(
                    new Api({ api_key: key }),
                    'u'
                )
            ).identifiers.externalId;

        expect(await idFor('cust-A-key')).toBe(await idFor('cust-A-key'));
        expect(await idFor('cust-A-key')).not.toBe(await idFor('cust-B-key'));
        expect(await idFor('cust-A-key')).toBe(await credIdFor('cust-A-key'));
    });

    it('throws rather than returning a shared constant when nothing can be derived', async () => {
        const api = new Api({});
        api.api_key = null;
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO client-specific names in source', () => {
        const roots = ['api.js', 'definition.js', 'index.js', 'README.md'];
        for (const file of roots) {
            const src = fs.readFileSync(
                path.join(__dirname, '..', file),
                'utf8'
            );
            expect(src).not.toMatch(/\bAES\b/);
            expect(src).not.toMatch(/lefthookhq/i);
            expect(src).not.toMatch(/aes--frigg/i);
        }
    });

    it('testAuthRequest returns true on success', async () => {
        const api = new Api({ api_key: 'k' });
        api.testAuthRequest = async () => ({ success: true, records: [] });
        await expect(
            Definition.requiredAuthMethods.testAuthRequest(api)
        ).resolves.toBe(true);
    });

    it('testAuthRequest maps invalid-token reasons to a friendly error', async () => {
        const api = new Api({ api_key: 'k' });
        api.testAuthRequest = async () => ({
            success: false,
            reason: 'Invalid token',
        });
        await expect(
            Definition.requiredAuthMethods.testAuthRequest(api)
        ).rejects.toThrow(/invalid or has been revoked/i);
    });

    it('testAuthRequest never echoes transport errors that may hold the key', async () => {
        const api = new Api({ api_key: 'super-secret' });
        api.testAuthRequest = async () => {
            throw new Error('fetch failed body=apikey=super-secret');
        };
        await expect(
            Definition.requiredAuthMethods.testAuthRequest(api)
        ).rejects.toThrow(/Unable to reach DonorPerfect/i);
        try {
            await Definition.requiredAuthMethods.testAuthRequest(api);
        } catch (e) {
            expect(e.message).not.toContain('super-secret');
        }
    });

    it('env reads DONORPERFECT_API_KEY', () => {
        expect(Definition.env).toHaveProperty('api_key');
        expect(Definition.env).toHaveProperty('base_url');
    });
});
