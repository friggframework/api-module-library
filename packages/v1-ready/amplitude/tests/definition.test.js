const { Definition } = require('../definition');
const { Api } = require('../api');
const { contactMapping } = require('../mappings/contact');
const pkg = require('../index');

const { requiredAuthMethods } = Definition;

describe('Amplitude Definition', () => {
    it('is named amplitude and models the Amplitude entity', () => {
        expect(Definition.getName()).toBe('amplitude');
        expect(Definition.moduleName).toBe('amplitude');
        expect(Definition.modelName).toBe('Amplitude');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists api key, secret, and region/host fields on the credential', () => {
        expect(requiredAuthMethods.apiPropertiesToPersist.credential).toEqual([
            'api_key',
            'secret_key',
            'region',
            'base_url',
            'profile_base_url',
        ]);
    });

    it('exports extensions.mapping for business@1 contact (UNVALIDATED)', () => {
        expect(Definition.mappings).toEqual({
            business: 'extensions.mapping',
        });
        expect(pkg.extensions.mapping.schemas.business).toBe(contactMapping);
        expect(contactMapping.schema).toBe('business@1');
        expect(contactMapping.label).toBe('UNVALIDATED');
        expect(contactMapping.objects.user_profile[0].to).toBe('Contact');
    });

    describe('key fingerprinting', () => {
        it('derives a stable, non-reversible externalId from the api key', async () => {
            const api = { api_key: 'secret-key' };
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

            expect(entity.identifiers.externalId).toBe(
                credential.identifiers.externalId
            );
            expect(entity.identifiers.externalId).not.toBe('secret-key');
            expect(entity.identifiers.externalId).toMatch(/^[a-f0-9]{64}$/);
            expect(entity.identifiers.userId).toBe('user-1');
        });

        it('falls back to the Basic-auth username when api_key is absent', async () => {
            const fromKey = await requiredAuthMethods.getEntityDetails(
                { api_key: 'ak' },
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
                { api_key: 'key-a' },
                {},
                {},
                'u'
            );
            const b = await requiredAuthMethods.getEntityDetails(
                { api_key: 'key-b' },
                {},
                {},
                'u'
            );
            expect(a.identifiers.externalId).not.toBe(b.identifiers.externalId);
        });
    });

    describe('getAuthorizationRequirements', () => {
        it('delegates to the api form definition', async () => {
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
        it('wires form api key/secret onto Basic-auth username/password', async () => {
            const api = new Api({});
            await requiredAuthMethods.setAuthParams(api, {
                api_key: 'ak-123',
                secret_key: 'secret-xyz',
                region: 'eu',
            });

            expect(api.username).toBe('ak-123');
            expect(api.password).toBe('secret-xyz');
            expect(api.api_key).toBe('ak-123');
            expect(api.secret_key).toBe('secret-xyz');
            expect(api.region).toBe('eu');
            expect(api.baseUrl).toBe('https://analytics.eu.amplitude.com');
        });

        it('reads form fields nested under params.data', async () => {
            const api = new Api({});
            await requiredAuthMethods.setAuthParams(api, {
                data: {
                    api_key: 'nested-ak',
                    secret_key: 'nested-secret',
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
