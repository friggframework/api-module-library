const { Definition } = require('../definition');
const { Api } = require('../api');

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

    describe('getAuthorizationRequirements', () => {
        it('delegates to the api form definition so the CLI renders it', async () => {
            let called = false;
            const api = {
                getAuthorizationRequirements: () => {
                    called = true;
                    return { type: 'basic', data: { jsonSchema: {} } };
                },
            };
            const reqs =
                await requiredAuthMethods.getAuthorizationRequirements(api);
            expect(called).toBe(true);
            expect(reqs.type).toBe('basic');
        });
    });

    describe('setAuthParams', () => {
        it('wires the form access key onto the Basic-auth username and password', async () => {
            const api = {};
            await requiredAuthMethods.setAuthParams(api, {
                access_key: 'ak-123',
                access_key_secret: 'secret-xyz',
            });

            // The request-wiring the header is built from.
            expect(api.username).toBe('ak-123');
            expect(api.password).toBe('secret-xyz');
            // Gong-native names kept in sync for fingerprinting/persistence.
            expect(api.access_key).toBe('ak-123');
            expect(api.access_key_secret).toBe('secret-xyz');
        });

        it('reads form fields nested under params.data', async () => {
            const api = {};
            await requiredAuthMethods.setAuthParams(api, {
                data: {
                    access_key: 'nested-ak',
                    access_key_secret: 'nested-secret',
                },
            });
            expect(api.username).toBe('nested-ak');
            expect(api.password).toBe('nested-secret');
        });

        it('does not overwrite existing creds when params are empty', async () => {
            const api = { username: 'existing', password: 'existing-secret' };
            await requiredAuthMethods.setAuthParams(api, {});
            expect(api.username).toBe('existing');
            expect(api.password).toBe('existing-secret');
        });

        it('makes the credentials usable for a real Basic-auth request', async () => {
            // Mirrors what the framework does on the callback: instantiate the
            // real Api, then apply the form params via setAuthParams.
            const api = new Api({});
            expect(api.username).toBeNull();
            expect(api.password).toBeNull();

            await requiredAuthMethods.setAuthParams(api, {
                access_key: 'AK',
                access_key_secret: 'SK',
            });

            // BasicAuthRequester builds Base64(username:password) from these.
            expect(api.username).toBe('AK');
            expect(api.password).toBe('SK');
            expect(
                Buffer.from(`${api.username}:${api.password}`).toString('base64')
            ).toBe(Buffer.from('AK:SK').toString('base64'));
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
