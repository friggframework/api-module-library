const { Definition } = require('../definition');

const { requiredAuthMethods } = Definition;

describe('Gong Definition', () => {
    it('is named gong and models the Gong entity', () => {
        expect(Definition.getName()).toBe('gong');
        expect(Definition.moduleName).toBe('gong');
        expect(Definition.modelName).toBe('Gong');
    });

    it('persists the access key and secret on the credential', () => {
        expect(requiredAuthMethods.apiPropertiesToPersist.credential).toEqual([
            'access_key',
            'access_key_secret',
        ]);
    });

    describe('key fingerprinting', () => {
        it('derives a stable, non-reversible externalId from the access key', async () => {
            const api = { access_key: 'secret-key' };
            const entity = await requiredAuthMethods.getEntityDetails(
                api,
                {},
                {},
                'user-1'
            );
            const credential = await requiredAuthMethods.getCredentialDetails(
                api,
                'user-1'
            );

            // Same key → same id (idempotent linkage).
            expect(entity.identifiers.externalId).toBe(
                credential.identifiers.externalId
            );
            // Never the raw key.
            expect(entity.identifiers.externalId).not.toBe('secret-key');
            // sha256 hex.
            expect(entity.identifiers.externalId).toMatch(/^[a-f0-9]{64}$/);
            expect(entity.identifiers.userId).toBe('user-1');
        });

        it('falls back to the Basic-auth username when access_key is absent', async () => {
            const fromKey = await requiredAuthMethods.getEntityDetails(
                { access_key: 'ak' },
                {},
                {},
                'u'
            );
            const fromUsername = await requiredAuthMethods.getEntityDetails(
                { username: 'ak' },
                {},
                {},
                'u'
            );
            expect(fromKey.identifiers.externalId).toBe(
                fromUsername.identifiers.externalId
            );
        });

        it('produces different ids for different keys', async () => {
            const a = await requiredAuthMethods.getEntityDetails(
                { access_key: 'key-a' },
                {},
                {},
                'u'
            );
            const b = await requiredAuthMethods.getEntityDetails(
                { access_key: 'key-b' },
                {},
                {},
                'u'
            );
            expect(a.identifiers.externalId).not.toBe(b.identifiers.externalId);
        });
    });

    describe('testAuthRequest', () => {
        it('delegates to the api testAuth check', async () => {
            let called = false;
            const api = {
                testAuth: async () => {
                    called = true;
                    return { ok: true };
                },
            };
            await expect(
                requiredAuthMethods.testAuthRequest(api)
            ).resolves.toEqual({ ok: true });
            expect(called).toBe(true);
        });

        it('propagates auth failures from the api', async () => {
            const api = {
                testAuth: async () => {
                    throw new Error('401 Unauthorized');
                },
            };
            await expect(
                requiredAuthMethods.testAuthRequest(api)
            ).rejects.toThrow(/401/);
        });
    });
});
