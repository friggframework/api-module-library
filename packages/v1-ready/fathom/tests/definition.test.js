const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

// Offline: exercises the Definition auth methods with a fake api whose network
// calls are stubbed. No real HTTP.
describe('Fathom Definition', () => {
    it('is an api-key module named fathom wired to the Api class', () => {
        expect(Definition.moduleName).toBe('fathom');
        expect(Definition.getName()).toBe('fathom');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Fathom');
    });

    it('exposes an apiKey authorization form for the api_key field', () => {
        const reqs = Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
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

    it('getEntityDetails derives externalId from recorded_by email', async () => {
        const api = new Api({ api_key: 'k' });
        api.listMeetings = async () => ({
            items: [
                {
                    recording_id: 1,
                    recorded_by: {
                        name: 'Sean',
                        email: 'sean@lefthook.co',
                        team: 'Left Hook',
                    },
                },
            ],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('sean@lefthook.co');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Left Hook');
    });

    it('getEntityDetails falls back to the api-key fingerprint with no meetings', async () => {
        const api = new Api({ api_key: 'key-abc' });
        api.listMeetings = async () => ({ items: [] });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        // Genuinely per-account: a sha256 of the key, NOT a shared constant.
        expect(details.identifiers.externalId).toBe(sha256('key-abc'));
        expect(details.identifiers.externalId).not.toBe('fathom-account');
    });

    it('getEntityDetails falls back to the fingerprint when recorded_by has no email', async () => {
        const api = new Api({ api_key: 'key-xyz' });
        api.listMeetings = async () => ({
            items: [{ recording_id: 1, recorded_by: { name: 'Anon' } }],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2b'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-xyz'));
    });

    it('getEntityDetails uses the fingerprint if the API throws', async () => {
        const api = new Api({ api_key: 'key-boom' });
        api.listMeetings = async () => {
            throw new Error('boom');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-3'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-boom'));
    });

    it('fingerprint fallback is STABLE for the same key and UNIQUE across keys', async () => {
        const makeApi = (key) => {
            const api = new Api({ api_key: key });
            api.listMeetings = async () => ({ items: [] });
            return api;
        };
        const idFor = async (key) =>
            (
                await Definition.requiredAuthMethods.getEntityDetails(
                    makeApi(key),
                    {},
                    {},
                    'u'
                )
            ).identifiers.externalId;
        const credIdFor = async (key) =>
            (
                await Definition.requiredAuthMethods.getCredentialDetails(
                    makeApi(key),
                    'u'
                )
            ).identifiers.externalId;

        // Same key -> same id (stable).
        expect(await idFor('cust-A-key')).toBe(await idFor('cust-A-key'));
        // Two different customers -> different ids (no collision).
        expect(await idFor('cust-A-key')).not.toBe(await idFor('cust-B-key'));
        // Entity and credential agree for one account.
        expect(await idFor('cust-A-key')).toBe(await credIdFor('cust-A-key'));
    });

    it('getCredentialDetails falls back to the api-key fingerprint', async () => {
        const api = new Api({ api_key: 'cred-key' });
        api.listMeetings = async () => ({ items: [] });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe(sha256('cred-key'));
    });

    it('throws rather than returning a shared constant when nothing can be derived', async () => {
        const api = new Api({});
        api.api_key = null;
        api.listMeetings = async () => ({ items: [] });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]fathom-account['"]/);
        expect(src).not.toMatch(/return\s*\{\s*externalId:\s*['"]fathom-account['"]/);
    });

    it('testAuthRequest performs an authenticated list call', async () => {
        const api = new Api({ api_key: 'k' });
        let called = false;
        api.listMeetings = async () => {
            called = true;
            return { items: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
