const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Digitail Definition', () => {
    it('is an oauth2 module named digitail wired to the Api class', () => {
        expect(Definition.moduleName).toBe('digitail');
        expect(Definition.getName()).toBe('digitail');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Digitail');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists access_token and refresh_token credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: [],
        });
    });

    it('exposes the required auth methods', () => {
        const m = Definition.requiredAuthMethods;
        expect(typeof m.getToken).toBe('function');
        expect(typeof m.getEntityDetails).toBe('function');
        expect(typeof m.getCredentialDetails).toBe('function');
        expect(typeof m.testAuthRequest).toBe('function');
        expect(typeof m.getAuthorizationRequirements).toBe('function');
        expect(m.apiPropertiesToPersist).toBeDefined();
    });

    it('getAuthorizationRequirements returns oauth2 with authorize url', () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'sec',
            redirect_uri: 'https://app.example.com/redirect/digitail',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('/oauth/authorize');
        expect(reqs.url).toContain('code_challenge_method=S256');
    });

    it('uses DIGITAIL_REDIRECT_URI in env', () => {
        expect(Definition.env).toHaveProperty('redirect_uri');
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
    });

    it('getEntityDetails uses clinic.id as externalId when present', async () => {
        const api = new Api({});
        api.getAuthMe = async () => ({
            data: {
                id: 99,
                full_name: 'Sarah Connolly',
                email: 'vet@example.com',
                clinic: { id: 766, name: 'Animal Hospital of All Pets' },
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('766');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Animal Hospital of All Pets');
        expect(details.details.email).toBe('vet@example.com');
        expect(api.clinicId).toBe(766);
    });

    it('getEntityDetails falls back to user id without clinic', async () => {
        const api = new Api({});
        api.getAuthMe = async () => ({
            data: { id: 12, first_name: 'A', last_name: 'B' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'u'
        );
        expect(details.identifiers.externalId).toBe('12');
        expect(details.details.name).toBe('A B');
    });

    it('getEntityDetails throws when identity cannot be derived', async () => {
        const api = new Api({});
        api.getAuthMe = async () => ({ data: {} });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/clinic id or user id/i);
    });

    it('getCredentialDetails uses clinic.id', async () => {
        const api = new Api({});
        api.getAuthMe = async () => ({
            data: { id: 1, clinic: { id: 50, name: 'X' } },
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('50');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getAuthMe', async () => {
        const api = new Api({});
        let called = false;
        api.getAuthMe = async () => {
            called = true;
            return { data: { id: 1 } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('getToken exchanges the OAuth code with PKCE extras', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code, extras) => {
            seen = { code, extras };
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code', state: 'st', code_verifier: 'v' },
        });
        expect(seen.code).toBe('auth-code');
        expect(seen.extras.state).toBe('st');
        expect(seen.extras.code_verifier).toBe('v');
    });

    it('retains no client-specific names in definition source', () => {
        const fs = require('fs');
        const path = require('path');
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src.toLowerCase()).not.toMatch(/payjunction/);
        expect(src.toLowerCase()).not.toMatch(/lefthookhq/);
    });
});
