const { Definition } = require('../definition');

const { requiredAuthMethods } = Definition;

describe('Otter Definition', () => {
    it('is named otter and models the Otter entity', () => {
        expect(Definition.getName()).toBe('otter');
        expect(Definition.moduleName).toBe('otter');
        expect(Definition.modelName).toBe('Otter');
    });

    it('persists the api_token on the credential', () => {
        expect(requiredAuthMethods.apiPropertiesToPersist.credential).toContain(
            'api_token'
        );
    });

    describe('key fingerprinting', () => {
        it('derives a stable, non-reversible externalId from the api token', async () => {
            const api = { api_token: 'secret-key' };
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

        it('produces different ids for different keys', async () => {
            const a = await requiredAuthMethods.getEntityDetails(
                { api_token: 'key-a' },
                {},
                {},
                'u'
            );
            const b = await requiredAuthMethods.getEntityDetails(
                { api_token: 'key-b' },
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
