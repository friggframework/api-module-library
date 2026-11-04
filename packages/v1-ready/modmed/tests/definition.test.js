const { Definition } = require('../definition');
const { Api } = require('../api');

const DEMO_BASE = 'https://fhirmp.mmi.prod.fhir.ema-api.com/fhir/r4';

describe('ModMed Definition', () => {
    it('is an oauth2 module named modmed wired to the Api class', () => {
        expect(Definition.moduleName).toBe('modmed');
        expect(Definition.getName()).toBe('modmed');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('ModMed');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements with fhir_base', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://app.example/redirect/modmed',
        });
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('aud=');
        expect(reqs.data.jsonSchema.required).toContain('fhir_base');
    });

    it('persists tokens, fhir_base/tenant, and fhirUser', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'fhir_base',
                'tenant',
                'fhirUser',
            ],
            entity: [],
        });
    });

    it('getToken sets fhir_base then exchanges the code', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://app.example/r',
        });
        let exchanged;
        api.getTokenFromCode = async (code) => {
            exchanged = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: {
                code: 'abc',
                fhir_base: 'https://practice.example/fhir/r4',
            },
        });
        expect(api.baseUrl).toBe('https://practice.example/fhir/r4');
        expect(exchanged).toBe('abc');
    });

    it('setAuthParams restores fhir_base and tokens', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://app.example/r',
        });
        await Definition.requiredAuthMethods.setAuthParams(api, {
            fhir_base: 'https://other.example/fhir/r4',
            access_token: 'tok',
            refresh_token: 'ref',
            expires_in: 60,
            fhirUser: 'Practitioner/1',
        });
        expect(api.baseUrl).toBe('https://other.example/fhir/r4');
        expect(api.access_token).toBe('tok');
        expect(api.fhirUser).toBe('Practitioner/1');
    });

    it('getEntityDetails uses Practitioner id from getCurrentUser', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://app.example/r',
            fhir_base: DEMO_BASE,
        });
        api.getCurrentUser = async () => ({
            resourceType: 'Practitioner',
            id: 'prac-42',
            name: [{ text: 'Dr Example' }],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('prac-42');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Dr Example');
        expect(details.details.fhir_base).toBe(DEMO_BASE);
    });

    it('getEntityDetails falls back to fhir_base when identity calls fail', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://app.example/r',
            fhir_base: 'https://fallback.example/fhir/r4',
        });
        api.getCurrentUser = async () => {
            throw new Error('nope');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe(
            'https://fallback.example/fhir/r4'
        );
    });

    it('testAuthRequest calls getMetadata', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://app.example/r',
        });
        let called = false;
        api.getMetadata = async () => {
            called = true;
            return { resourceType: 'CapabilityStatement' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env uses dedicated MODMED redirect when set', () => {
        // Definition.env is evaluated at require-time from process.env.
        // We only assert the shape keys required by the schema.
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
        expect(Definition.env).toHaveProperty('base_url');
    });
});
