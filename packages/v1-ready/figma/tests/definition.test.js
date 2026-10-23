const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Figma Definition', () => {
    it('is an oauth module named figma wired to the Api class', () => {
        expect(Definition.moduleName).toBe('figma');
        expect(Definition.getName()).toBe('figma');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Figma');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists access_token and refresh_token credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: [],
        });
    });

    it('exposes OAuth env keys', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://example.com/r',
            scope: 'current_user:read',
        });
        api.getTokenFromCode = jest.fn().mockResolvedValue({ access_token: 't' });
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'abc' },
        });
        expect(api.getTokenFromCode).toHaveBeenCalledWith('abc');
    });

    it('getEntityDetails uses /v1/me id as externalId', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://example.com/r',
            scope: 'current_user:read',
        });
        api.getMe = async () => ({
            id: '813845097374535682',
            handle: 'Dylan Field',
            email: 'dylan@figma.com',
            img_url: 'https://example.com/a.png',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('813845097374535682');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Dylan Field');
        expect(details.details.email).toBe('dylan@figma.com');
    });

    it('getEntityDetails throws when /v1/me has no id', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://example.com/r',
            scope: 'current_user:read',
        });
        api.getMe = async () => ({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/did not return a user id/i);
    });

    it('getCredentialDetails mirrors entity externalId from /v1/me', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://example.com/r',
            scope: 'current_user:read',
        });
        api.getMe = async () => ({
            id: '99',
            handle: 'A',
            email: 'a@x.com',
            img_url: '',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('99');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getMe', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://example.com/r',
            scope: 'current_user:read',
        });
        let called = false;
        api.getMe = async () => {
            called = true;
            return { id: '1', handle: 'x', email: 'x@y.z', img_url: '' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('requiredAuthMethods matches the api-module definition contract', () => {
        const methods = Definition.requiredAuthMethods;
        expect(typeof methods.getToken).toBe('function');
        expect(typeof methods.getEntityDetails).toBe('function');
        expect(typeof methods.getCredentialDetails).toBe('function');
        expect(typeof methods.testAuthRequest).toBe('function');
        expect(methods.apiPropertiesToPersist).toBeTruthy();
        // OAuth modules use getToken, not setAuthParams
        expect(methods.setAuthParams).toBeUndefined();
    });

    it('capability manifest maps every declared method to an Api method', () => {
        const manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'figma.capabilities.json'),
                'utf8'
            )
        );
        expect(manifest.schema).toBe('capability-manifest/v0.1');
        expect(manifest.module).toBe('figma');
        expect(manifest.package).toBe('@friggframework/api-module-figma');
        expect(manifest.version).toBe(
            require('../package.json').version
        );

        const apiMethods = Object.getOwnPropertyNames(Api.prototype).filter(
            (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
        );

        const declared = new Set();
        for (const obj of Object.values(manifest.objects)) {
            expect(Array.isArray(obj.fields)).toBe(true);
            for (const field of obj.fields) {
                expect(Array.isArray(field.tags)).toBe(true);
            }
            for (const methodName of Object.values(obj.methods || {})) {
                declared.add(methodName);
                expect(apiMethods).toContain(methodName);
            }
        }
        expect(declared.has('getMe')).toBe(true);
        expect(declared.has('postWebhook')).toBe(true);
        expect(manifest.auth.scopes).toContain('project_metadata:read');
        expect(manifest.auth.scopes).toContain('folder_metadata:read');
    });
});
