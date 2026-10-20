const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const USER_URI = 'https://api.calendly.com/users/AAAAAAAAAAAAAAAA';
const ORG_URI = 'https://api.calendly.com/organizations/ORGORGORGORGORG';

function makeStubApi(userOverride = {}) {
    const resource = {
        uri: USER_URI,
        name: 'Jane Doe',
        email: 'jane@example.com',
        current_organization: ORG_URI,
        ...userOverride,
    };
    return {
        getCurrentUser: async () => ({ resource }),
        getUserDetails: async () => resource,
        getTokenIdentity: async () => ({
            identifier: resource.uri,
            name: resource.name,
            email: resource.email,
            organization: resource.current_organization,
        }),
        getTokenFromCode: jest.fn().mockResolvedValue({ access_token: 'a' }),
        getAuthorizationRequirements: () => ({
            url: 'https://auth.calendly.com/oauth/authorize?...',
            type: 'oauth2',
        }),
    };
}

describe('Calendly Definition', () => {
    it('is an oauth2 module named calendly wired to the Api class', () => {
        expect(Definition.moduleName).toBe('calendly');
        expect(Definition.getName()).toBe('calendly');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Calendly');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists oauth tokens and account URIs', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: ['organization', 'user'],
        });
    });

    it('exposes oauth2 authorization requirements from the api', async () => {
        const api = makeStubApi();
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('auth.calendly.com');
    });

    it('getToken exchanges the authorization code', async () => {
        const api = makeStubApi();
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'abc' },
        });
        expect(api.getTokenFromCode).toHaveBeenCalledWith('abc');
    });

    it('getEntityDetails uses the user URI as externalId', async () => {
        const api = makeStubApi();
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe(USER_URI);
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Jane Doe');
        expect(details.details.email).toBe('jane@example.com');
        expect(details.details.organization).toBe(ORG_URI);
    });

    it('getCredentialDetails uses the user URI as externalId', async () => {
        const api = makeStubApi();
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe(USER_URI);
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getCurrentUser', async () => {
        const api = makeStubApi();
        let called = false;
        api.getCurrentUser = async () => {
            called = true;
            return { resource: {} };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('declares CALENDLY_* env keys for oauth', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });

    it('validates structural shape against the api-module-definition schema keys', () => {
        // Structural check mirroring packages/schemas/schemas/api-module-definition.schema.json
        // (functions cannot be JSON-schema-validated directly; we assert presence + types).
        expect(typeof Definition.moduleName).toBe('string');
        expect(typeof Definition.getName).toBe('function');
        expect(Definition.API).toBeTruthy();
        const auth = Definition.requiredAuthMethods;
        expect(typeof auth.getToken).toBe('function');
        expect(typeof auth.getEntityDetails).toBe('function');
        expect(typeof auth.getCredentialDetails).toBe('function');
        expect(typeof auth.testAuthRequest).toBe('function');
        expect(auth.apiPropertiesToPersist).toEqual(
            expect.objectContaining({
                credential: expect.any(Array),
                entity: expect.any(Array),
            })
        );
        // moduleName pattern from the schema
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('capability manifest maps every named method to a real Api method', () => {
        const manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'calendly.capabilities.json'),
                'utf8'
            )
        );
        expect(manifest.$schema).toBe(
            'https://friggframework.org/schemas/capability-manifest/v0.1.json'
        );
        expect(manifest.module).toBe('calendly');
        expect(manifest.package).toBe('@friggframework/api-module-calendly');
        expect(manifest.version).toBe('1.0.0');

        const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
            (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
        );

        for (const [name, cap] of Object.entries(manifest.capabilities || {})) {
            expect(clientMethods).toContain(cap.method);
            expect(name).toBeTruthy();
        }
        if (manifest.webhook?.verify) {
            expect(clientMethods).toContain(manifest.webhook.verify);
        }
        for (const objectDef of Object.values(manifest.objects || {})) {
            expect(Array.isArray(objectDef.fields)).toBe(true);
            expect(objectDef.fields.length).toBeGreaterThan(0);
        }
    });
});
